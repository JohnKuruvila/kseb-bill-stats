from datetime import timedelta

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.config import settings
from app.db import utcnow
from app.models import AppSession, Customer
from app.security import (
    encrypt_text,
    generate_session_id,
    hash_lookup_value,
    hash_text,
    mask_consumer_number,
    mask_mobile_number,
    normalize_digits,
)
from app.services.billing import sync_customer_from_kseb
from app.storage import StorageService


def create_or_verify_customer(
    db: Session,
    *,
    consumer_number: str,
    mobile_number: str,
    request: Request,
    storage: StorageService,
) -> tuple[Customer, bool]:
    normalized_consumer = normalize_digits(consumer_number)
    normalized_mobile = normalize_digits(mobile_number)
    if len(normalized_consumer) < 4 or len(normalized_mobile) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid consumer number and mobile number.")

    consumer_hash = hash_lookup_value(normalized_consumer)
    mobile_hash = hash_lookup_value(normalized_mobile)

    customer = db.scalar(select(Customer).where(Customer.consumer_number_hash == consumer_hash))
    created = False
    if customer is not None:
        if customer.mobile_number_hash != mobile_hash:
            write_audit_event(
                db,
                "login_failed",
                customer_id=customer.id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                details={"reason": "mobile_mismatch"},
            )
            raise HTTPException(status_code=401, detail="The consumer number and mobile number do not match.")
        return customer, created

    if not settings.kseb_run_live_verification:
        raise HTTPException(status_code=503, detail="Live KSEB verification is disabled on this server.")

    customer = Customer(
        consumer_number_hash=consumer_hash,
        mobile_number_hash=mobile_hash,
        consumer_number_ciphertext=encrypt_text(normalized_consumer),
        mobile_number_ciphertext=encrypt_text(normalized_mobile),
        display_consumer_number=mask_consumer_number(normalized_consumer),
        display_mobile_number=mask_mobile_number(normalized_mobile),
    )
    try:
        with db.begin_nested():
            db.add(customer)
            db.flush()
    except IntegrityError:
        # Another request created the same customer concurrently.
        customer = db.scalar(select(Customer).where(Customer.consumer_number_hash == consumer_hash))
        if customer is None:
            raise HTTPException(status_code=503, detail="Please try again.")
        if customer.mobile_number_hash != mobile_hash:
            raise HTTPException(status_code=401, detail="The consumer number and mobile number do not match.")
        return customer, False

    try:
        sync_customer_from_kseb(db, customer=customer, storage=storage)
    except Exception as exc:
        db.delete(customer)
        raise HTTPException(
            status_code=503,
            detail="KSEB verification is temporarily unavailable. Please try again.",
        ) from exc
    created = True
    return customer, created


def create_session(db: Session, *, customer: Customer, request: Request) -> AppSession:
    session = AppSession(
        id=generate_session_id(),
        customer=customer,
        ip_hash=hash_text(request.client.host) if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        expires_at=utcnow() + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    customer.last_login_at = utcnow()
    return session


def get_current_customer_from_request(db: Session, request: Request) -> Customer:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    app_session = db.scalar(
        select(AppSession).where(
            AppSession.id == session_id,
            AppSession.expires_at >= utcnow(),
        )
    )
    if app_session is None:
        raise HTTPException(status_code=401, detail="Session expired.")

    app_session.last_seen_at = utcnow()
    customer = app_session.customer
    if customer is None or not customer.is_active:
        raise HTTPException(status_code=401, detail="Account inactive.")
    return customer


def delete_session(db: Session, request: Request) -> None:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        return
    app_session = db.get(AppSession, session_id)
    if app_session is not None:
        db.delete(app_session)
