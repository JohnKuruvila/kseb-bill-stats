from __future__ import annotations

from datetime import date

from app.db import SessionLocal
from app.models import Bill, Customer
from app.security import encrypt_text, hash_lookup_value
from app.services.billing import recompute_customer_periods


def _customer() -> Customer:
    consumer = "1155000999888"
    mobile = "9847000123"
    return Customer(
        consumer_number_hash=hash_lookup_value(consumer),
        mobile_number_hash=hash_lookup_value(mobile),
        consumer_number_ciphertext=encrypt_text(consumer),
        mobile_number_ciphertext=encrypt_text(mobile),
        display_consumer_number="******98888",
        display_mobile_number="******0123",
    )


def test_recompute_sets_period_for_just_added_bill(client):
    """A bill imported in the same transaction must get its billing period.

    Regression: the session runs with autoflush disabled, so without an explicit
    flush the newest (pending) bill was excluded from the inference and its
    period_start stayed NULL, making the UI label fall back to bill_date.
    """
    with SessionLocal() as db:
        customer = _customer()
        db.add(customer)
        db.commit()

        previous = Bill(customer=customer, record_key="bill:sep", bill_date=date(2026, 9, 1), total_amount=914.0, source_type="kseb-fetch")
        newest = Bill(customer=customer, record_key="bill:oct", bill_date=date(2026, 10, 1), total_amount=453.0, source_type="kseb-fetch")
        db.add_all([previous, newest])
        # No commit/flush here on purpose: recompute must handle the pending rows.
        recompute_customer_periods(db, customer)
        db.commit()

        db.refresh(newest)
        assert newest.period_start == date(2026, 9, 1)
        assert newest.period_end == date(2026, 9, 30)
        assert newest.billing_period_days == 30

        # The oldest bill has no predecessor, so its period stays empty by design.
        db.refresh(previous)
        assert previous.period_start is None
