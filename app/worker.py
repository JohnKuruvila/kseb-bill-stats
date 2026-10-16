import time

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Customer
from app.services.billing import sync_customer_from_kseb
from app.services.jobs import claim_next_job, mark_job_complete, mark_job_failed
from app.storage import get_storage_service


def run_forever() -> None:
    storage = get_storage_service()
    while True:
        with SessionLocal() as db:
            job = claim_next_job(db, settings.worker_name)
            if job is None:
                db.commit()
                time.sleep(settings.worker_poll_seconds)
                continue

            try:
                if job.kind == "sync_customer":
                    customer = db.scalar(select(Customer).where(Customer.id == job.customer_id))
                    if customer is None:
                        raise ValueError("Customer no longer exists.")
                    sync_customer_from_kseb(db, customer=customer, storage=storage)
                else:
                    raise ValueError(f"Unsupported job kind: {job.kind}")
                mark_job_complete(job)
                db.commit()
            except Exception as exc:  # pragma: no cover - long-running path
                mark_job_failed(job, str(exc))
                db.commit()


if __name__ == "__main__":
    run_forever()
