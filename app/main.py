from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.config import settings
from app.db import Base, engine, get_db
from app.models import Bill, BillDocument, PushSubscription
from app.rate_limit import assert_rate_limit
from app.schemas import (
    AccountExportResponse,
    DashboardResponse,
    MessageResponse,
    PushSubscriptionRequest,
    SessionCreateRequest,
    SessionResponse,
    StatusResponse,
    UploadBatchResponse,
    UploadResponse,
)
from app.security import normalize_digits
from app.services.auth import create_or_verify_customer, create_session, delete_session, get_current_customer_from_request
from app.services.billing import DocumentImportError, import_document, sync_customer_from_kseb
from app.services.notifications import push_enabled
from app.services.stats import build_dashboard, derive_bill_view
from app.storage import get_storage_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.local_storage_root.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
web_root = Path(__file__).resolve().parent / "web"
storage = get_storage_service()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") != settings.public_base_url.rstrip("/"):
            return Response(status_code=403, content="Cross-origin requests are not allowed.")
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    if settings.app_env != "development":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


def get_current_customer(request: Request, db: Session = Depends(get_db)):
    return get_current_customer_from_request(db, request)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "push": push_enabled()}


@app.post("/api/session", response_model=SessionResponse)
def login(payload: SessionCreateRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        assert_rate_limit(db, request.client.host if request.client else "unknown", "login_attempt")
        write_audit_event(
            db,
            "login_attempt",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={},
        )
        customer, created = create_or_verify_customer(
            db,
            consumer_number=payload.consumer_number,
            mobile_number=payload.mobile_number,
            request=request,
            storage=storage,
        )
        session = create_session(db, customer=customer, request=request)
        write_audit_event(
            db,
            "login_success",
            customer_id=customer.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"created_customer": created},
        )
        db.commit()
        response.set_cookie(
            settings.session_cookie_name,
            session.id,
            httponly=True,
            secure=settings.session_cookie_secure,
            samesite="strict",
            max_age=settings.session_ttl_hours * 3600,
            path="/",
        )
        return SessionResponse(
            customer_id=customer.id,
            masked_consumer_number=customer.display_consumer_number,
            masked_mobile_number=customer.display_mobile_number,
            has_push_support=push_enabled(),
        )
    except HTTPException as exc:
        db.rollback()
        write_audit_event(
            db,
            "login_attempt",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"outcome": "failed", "reason": exc.detail},
        )
        db.commit()
        raise
    except Exception as exc:  # pragma: no cover - protective path
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to sign in right now. Please try again.") from exc


@app.delete("/api/session", response_model=MessageResponse)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    delete_session(db, request)
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return MessageResponse(message="Logged out.")


@app.get("/api/me", response_model=SessionResponse)
def me(customer=Depends(get_current_customer)):
    return SessionResponse(
        customer_id=customer.id,
        masked_consumer_number=customer.display_consumer_number,
        masked_mobile_number=customer.display_mobile_number,
        has_push_support=push_enabled(),
    )


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    return DashboardResponse(**build_dashboard(db, customer))


