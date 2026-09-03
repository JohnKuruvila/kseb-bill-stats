from datetime import date
from pathlib import Path

from app.db import SessionLocal
from app.models import AuditEvent, Customer, PushSubscription


def _mock_sync_customer_from_kseb(db, *, customer, storage):
    customer.last_synced_at = None
    return None, None, True


def _mock_parse_pdf_bytes(filename, content):
    from app.services.parser_service import ParsedBill

    return ParsedBill(
        record_key="record-1",
        record_id="record-1",
        bill_number="123",
        bill_date=date(2025, 3, 1),
        due_date=date(2025, 3, 10),
        total_amount=1234.0,
        metrics={
            "units_imported": 320,
            "units_exported": 40,
            "solar_generation_kwh": 110,
            "normal_import": 320,
            "normal_export": 40,
        },
    )


def _mock_parse_pdf_bytes_mixed(filename, content):
    if b"broken" in content:
        raise ValueError("Bill date could not be parsed.")
    return _mock_parse_pdf_bytes(filename, content)


def _clear_login_rate_events():
    with SessionLocal() as db:
        db.query(AuditEvent).delete()
        db.commit()


def test_login_creates_private_session(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)

    response = client.post(
        "/api/session",
        json={"consumer_number": "1234567890", "mobile_number": "9876543210"},
    )

    assert response.status_code == 200
    assert response.json()["customer_id"]
    assert "kseb_session" in response.cookies


def test_upload_creates_bill_and_dashboard_data(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes)

    login = client.post(
        "/api/session",
        json={"consumer_number": "222233334444", "mobile_number": "9999988888"},
    )
    assert login.status_code == 200

    upload = client.post(
        "/api/uploads",
        files=[("files", ("bill.pdf", b"%PDF-1.4 fake", "application/pdf"))],
    )
    assert upload.status_code == 200
    assert upload.json()["uploads"][0]["parser_status"] == "parsed"

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["totals"]["bill_count"] == 1
    assert body["trend"][0]["total_amount"] == 1234.0


def test_account_export_and_delete(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes)

    login = client.post(
        "/api/session",
        json={"consumer_number": "111122223333", "mobile_number": "9999977777"},
    )
    assert login.status_code == 200

    upload = client.post(
        "/api/uploads",
        files=[("files", ("bill.pdf", b"%PDF-1.4 fake", "application/pdf"))],
    )
    assert upload.status_code == 200

    exported = client.get("/api/account/export")
    assert exported.status_code == 200
    payload = exported.json()
    assert payload["customer"]["masked_consumer_number"].endswith("3333")
    assert len(payload["documents"]) == 1
    document_id = payload["documents"][0]["document_id"]

    download = client.get(f"/api/documents/{document_id}")
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")

    deleted = client.delete("/api/account")
    assert deleted.status_code == 200

    after_delete = client.get("/api/me")
    assert after_delete.status_code == 401


def test_rejects_cross_origin_state_change(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)

    response = client.post(
        "/api/session",
        headers={"origin": "https://evil.example"},
        json={"consumer_number": "12345678", "mobile_number": "9999988888"},
    )

    assert response.status_code == 403


def test_upload_accepts_multiple_pdfs(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes)

    login = client.post(
        "/api/session",
        json={"consumer_number": "123443211234", "mobile_number": "9999966666"},
    )
    assert login.status_code == 200

    upload = client.post(
        "/api/uploads",
        files=[
            ("files", ("bill-1.pdf", b"%PDF-1.4 fake one", "application/pdf")),
            ("files", ("bill-2.pdf", b"%PDF-1.4 fake two", "application/pdf")),
        ],
    )
    assert upload.status_code == 200
    body = upload.json()
    assert len(body["uploads"]) == 2
    assert {item["filename"] for item in body["uploads"]} == {"bill-1.pdf", "bill-2.pdf"}


