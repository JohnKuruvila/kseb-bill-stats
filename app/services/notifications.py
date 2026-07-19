import json

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import Bill, Customer, NotificationEvent, PushSubscription


def push_enabled() -> bool:
    return bool(settings.web_push_public_key and settings.web_push_private_key and settings.web_push_contact)


def create_notification(
    db: Session,
    *,
    customer: Customer,
    bill: Bill | None,
    kind: str,
    title: str,
    body: str,
    channel: str = "in-app",
    dedupe_key: str,
    metadata: dict | None = None,
) -> NotificationEvent:
    existing = db.scalar(select(NotificationEvent).where(NotificationEvent.dedupe_key == dedupe_key))
    if existing:
        return existing

    notification = NotificationEvent(
        customer_id=customer.id,
        bill_id=bill.id if bill else None,
        kind=kind,
        title=title,
        body=body,
        channel=channel,
        dedupe_key=dedupe_key,
        metadata_json=metadata or {},
        status="pending",
    )
    try:
        with db.begin_nested():
            db.add(notification)
            db.flush()
        return notification
    except IntegrityError:
        existing = db.scalar(select(NotificationEvent).where(NotificationEvent.dedupe_key == dedupe_key))
        if existing is not None:
            return existing
        raise


def notify_new_bill(db: Session, customer: Customer, bill: Bill) -> None:
    title = "New KSEB bill fetched"
    body = f"A new bill dated {bill.bill_date.strftime('%d-%m-%Y')} for Rs. {bill.total_amount:.2f} is ready."
    create_notification(
        db,
        customer=customer,
        bill=bill,
        kind="new-bill",
        title=title,
        body=body,
        channel="in-app",
        dedupe_key=f"in-app:new-bill:{customer.id}:{bill.id}",
        metadata={"bill_id": bill.id},
    )

    if not push_enabled():
        return

    subscriptions = db.scalars(
        select(PushSubscription).where(
            PushSubscription.customer_id == customer.id,
            PushSubscription.is_active.is_(True),
        )
    ).all()

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": "/",
            "billId": bill.id,
        }
    )

    for subscription in subscriptions:
        push_note = create_notification(
            db,
            customer=customer,
            bill=bill,
            kind="new-bill",
            title=title,
            body=body,
            channel="push",
            dedupe_key=f"push:new-bill:{bill.id}:{subscription.id}",
            metadata={"subscription_id": subscription.id},
        )
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=settings.web_push_private_key,
                vapid_claims={"sub": settings.web_push_contact},
            )
            subscription.last_success_at = utcnow()
            subscription.last_error = None
            push_note.status = "delivered"
            push_note.delivered_at = utcnow()
        except WebPushException as exc:
            subscription.last_failure_at = utcnow()
            subscription.last_error = str(exc)
            if getattr(exc.response, "status_code", None) in {404, 410}:
                subscription.is_active = False
            push_note.status = "failed"
        except Exception as exc:  # pragma: no cover - defensive runtime fallback
            subscription.last_failure_at = utcnow()
            subscription.last_error = str(exc)
            push_note.status = "failed"
