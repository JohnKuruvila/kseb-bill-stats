from datetime import date

import pytest

from app.config import _as_int
from app.services.parser_service import ParsedBill, infer_billing_metadata


def test_infer_bi_monthly_billing_period():
    first = ParsedBill(
        record_key="one",
        record_id="one",
        bill_number="1",
        bill_date=date(2025, 1, 1),
        due_date=None,
        total_amount=100.0,
        metrics={},
    )
    second = ParsedBill(
        record_key="two",
        record_id="two",
        bill_number="2",
        bill_date=date(2025, 3, 2),
        due_date=None,
        total_amount=200.0,
        metrics={},
    )

    enriched = infer_billing_metadata([first, second])

    assert enriched[1]["billing_period_days"] == 60
    assert enriched[1]["billing_period_category"] == "bi-monthly"


def test_parse_date_validation_error_is_consistent():
    from app.services.parser_service import parse_date_string

    with pytest.raises(ValueError, match="Expected DD-MM-YYYY"):
        parse_date_string("2025/03/01")


def test_as_int_raises_clear_env_error():
    with pytest.raises(ValueError, match="SESSION_TTL_HOURS must be an integer"):
        _as_int("abc", 12, name="SESSION_TTL_HOURS")