def test_upload_persists_failed_parse_result(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes_mixed)

    login = client.post(
        "/api/session",
        json={"consumer_number": "555566667777", "mobile_number": "9999955555"},
    )
    assert login.status_code == 200

    upload = client.post(
        "/api/uploads",
        files=[("files", ("broken.pdf", b"%PDF-1.4 broken", "application/pdf"))],
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["uploads"][0]["parser_status"] == "failed"
    assert body["uploads"][0]["document_id"]
    assert body["uploads"][0]["error_message"] == "Bill date could not be parsed."

    exported = client.get("/api/account/export")
    assert exported.status_code == 200
    assert exported.json()["documents"][0]["parser_status"] == "failed"


def test_upload_allows_partial_success_when_one_pdf_fails(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes_mixed)

    login = client.post(
        "/api/session",
        json={"consumer_number": "999900001111", "mobile_number": "9999944444"},
    )
    assert login.status_code == 200

    upload = client.post(
        "/api/uploads",
        files=[
            ("files", ("bill-1.pdf", b"%PDF-1.4 fake one", "application/pdf")),
            ("files", ("broken.pdf", b"%PDF-1.4 broken", "application/pdf")),
        ],
    )
    assert upload.status_code == 200
    body = upload.json()
    assert len(body["uploads"]) == 2
    assert {item["parser_status"] for item in body["uploads"]} == {"parsed", "failed"}

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["totals"]["bill_count"] == 1


def test_login_rate_limit_returns_429(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    _clear_login_rate_events()

    payload = {"consumer_number": "123456789999", "mobile_number": "9999933333"}
    for _ in range(10):
        response = client.post("/api/session", json=payload)
        assert response.status_code == 200
        client.delete("/api/session")

    blocked = client.post("/api/session", json=payload)
    assert blocked.status_code == 429
    assert "Too many attempts" in blocked.json()["detail"]


def test_download_returns_404_when_storage_content_missing(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes)
    _clear_login_rate_events()

    login = client.post(
        "/api/session",
        json={"consumer_number": "121212121212", "mobile_number": "9999911111"},
    )
    assert login.status_code == 200
    customer_id = login.json()["customer_id"]

    upload = client.post(
        "/api/uploads",
        files=[("files", ("bill.pdf", b"%PDF-1.4 fake", "application/pdf"))],
    )
    assert upload.status_code == 200

    exported = client.get("/api/account/export")
    assert exported.status_code == 200
    document_id = exported.json()["documents"][0]["document_id"]

    with SessionLocal() as db:
        customer = db.get(Customer, customer_id)
        document = customer.documents[0]
        from app.config import settings

        target = Path(settings.local_storage_root) / document.storage_key
        target.unlink()

    download = client.get(f"/api/documents/{document_id}")
    assert download.status_code == 404
    assert "not found" in download.json()["detail"].lower()


def test_push_runtime_errors_do_not_break_upload(client, monkeypatch):
    monkeypatch.setattr("app.services.auth.sync_customer_from_kseb", _mock_sync_customer_from_kseb)
    monkeypatch.setattr("app.services.billing.parse_pdf_bytes", _mock_parse_pdf_bytes)
    monkeypatch.setattr("app.services.notifications.push_enabled", lambda: True)
    monkeypatch.setattr("app.services.notifications.webpush", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("boom")))
    _clear_login_rate_events()

    login = client.post(
        "/api/session",
        json={"consumer_number": "343434343434", "mobile_number": "9999922222"},
    )
    assert login.status_code == 200
    me = client.get("/api/me")
    assert me.status_code == 200
    customer_id = me.json()["customer_id"]

    with SessionLocal() as db:
        customer = db.get(Customer, customer_id)
        db.add(
            PushSubscription(
                customer_id=customer.id,
                endpoint="https://push.example/1",
                p256dh="k1",
                auth="a1",
                is_active=True,
            )
        )
        db.commit()

    upload = client.post(
        "/api/uploads",
        files=[("files", ("bill.pdf", b"%PDF-1.4 fake", "application/pdf"))],
    )
    assert upload.status_code == 200
    assert upload.json()["uploads"][0]["parser_status"] == "parsed"
