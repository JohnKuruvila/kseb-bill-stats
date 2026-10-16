import hashlib
import hmac
import secrets

from cryptography.fernet import Fernet

from app.config import settings


_fernet = Fernet(settings.field_encryption_key.encode("utf-8"))


def normalize_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def hash_lookup_value(value: str) -> str:
    normalized = normalize_digits(value)
    digest = hmac.new(
        settings.app_secret_key.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def hash_text(value: str) -> str:
    return hmac.new(
        settings.app_secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def mask_consumer_number(value: str) -> str:
    digits = normalize_digits(value)
    if len(digits) <= 4:
        return digits
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


def mask_mobile_number(value: str) -> str:
    digits = normalize_digits(value)
    if len(digits) <= 4:
        return digits
    return f"{digits[:2]}{'*' * max(len(digits) - 4, 0)}{digits[-2:]}"


def encrypt_text(value: str) -> str:
    return _fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str) -> str:
    return _fernet.decrypt(value.encode("utf-8")).decode("utf-8")


def generate_session_id() -> str:
    return secrets.token_urlsafe(48)


def generate_storage_key(prefix: str, filename: str) -> str:
    safe_name = "".join(ch for ch in filename if ch.isalnum() or ch in {".", "-", "_"}).strip(".")
    safe_name = safe_name or "document.pdf"
    return f"{prefix}/{secrets.token_hex(12)}-{safe_name}"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
