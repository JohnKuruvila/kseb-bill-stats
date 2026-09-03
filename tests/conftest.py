import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_ROOT = Path("/tmp/kseb-bill-stats-tests")
TEST_ROOT.mkdir(parents=True, exist_ok=True)
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session")
def client():
    os_db_path = TEST_ROOT / "test.db"
    objects_path = TEST_ROOT / "objects"
    os.environ["DATABASE_URL"] = f"sqlite:///{os_db_path}"
    os.environ["LOCAL_STORAGE_ROOT"] = str(objects_path)
    os.environ["APP_SECRET_KEY"] = "test-secret"
    os.environ["FIELD_ENCRYPTION_KEY"] = "j9K8hM9u2DLS4ikU3GQ4g3kc14i_Sa2SzVv-L2vFzRM="
    os.environ["KSEB_RUN_LIVE_VERIFICATION"] = "true"
    os.environ["WEB_PUSH_PUBLIC_KEY"] = ""
    os.environ["WEB_PUSH_PRIVATE_KEY"] = ""
    os.environ["WEB_PUSH_CONTACT"] = ""

    # Import after environment variables are in place.
    from app.main import app
    from app.db import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client
