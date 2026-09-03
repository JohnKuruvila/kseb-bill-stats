from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import utcnow
from app.models import Customer, Job


def enqueue_job(
    db: Session,
    *,
    kind: str,
    customer: Customer | None = None,
    payload: dict | None = None,
    delay_seconds: int = 0,
    max_attempts: int = 5,
) -> Job:
    job = Job(
        customer=customer,
        kind=kind,
        payload_json=payload or {},
        run_after=utcnow() + timedelta(seconds=delay_seconds),
        max_attempts=max_attempts,
    )
    db.add(job)
    return job


def has_pending_job(db: Session, customer_id: str, kind: str) -> bool:
    existing = db.scalar(
        select(Job).where(
            Job.customer_id == customer_id,
            Job.kind == kind,
            Job.status.in_(["pending", "running"]),
        )
    )
    return existing is not None


def enqueue_sync_job_if_missing(db: Session, customer: Customer) -> bool:
    db.flush()
    # Lock the customer row first so only one scheduler instance decides
    # whether to enqueue a pending sync job for that customer.
    db.scalar(select(Customer.id).where(Customer.id == customer.id).with_for_update())
    if has_pending_job(db, customer.id, "sync_customer"):
        return False
    enqueue_job(db, kind="sync_customer", customer=customer)
    return True


def claim_next_job(db: Session, worker_name: str) -> Job | None:
    job = db.scalar(
        select(Job)
        .where(Job.status == "pending", Job.run_after <= utcnow())
        .with_for_update(skip_locked=True)
        .order_by(Job.run_after.asc(), Job.created_at.asc())
        .limit(1)
    )
    if job is None:
        return None

    job.status = "running"
    job.locked_at = utcnow()
    job.worker_name = worker_name
    job.attempts += 1
    return job


def mark_job_complete(job: Job) -> None:
    job.status = "completed"
    job.completed_at = utcnow()
    job.error_message = None


def mark_job_failed(job: Job, error_message: str, *, retry_delay_seconds: int = 300) -> None:
    if job.attempts >= job.max_attempts:
        job.status = "failed"
    else:
        job.status = "pending"
        job.run_after = utcnow() + timedelta(seconds=retry_delay_seconds)
    job.error_message = error_message[:4000]
