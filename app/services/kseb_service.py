import base64
import secrets
from datetime import datetime

import requests

from app.config import settings


# KSEB migrated its public bill view from the old HTML portal (old.kseb.in)
# to the "consumer mobile" JSON API used by the official KSEB Android app.
# The app logs in anonymously as a "guest" with credentials baked into the
# app (a static checksum plus a fixed PKCE challenge/verifier pair), then
# fetches the latest bill as a base64 PDF. This path needs no captcha.
KSEB_API_BASE = settings.kseb_api_base
KSEB_CHECK_SUM = (
    "03e59e61e772430027b834ceb4c4d72486f832513c8d5f56f28a995339e0d60a4"
    "dc67dd233484d4565990b89b12d72f92dfda0288de4eb6f4ff046f6b57df57"
)
KSEB_GUEST_CHALLENGE = "UJvrxFKr/OmmdBf3UmJ3Y2+u5qNzBJ6KxxsuudPxzV8="
KSEB_GUEST_VERIFIER = "2gq/uRGzP2YXM1lwejTziA=="

# Anonymous guest identity. The real app uses a random per-device id; we do the
# same so requests aren't tied to a consumer number. KSEB caps the value length,
# so keep it short. Override with a stable value via KSEB_GUEST_USER_ID.
KSEB_GUEST_USER_ID = settings.kseb_guest_user_id or secrets.token_hex(6)


class KsebError(RuntimeError):
    """Raised when the KSEB API rejects a request or returns no bill."""


def _post(session: requests.Session, path: str, *, json_body: dict, token: str | None = None, timeout: int) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = session.post(f"{KSEB_API_BASE}/{path}", json=json_body, headers=headers, timeout=timeout)
    if response.status_code >= 500:
        raise KsebError(f"KSEB service unavailable (HTTP {response.status_code}).")
    try:
        payload = response.json()
    except ValueError as exc:
        raise KsebError("KSEB returned a non-JSON response.") from exc
    if not isinstance(payload, dict):
        raise KsebError("KSEB returned an unexpected response.")
    return payload


def _guest_token(session: requests.Session, user_id: str, timeout: int) -> str:
    signature = _post(
        session,
        "auth/getGuestSig",
        json_body={"userId": user_id, "checkSum": KSEB_CHECK_SUM, "password": KSEB_GUEST_CHALLENGE},
        timeout=timeout,
    )
    if signature.get("wsErrorFlag") not in (None, "0") or not signature.get("resultData"):
        raise KsebError(signature.get("wsDisplayMessage") or "KSEB guest handshake failed.")

    auth = _post(
        session,
        "auth/validateGuestUser",
        json_body={
            "userId": user_id,
            "nickName": 0,
            "otpDesc": KSEB_GUEST_VERIFIER,
            "checkSum": KSEB_CHECK_SUM,
        },
        timeout=timeout,
    )
    token = auth.get("token")
    if not token:
        raise KsebError(auth.get("wsDisplayMessage") or "KSEB guest authentication failed.")
    return token


def fetch_latest_bill_pdf(consumer_number: str, registered_mobile: str) -> tuple[str, bytes]:
    timeout = settings.kseb_timeout_seconds
    user_id = KSEB_GUEST_USER_ID
    with requests.Session() as session:
        token = _guest_token(session, user_id, timeout)
        result = _post(
            session,
            "guest/getLastBill",
            json_body={
                "consumerNum": consumer_number,
                "mobile": registered_mobile,
                "userId": user_id,
                "checkSum": KSEB_CHECK_SUM,
            },
            token=token,
            timeout=timeout,
        )

    if result.get("wsErrorFlag") not in (None, "0") or not result.get("resultData"):
        raise KsebError(result.get("wsDisplayMessage") or "KSEB did not return a bill.")

    try:
        content = base64.b64decode(result["resultData"])
    except (ValueError, TypeError) as exc:
        raise KsebError("KSEB returned an invalid bill payload.") from exc

    if not content.startswith(b"%PDF"):
        raise KsebError("KSEB did not return a PDF bill.")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"KsebBill_{consumer_number}_{timestamp}.pdf", content
