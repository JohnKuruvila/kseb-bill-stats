from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.services.stats import derive_bill_view


@dataclass
class DummyBill:
    id: str
    bill_date: date
    due_date: date | None
    total_amount: float
    metrics_json: dict
    period_start: date | None = None
    period_end: date | None = None
    billing_period_days: int | None = None
    billing_period_category: str | None = None


def test_bill_label_uses_billing_period_start_month():
    # KSEB bills are generally issued around the 3rd of the month.
    # The usage period for a "March 2026" bill starts in February 2026.
    first_bill_date = date(2026, 2, 3)
    second_bill_date = date(2026, 3, 3)

    # Mirror the billing-period inference:
    # delta = (this_bill.bill_date - previous_bill.bill_date).days
    # period_end = this_bill.bill_date - 1 day
    # period_start = period_end - (delta - 1) days
    delta = (second_bill_date - first_bill_date).days
    period_end = second_bill_date - timedelta(days=1)
    period_start = period_end - timedelta(days=delta - 1)

    bill = DummyBill(
        id="b2",
        bill_date=second_bill_date,
        due_date=date(2026, 3, 10),
        total_amount=200.0,
        metrics_json={},
        period_start=period_start,
        period_end=period_end,
        billing_period_days=delta,
        billing_period_category="monthly",
    )

    expected_label = period_start.strftime("%b %Y")
    assert derive_bill_view(bill)["label"] == expected_label


def test_charge_breakdown_is_hidden_when_components_are_inconsistent():
    bill = DummyBill(
        id="bad-charges",
        bill_date=date(2025, 8, 3),
        due_date=date(2025, 8, 12),
        total_amount=1217.0,
        metrics_json={
            "fixed_charge": 310.0,
            "energy_charge": 777.1,
            "electricity_duty": 18816.0,
            "meter_rent": 32.0,
        },
    )

    view = derive_bill_view(bill)
    assert view["charge_breakdown_valid"] is False
    assert view["fixed_charge"] is None
    assert view["energy_charge"] is None
    assert view["tax_and_rent"] is None
    assert view["other_charges"] is None

