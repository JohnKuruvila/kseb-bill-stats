import uuid
from datetime import timedelta

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    consumer_number_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    mobile_number_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    consumer_number_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    mobile_number_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    display_consumer_number: Mapped[str] = mapped_column(String(32), nullable=False)
    display_mobile_number: Mapped[str] = mapped_column(String(32), nullable=False)
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    next_sync_check_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    billing_cycle_hint_days: Mapped[int | None] = mapped_column(Integer)

    sessions: Mapped[list["AppSession"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    bills: Mapped[list["Bill"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    documents: Mapped[list["BillDocument"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="customer")
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["NotificationEvent"]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    audit_events: Mapped[list["AuditEvent"]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class AppSession(Base):
    __tablename__ = "app_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    customer: Mapped[Customer] = relationship(back_populates="sessions")

    @classmethod
    def default_expiry(cls) -> DateTime:
        return utcnow() + timedelta(hours=12)


class BillDocument(Base, TimestampMixin):
    __tablename__ = "bill_documents"
    __table_args__ = (UniqueConstraint("customer_id", "sha256", name="uq_bill_document_customer_sha"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    parser_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    customer: Mapped[Customer] = relationship(back_populates="documents")
    bills: Mapped[list["Bill"]] = relationship(back_populates="document")


class Bill(Base, TimestampMixin):
    __tablename__ = "bills"
    __table_args__ = (
        UniqueConstraint("customer_id", "record_key", name="uq_bills_customer_record_key"),
        UniqueConstraint("customer_id", "bill_number", name="uq_bills_customer_bill_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("bill_documents.id", ondelete="SET NULL"))
    record_key: Mapped[str] = mapped_column(String(128), nullable=False)
    record_id: Mapped[str | None] = mapped_column(String(32), index=True)
    bill_number: Mapped[str | None] = mapped_column(String(64))
    bill_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[Date | None] = mapped_column(Date)
    period_start: Mapped[Date | None] = mapped_column(Date)
    period_end: Mapped[Date | None] = mapped_column(Date)
    billing_period_days: Mapped[int | None] = mapped_column(Integer)
    billing_period_category: Mapped[str | None] = mapped_column(String(32))
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    parser_version: Mapped[str] = mapped_column(String(32), default="v2", nullable=False)
    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    customer: Mapped[Customer] = relationship(back_populates="bills")
    document: Mapped[BillDocument | None] = relationship(back_populates="bills")
    notifications: Mapped[list["NotificationEvent"]] = relationship(back_populates="bill")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_status_run_after", "status", "run_after"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    run_after: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    locked_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    worker_name: Mapped[str | None] = mapped_column(String(120))

    customer: Mapped[Customer | None] = relationship(back_populates="jobs")


class PushSubscription(Base, TimestampMixin):
    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("customer_id", "endpoint", name="uq_push_subscription_customer_endpoint"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255))
    last_success_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    last_failure_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    customer: Mapped[Customer] = relationship(back_populates="push_subscriptions")


class NotificationEvent(Base, TimestampMixin):
    __tablename__ = "notification_events"
    __table_args__ = (UniqueConstraint("dedupe_key", name="uq_notification_dedupe_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    bill_id: Mapped[str | None] = mapped_column(ForeignKey("bills.id", ondelete="SET NULL"), index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    delivered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    customer: Mapped[Customer] = relationship(back_populates="notifications")
    bill: Mapped[Bill | None] = relationship(back_populates="notifications")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    detail_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    customer: Mapped[Customer | None] = relationship(back_populates="audit_events")
