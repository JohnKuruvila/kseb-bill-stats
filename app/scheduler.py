import time

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal, utcnow
from app.models import Customer
from app.services.jobs import enqueue_sync_job_if_missing


def run_forever() -> None:
    sleep_seconds = max(settings.sync_check_interval_minutes * 60, 60)
    while True:
        with SessionLocal() as db:
            customer_ids = db.scalars(
                select(Customer.id).where(
                    Customer.is_active.is_(True),
                    Customer.next_sync_check_at <= utcnow(),
                )
            ).all()
            for customer_id in customer_ids:
                customer = db.get(Customer, customer_id)
                if customer is None:
                    continue
                enqueue_sync_job_if_missing(db, customer)
            db.commit()
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    run_forever()