@app.get("/api/bills")
def bills(customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    rows = db.scalars(select(Bill).where(Bill.customer_id == customer.id).order_by(Bill.bill_date.asc())).all()
    return [derive_bill_view(row) for row in rows]


@app.get("/api/documents/{document_id}")
def download_document(document_id: str, customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    document = db.scalar(
        select(BillDocument).where(
            BillDocument.id == document_id,
            BillDocument.customer_id == customer.id,
        )
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        content = storage.read_bytes(document.storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Document content not found.") from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=503, detail="Document storage is temporarily unavailable.") from exc
    headers = {"Content-Disposition": f'attachment; filename="{document.filename}"'}
    return Response(content=content, media_type=document.media_type, headers=headers)


@app.post("/api/uploads", response_model=UploadBatchResponse)
async def upload_bill(
    request: Request,
    files: list[UploadFile] = File(...),
    customer=Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one PDF.")

    try:
        uploads: list[UploadResponse] = []
        for file in files:
            filename = file.filename or "uploaded-bill.pdf"
            content = await file.read()

            try:
                if file.content_type not in {"application/pdf", "application/octet-stream"}:
                    raise ValueError("Only PDF uploads are supported.")
                if not content.startswith(b"%PDF"):
                    raise ValueError("The uploaded file is not a valid PDF.")
                if len(content) > settings.upload_max_mb * 1024 * 1024:
                    raise ValueError(f"Uploads are limited to {settings.upload_max_mb} MB.")

                document, _, _ = import_document(
                    db,
                    customer=customer,
                    storage=storage,
                    filename=filename,
                    content=content,
                    media_type="application/pdf",
                    source_type="upload",
                )
                write_audit_event(
                    db,
                    "upload_success",
                    customer_id=customer.id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    details={"filename": file.filename, "size": len(content)},
                )
                uploads.append(
                    UploadResponse(
                        document_id=document.id,
                        parser_status=document.parser_status,
                        filename=document.filename,
                    )
                )
                db.commit()
            except DocumentImportError as exc:
                write_audit_event(
                    db,
                    "upload_failed",
                    customer_id=customer.id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    details={"filename": file.filename, "size": len(content), "reason": str(exc)},
                )
                uploads.append(
                    UploadResponse(
                        document_id=exc.document.id,
                        parser_status=exc.document.parser_status,
                        filename=exc.document.filename,
                        error_message=str(exc),
                    )
                )
                db.commit()
            except ValueError as exc:
                write_audit_event(
                    db,
                    "upload_failed",
                    customer_id=customer.id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    details={"filename": file.filename, "size": len(content), "reason": str(exc)},
                )
                uploads.append(
                    UploadResponse(
                        parser_status="failed",
                        filename=filename,
                        error_message=str(exc),
                    )
                )
                db.commit()

        return UploadBatchResponse(uploads=uploads)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Upload failed due to an unexpected server error.") from exc


@app.post("/api/sync", response_model=MessageResponse)
def sync_now(request: Request, customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    try:
        sync_customer_from_kseb(db, customer=customer, storage=storage)
        write_audit_event(
            db,
            "sync_triggered",
            customer_id=customer.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={},
        )
        db.commit()
        return MessageResponse(message="Sync completed.")
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Sync failed. Please try again shortly.") from exc


@app.get("/api/status", response_model=StatusResponse)
def status(customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    active_documents = db.scalar(
        select(func.count(BillDocument.id)).where(BillDocument.customer_id == customer.id)
    ) or 0
    active_bills = db.scalar(select(func.count(Bill.id)).where(Bill.customer_id == customer.id)) or 0
    latest_bill_date = db.scalar(
        select(Bill.bill_date).where(Bill.customer_id == customer.id).order_by(Bill.bill_date.desc()).limit(1)
    )
    return StatusResponse(
        customer_id=customer.id,
        last_synced_at=customer.last_synced_at,
        next_sync_check_at=customer.next_sync_check_at,
        active_documents=active_documents,
        active_bills=active_bills,
        latest_bill_date=latest_bill_date,
    )


@app.get("/api/account/export", response_model=AccountExportResponse)
def export_account(customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    documents = db.scalars(
        select(BillDocument).where(BillDocument.customer_id == customer.id).order_by(BillDocument.created_at.asc())
    ).all()
    dashboard_payload = build_dashboard(db, customer)
    return AccountExportResponse(
        customer={
            "customer_id": customer.id,
            "masked_consumer_number": customer.display_consumer_number,
            "masked_mobile_number": customer.display_mobile_number,
            "billing_cycle_hint_days": customer.billing_cycle_hint_days,
            "last_synced_at": customer.last_synced_at,
            "created_at": customer.created_at,
        },
        bills=dashboard_payload["trend"],
        documents=[
            {
                "document_id": document.id,
                "filename": document.filename,
                "source_type": document.source_type,
                "parser_status": document.parser_status,
                "created_at": document.created_at,
                "size_bytes": document.size_bytes,
            }
            for document in documents
        ],
        notifications=dashboard_payload["notifications"],
    )


@app.delete("/api/account", response_model=MessageResponse)
def delete_account(request: Request, response: Response, customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    write_audit_event(
        db,
        "account_deleted",
        customer_id=customer.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={},
    )
    db.delete(customer)
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return MessageResponse(message="Account and stored data deleted.")


@app.get("/api/push/public-key")
def push_public_key():
    return {"enabled": push_enabled(), "publicKey": settings.web_push_public_key}


@app.post("/api/push/subscribe", response_model=MessageResponse)
def push_subscribe(
    payload: PushSubscriptionRequest,
    request: Request,
    customer=Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if not push_enabled():
        raise HTTPException(status_code=503, detail="Push notifications are not configured on this server.")

    subscription = db.scalar(
        select(PushSubscription).where(
            PushSubscription.customer_id == customer.id,
            PushSubscription.endpoint == payload.endpoint,
        )
    )
    if subscription is None:
        subscription = PushSubscription(
            customer=customer,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        )
        db.add(subscription)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            subscription = db.scalar(
                select(PushSubscription).where(
                    PushSubscription.customer_id == customer.id,
                    PushSubscription.endpoint == payload.endpoint,
                )
            )
            if subscription is None:
                raise HTTPException(status_code=503, detail="Could not save push subscription. Please retry.")
            subscription.p256dh = payload.keys.p256dh
            subscription.auth = payload.keys.auth
            subscription.is_active = True
    else:
        subscription.p256dh = payload.keys.p256dh
        subscription.auth = payload.keys.auth
        subscription.is_active = True
    db.commit()
    return MessageResponse(message="Push subscription saved.")


@app.get("/api/normalize")
def normalize_preview(consumer_number: str, mobile_number: str):
    return {
        "consumer_number": normalize_digits(consumer_number),
        "mobile_number": normalize_digits(mobile_number),
    }


@app.get("/robots.txt", include_in_schema=False)
def robots_txt() -> Response:
    base_url = settings.public_base_url.rstrip("/")
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /docs/",
            "Disallow: /redoc/",
            "Disallow: /openapi.json",
            "",
            f"Sitemap: {base_url}/sitemap.xml",
            "",
        ]
    )
    return Response(content=content, media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml() -> Response:
    base_url = settings.public_base_url.rstrip("/")
    # Keep sitemap minimal: the homepage is the primary SEO target.
    content = "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            f"  <url><loc>{base_url}/</loc></url>",
            "</urlset>",
            "",
        ]
    )
    return Response(content=content, media_type="application/xml")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(web_root / "index.html")


@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(web_root / "sw.js")


app.mount("/", StaticFiles(directory=web_root), name="web")
