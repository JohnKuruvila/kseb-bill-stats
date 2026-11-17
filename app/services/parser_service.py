from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from tempfile import NamedTemporaryFile

from scripts.parse_kseb_bill import build_bill_identity, build_record_id, parse_kseb_bill, validate_bill


def parse_date_string(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d-%m-%Y").date()
    except ValueError as exc:
        raise ValueError(f"Invalid date format '{value}'. Expected DD-MM-YYYY.") from exc


def classify_billing_period(days: int | None) -> str | None:
    if days is None:
        return None
    if days >= 55:
        return "bi-monthly"
    if days >= 25:
        return "monthly"
    return "irregular"


@dataclass
class ParsedBill:
    record_key: str
    record_id: str
    bill_number: str | None
    bill_date: date
    due_date: date | None
    total_amount: float
    metrics: dict


def parse_pdf_bytes(filename: str, content: bytes) -> ParsedBill:
    suffix = Path(filename).suffix or ".pdf"
    with NamedTemporaryFile(suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_file.flush()
        raw = parse_kseb_bill(temp_file.name)

    errors, warnings = validate_bill(raw)
    if errors:
        raise ValueError("; ".join(errors))

    raw["parse_warnings"] = warnings
    try:
        bill_date = parse_date_string(raw.get("bill_date"))
    except ValueError as exc:
        raise ValueError("Bill date could not be parsed.") from exc
    if bill_date is None:
        raise ValueError("Bill date could not be parsed.")

    total_amount = raw.get("total_amount")
    if total_amount is None:
        raise ValueError("Total amount is missing from the parsed bill.")

    return ParsedBill(
        record_key=build_bill_identity(raw),
        record_id=build_record_id(raw),
        bill_number=raw.get("bill_number"),
        bill_date=bill_date,
        due_date=parse_date_string(raw.get("due_date")),
        total_amount=float(total_amount),
        metrics=raw,
    )


def infer_billing_metadata(parsed_bills: list[ParsedBill]) -> list[dict]:
    ordered = sorted(parsed_bills, key=lambda bill: bill.bill_date)
    enriched: list[dict] = []
    previous: ParsedBill | None = None

    for bill in ordered:
        period_days = None
        period_start = None
        period_end = None
        if previous is not None:
            delta = (bill.bill_date - previous.bill_date).days
            if delta > 0:
                period_days = delta
                period_end = bill.bill_date - timedelta(days=1)
                period_start = period_end - timedelta(days=delta - 1)

        enriched.append(
            {
                "parsed": bill,
                "period_start": period_start,
                "period_end": period_end,
                "billing_period_days": period_days,
                "billing_period_category": classify_billing_period(period_days),
            }
        )
        previous = bill

    if len(enriched) == 1:
        enriched[0]["billing_period_category"] = "unknown"

    return enriched
