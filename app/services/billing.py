from datetime import timedelta
from statistics import median

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import utcnow
from app.models import Bill, BillDocument, Customer
from app.security import decrypt_text, generate_storage_key, sha256_bytes
from app.services.kseb_service import fetch_latest_bill_pdf
from app.services.notifications import notify_new_bill
from app.services.parser_service import ParsedBill, infer_billing_metadata, parse_pdf_bytes
from app.storage import StorageService


class DocumentImportError(ValueError):
    def __init__(self, message: str, *, document: BillDocument):
        super().__init__(message)
        self.document = document


def _build_metrics(parsed_bill: ParsedBill) -> dict:
    metrics = dict(parsed_bill.metrics)
    metrics.pop("file", None)
    return metrics


def recompute_customer_periods(db: Session, customer: Customer) -> None:
    bills = db.scalars(
        select(Bill).where(Bill.customer_id == customer.id).order_by(Bill.bill_date.asc(), Bill.created_at.asc())
    ).all()
    parsed = [
        ParsedBill(
            record_key=bill.record_key,
            record_id=bill.record_id or "",
            bill_number=bill.bill_number,
            bill_date=bill.bill_date,
            due_date=bill.due_date,
            total_amount=bill.total_amount,
            metrics=dict(bill.metrics_json),
        )
        for bill in bills
    ]

    enriched = infer_billing_metadata(parsed)
    period_values: list[int] = []
    bills_by_key = {bill.record_key: bill for bill in bills}
    for item in enriched:
        target = bills_by_key[item["parsed"].record_key]
        target.period_start = item["period_start"]
        target.period_end = item["period_end"]
        target.billing_period_days = item["billing_period_days"]
        target.billing_period_category = item["billing_period_category"]
        if item["billing_period_days"]:
            period_values.append(item["billing_period_days"])

    if period_values:
        customer.billing_cycle_hint_days = int(median(period_values))


def upsert_bill_record(
    db: Session,
    *,
    customer: Customer,
    document: BillDocument,
    parsed_bill: ParsedBill,
    source_type: str,
) -> tuple[Bill, bool]:
    existing = db.scalar(
        select(Bill).where(
            Bill.customer_id == customer.id,
            Bill.record_key == parsed_bill.record_key,
        )
    )
    created = existing is None
    bill = existing or Bill(customer=customer, record_key=parsed_bill.record_key)
    bill.document = document
    bill.record_id = parsed_bill.record_id
    bill.bill_number = parsed_bill.bill_number
    bill.bill_date = parsed_bill.bill_date
    bill.due_date = parsed_bill.due_date
    bill.total_amount = parsed_bill.total_amount
    bill.source_type = source_type
    bill.metrics_json = _build_metrics(parsed_bill)
    if created:
        db.add(bill)
    return bill, created


def save_document(
    db: Session,
    *,
    customer: Customer,
    storage: StorageService,
    filename: str,
    content: bytes,
    media_type: str,
    source_type: str,
) -> tuple[BillDocument, bool]:
    digest = sha256_bytes(content)
    existing = db.scalar(
        select(BillDocument).where(
            BillDocument.customer_id == customer.id,
            BillDocument.sha256 == digest,
        )
    )
    if existing:
        return existing, False

    storage_key = generate_storage_key(f"customers/{customer.id}", filename)
    storage.save_bytes(storage_key, content, media_type)
    document = BillDocument(
        customer_id=customer.id,
        storage_key=storage_key,
        filename=filename,
        media_type=media_type,
        size_bytes=len(content),
        sha256=digest,
        source_type=source_type,
        parser_status="processing",
    )
    try:
        with db.begin_nested():
            db.add(document)
            db.flush()
        return document, True
    except IntegrityError:
        # A concurrent request already inserted the same PDF digest.
        existing = db.scalar(
            select(BillDocument).where(
                BillDocument.customer_id == customer.id,
                BillDocument.sha256 == digest,
            )
        )
        if existing is not None:
            return existing, False
        raise


def import_document(
    db: Session,
    *,
    customer: Customer,
    storage: StorageService,
    filename: str,
    content: bytes,
    media_type: str,
    source_type: str,
) -> tuple[BillDocument, Bill | None, bool]:
    document, created_document = save_document(
        db,
        customer=customer,
        storage=storage,
        filename=filename,
        content=content,
        media_type=media_type,
        source_type=source_type,
    )
    if created_document and document.id is None:
        # Ensure response/error payloads can include a stable document_id
        # even when parsing fails before the request-level commit.
        db.flush()
    new_bill_created = False
    bill: Bill | None = None
    try:
        parsed = parse_pdf_bytes(filename, content)
    except Exception as exc:
        document.parser_status = "failed"
        raise DocumentImportError(str(exc), document=document) from exc

    bill, new_bill_created = upsert_bill_record(
        db,
        customer=customer,
        document=document,
        parsed_bill=parsed,
        source_type=source_type,
    )
    document.parser_status = "parsed"
    recompute_customer_periods(db, customer)
    if new_bill_created:
        notify_new_bill(db, customer, bill)
    return document, bill, new_bill_created or created_document


def sync_customer_from_kseb(db: Session, *, customer: Customer, storage: StorageService) -> tuple[BillDocument, Bill | None, bool]:
    consumer_number = decrypt_text(customer.consumer_number_ciphertext)
    mobile_number = decrypt_text(customer.mobile_number_ciphertext)
    filename, content = fetch_latest_bill_pdf(consumer_number, mobile_number)
    document, bill, created = import_document(
        db,
        customer=customer,
        storage=storage,
        filename=filename,
        content=content,
        media_type="application/pdf",
        source_type="kseb-fetch",
    )
    customer.last_synced_at = utcnow()
    customer.next_sync_check_at = utcnow() + timedelta(days=1)
    return document, bill, created
