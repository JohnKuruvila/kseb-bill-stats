from sqlalchemy import select

from app.db import SessionLocal
from app.models import AuditEvent, Customer, Job
from app.services.jobs import enqueue_sync_job_if_missing


def _mock_sync_customer_from_kseb(db, *, customer, storage):
    customer.last_synced_at = None
    return None, None, True


def test_enqueue_sync_job_if_missing_is_idempotent(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    with SessionLocal() as db:
        db.query(AuditEvent).delete()
        db.commit()

    login = client.post(
        "/api/session",
        json={"consumer_number": "888877776666", "mobile_number": "9999900000"},
    )
    assert login.status_code == 200
    customer_id = login.json()["customer_id"]

    with SessionLocal() as db:
        customer = db.get(Customer, customer_id)
        assert enqueue_sync_job_if_missing(db, customer) is True
        assert enqueue_sync_job_if_missing(db, customer) is False
        db.commit()

    with SessionLocal() as db:
        jobs = db.scalars(
            select(Job).where(
                Job.customer_id == customer_id,
                Job.kind == "sync_customer",
                Job.status.in_(["pending", "running"]),
            )
        ).all()
        assert len(jobs) == 1
