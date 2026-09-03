from pathlib import Path

import boto3

from app.config import settings


class StorageService:
    def save_bytes(self, key: str, content: bytes, content_type: str) -> str:  # pragma: no cover - interface
        raise NotImplementedError

    def read_bytes(self, key: str) -> bytes:  # pragma: no cover - interface
        raise NotImplementedError


class LocalStorageService(StorageService):
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, key: str, content: bytes, content_type: str) -> str:
        target = self.root / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return key

    def read_bytes(self, key: str) -> bytes:
        return (self.root / key).read_bytes()


class S3StorageService(StorageService):
    def __init__(self) -> None:
        if not settings.s3_bucket:
            raise ValueError("S3_BUCKET must be configured when STORAGE_BACKEND=s3")
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def save_bytes(self, key: str, content: bytes, content_type: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)
        return key

    def read_bytes(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()


def get_storage_service() -> StorageService:
    if settings.storage_backend == "s3":
        return S3StorageService()
    return LocalStorageService(settings.local_storage_root)
