from sqlalchemy.orm import Session

from app.models import AuditEvent
from app.security import hash_text


def write_audit_event(
    db: Session,
    event_type: str,
    *,
    customer_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        customer_id=customer_id,
        event_type=event_type,
        ip_hash=hash_text(ip_address) if ip_address else None,
        user_agent=user_agent[:255] if user_agent else None,
        detail_json=details or {},
    )
    db.add(event)
    return event
