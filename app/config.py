import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int, *, name: str) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer, got: {value!r}") from exc


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "KSEB Bill Stats")
    app_env: str = os.getenv("APP_ENV", "development")
    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'storage' / 'app.db'}")
    storage_backend: str = os.getenv("STORAGE_BACKEND", "local")
    local_storage_root: Path = Path(os.getenv("LOCAL_STORAGE_ROOT", BASE_DIR / "storage" / "objects"))
    s3_bucket: str | None = os.getenv("S3_BUCKET")
    s3_region: str | None = os.getenv("S3_REGION")
    s3_endpoint_url: str | None = os.getenv("S3_ENDPOINT_URL")
    s3_access_key_id: str | None = os.getenv("S3_ACCESS_KEY_ID")
    s3_secret_access_key: str | None = os.getenv("S3_SECRET_ACCESS_KEY")
    app_secret_key: str = os.getenv("APP_SECRET_KEY", "dev-only-secret-change-me")
    field_encryption_key: str = os.getenv(
        "FIELD_ENCRYPTION_KEY",
        "j9K8hM9u2DLS4ikU3GQ4g3kc14i_Sa2SzVv-L2vFzRM=",
    )
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "kseb_session")
    session_ttl_hours: int = _as_int(os.getenv("SESSION_TTL_HOURS"), 12, name="SESSION_TTL_HOURS")
    session_cookie_secure: bool = _as_bool(os.getenv("SESSION_COOKIE_SECURE"), False)
    upload_max_mb: int = _as_int(os.getenv("UPLOAD_MAX_MB"), 10, name="UPLOAD_MAX_MB")
    lookup_rate_limit: int = _as_int(os.getenv("LOOKUP_RATE_LIMIT"), 10, name="LOOKUP_RATE_LIMIT")
    lookup_rate_window_seconds: int = _as_int(
        os.getenv("LOOKUP_RATE_WINDOW_SECONDS"), 900, name="LOOKUP_RATE_WINDOW_SECONDS"
    )
    sync_check_interval_minutes: int = _as_int(
        os.getenv("SYNC_CHECK_INTERVAL_MINUTES"), 60, name="SYNC_CHECK_INTERVAL_MINUTES"
    )
    worker_poll_seconds: int = _as_int(os.getenv("WORKER_POLL_SECONDS"), 5, name="WORKER_POLL_SECONDS")
    worker_name: str = os.getenv("WORKER_NAME", "worker-1")
    web_push_public_key: str | None = os.getenv("WEB_PUSH_PUBLIC_KEY")
    web_push_private_key: str | None = os.getenv("WEB_PUSH_PRIVATE_KEY")
    web_push_contact: str | None = os.getenv("WEB_PUSH_CONTACT")
    kseb_timeout_seconds: int = _as_int(os.getenv("KSEB_TIMEOUT_SECONDS"), 30, name="KSEB_TIMEOUT_SECONDS")
    kseb_run_live_verification: bool = _as_bool(os.getenv("KSEB_RUN_LIVE_VERIFICATION"), True)


settings = Settings()
