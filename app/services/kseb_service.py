import re
from datetime import datetime
from pathlib import Path

import requests

from app.config import settings


LANDING_URL = "https://old.kseb.in/billview/"
SUBMIT_URL = "https://old.kseb.in/billview/index.php"


def extract_okey(html: str) -> str:
    patterns = [
        r"name=['\"]okey['\"][^>]*value=['\"]([^'\"]+)['\"]",
        r"value=['\"]([^'\"]+)['\"][^>]*name=['\"]okey['\"]",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return match.group(1)
    raise ValueError("Could not find the KSEB form token in the response page.")


def looks_like_pdf(response: requests.Response) -> bool:
    content_type = response.headers.get("content-type", "").lower()
    return "application/pdf" in content_type or response.content.startswith(b"%PDF")


def resolve_pdf_filename(response: requests.Response) -> str:
    content_disposition = response.headers.get("content-disposition", "")
    match = re.search(r'filename="?([^";]+)"?', content_disposition, re.IGNORECASE)
    if match:
        return Path(match.group(1)).name
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"kseb-bill-{timestamp}.pdf"


def fetch_latest_bill_pdf(consumer_number: str, registered_mobile: str) -> tuple[str, bytes]:
    with requests.Session() as session:
        landing_response = session.get(LANDING_URL, timeout=settings.kseb_timeout_seconds)
        landing_response.raise_for_status()
        okey = extract_okey(landing_response.text)

        pdf_response = session.post(
            SUBMIT_URL,
            data={
                "consumerno": consumer_number,
                "regmobno": registered_mobile,
                "okey": okey,
                "b_submit_0": "View+Bill",
            },
            timeout=settings.kseb_timeout_seconds,
        )
        pdf_response.raise_for_status()

    if not looks_like_pdf(pdf_response):
        snippet = pdf_response.text[:200].strip().replace("\n", " ")
        raise ValueError(f"KSEB did not return a PDF. Response started with: {snippet}")

    return resolve_pdf_filename(pdf_response), pdf_response.content
