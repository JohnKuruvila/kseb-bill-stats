import argparse
import os
import re
from datetime import datetime
from pathlib import Path

import requests

from parse_kseb_bill import (
    ensure_exportable,
    ensure_safe_raw_json_path,
    export_bills,
    parse_folder,
    write_json,
)


LANDING_URL = "https://old.kseb.in/billview/"
SUBMIT_URL = "https://old.kseb.in/billview/index.php"
DEFAULT_PDF_DIR = "kseb-bills"
DEFAULT_JSON_PATH = "dashboard/data/bills.json"
DEFAULT_CSV_PATH = "dashboard/data/bills.csv"
DEFAULT_TIMEOUT_SECONDS = 30


def extract_okey(html):
    patterns = [
        r"name=['\"]okey['\"][^>]*value=['\"]([^'\"]+)['\"]",
        r"value=['\"]([^'\"]+)['\"][^>]*name=['\"]okey['\"]",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return match.group(1)
    raise ValueError("Could not find the KSEB form token in the response page.")


def looks_like_pdf(response):
    content_type = response.headers.get("content-type", "").lower()
    return "application/pdf" in content_type or response.content.startswith(b"%PDF")


def resolve_pdf_filename(response):
    content_disposition = response.headers.get("content-disposition", "")
    match = re.search(r'filename="?([^";]+)"?', content_disposition, re.IGNORECASE)
    if match:
        return Path(match.group(1)).name
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"kseb-bill-{timestamp}.pdf"


def download_latest_bill(consumer_number, registered_mobile, output_dir=DEFAULT_PDF_DIR):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        landing_response = session.get(LANDING_URL, timeout=DEFAULT_TIMEOUT_SECONDS)
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
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
        pdf_response.raise_for_status()

    if not looks_like_pdf(pdf_response):
        snippet = pdf_response.text[:200].strip().replace("\n", " ")
        raise ValueError(f"KSEB did not return a PDF. Response started with: {snippet}")

    file_path = output_path / resolve_pdf_filename(pdf_response)
    file_path.write_bytes(pdf_response.content)
    return file_path


def parse_and_export(folder, json_path, csv_path, raw_json_path=None, include_sensitive=False):
    result = parse_folder(folder)
    ensure_exportable(result)
    bills = result.bills
    if raw_json_path:
        ensure_safe_raw_json_path(raw_json_path)
        write_json(bills, raw_json_path)
    exported_bills = export_bills(
        bills,
        json_path=json_path,
        csv_path=csv_path,
        include_sensitive=include_sensitive,
    )
    return bills, exported_bills


def resolve_value(cli_value, env_name):
    return cli_value or os.getenv(env_name)


def add_export_arguments(command):
    command.add_argument("--pdf-dir", default=DEFAULT_PDF_DIR, help="Folder that stores downloaded bill PDFs.")
    command.add_argument("--json", default=DEFAULT_JSON_PATH, help="Path to the dashboard JSON export.")
    command.add_argument("--csv", default=DEFAULT_CSV_PATH, help="Path to the dashboard CSV export.")
    command.add_argument(
        "--raw-json",
        help="Optional path for a local raw JSON export outside dashboard/ (for example: exports/bills.raw.json).",
    )
    command.add_argument(
        "--include-sensitive",
        action="store_true",
        help="Write raw parsed fields to the main JSON/CSV outputs instead of the default export.",
    )


def build_parser():
    parser = argparse.ArgumentParser(
        description="Download the latest KSEB bill PDF, parse archived bills, and refresh the dashboard data."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    download_parser = subparsers.add_parser("download", help="Download the latest KSEB bill PDF only.")
    download_parser.add_argument("--consumer-number", help="KSEB consumer number. Falls back to KSEB_CONSUMER_NUMBER.")
    download_parser.add_argument(
        "--registered-mobile",
        help="Registered mobile number. Falls back to KSEB_REGISTERED_MOBILE.",
    )
    download_parser.add_argument("--pdf-dir", default=DEFAULT_PDF_DIR, help="Folder to save downloaded PDFs.")

    parse_parser = subparsers.add_parser("parse", help="Parse all downloaded PDFs and refresh the exports.")
    add_export_arguments(parse_parser)

    sync_parser = subparsers.add_parser("sync", help="Download the latest bill and rebuild the exports.")
    sync_parser.add_argument("--consumer-number", help="KSEB consumer number. Falls back to KSEB_CONSUMER_NUMBER.")
    sync_parser.add_argument(
        "--registered-mobile",
        help="Registered mobile number. Falls back to KSEB_REGISTERED_MOBILE.",
    )
    add_export_arguments(sync_parser)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "download":
        consumer_number = resolve_value(args.consumer_number, "KSEB_CONSUMER_NUMBER")
        registered_mobile = resolve_value(args.registered_mobile, "KSEB_REGISTERED_MOBILE")
        if not consumer_number or not registered_mobile:
            parser.error(
                "download requires --consumer-number and --registered-mobile, or the matching KSEB_* environment variables."
            )

        file_path = download_latest_bill(consumer_number, registered_mobile, args.pdf_dir)
        print(f"Saved latest bill to: {file_path}")
        return

    if args.command == "parse":
        bills, exported_bills = parse_and_export(
            folder=args.pdf_dir,
            json_path=args.json,
            csv_path=args.csv,
            raw_json_path=args.raw_json,
            include_sensitive=args.include_sensitive,
        )
        print(f"Parsed {len(bills)} bills from: {args.pdf_dir}")
        print(f"Wrote {len(exported_bills)} bills to: {args.json}")
        print(f"CSV saved to: {args.csv}")
        if args.raw_json:
            print(f"Raw JSON saved to: {args.raw_json}")
        return

    consumer_number = resolve_value(args.consumer_number, "KSEB_CONSUMER_NUMBER")
    registered_mobile = resolve_value(args.registered_mobile, "KSEB_REGISTERED_MOBILE")
    if not consumer_number or not registered_mobile:
        parser.error(
            "sync requires --consumer-number and --registered-mobile, or the matching KSEB_* environment variables."
        )

    file_path = download_latest_bill(consumer_number, registered_mobile, args.pdf_dir)
    bills, exported_bills = parse_and_export(
        folder=args.pdf_dir,
        json_path=args.json,
        csv_path=args.csv,
        raw_json_path=args.raw_json,
        include_sensitive=args.include_sensitive,
    )
    print(f"Downloaded latest bill to: {file_path}")
    print(f"Parsed {len(bills)} bills from: {args.pdf_dir}")
    print(f"Wrote {len(exported_bills)} bills to: {args.json}")
    print(f"CSV saved to: {args.csv}")
    if args.raw_json:
        print(f"Raw JSON saved to: {args.raw_json}")


if __name__ == "__main__":
    main()
