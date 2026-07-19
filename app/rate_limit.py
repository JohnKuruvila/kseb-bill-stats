from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import AuditEvent
from app.security import hash_text


def assert_rate_limit(db: Session, key: str, event_type: str) -> None:
    since = utcnow() - timedelta(seconds=settings.lookup_rate_window_seconds)
    rows = db.scalars(
        select(AuditEvent.id).where(
            AuditEvent.event_type == event_type,
            AuditEvent.ip_hash == hash_text(key),
            AuditEvent.created_at >= since,
        )
    ).all()
    if len(rows) >= settings.lookup_rate_limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait before trying again.")
