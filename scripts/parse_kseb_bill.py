import argparse
import csv
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from pdfminer.high_level import extract_text


DEFAULT_PDF_DIR = "kseb-bills"
DEFAULT_JSON_PATH = "dashboard/data/bills.json"
DEFAULT_CSV_PATH = "dashboard/data/bills.csv"
SERVED_DASHBOARD_DIR = (Path(__file__).resolve().parent.parent / "dashboard").resolve()


ZONE_PATTERNS = {
    "normal_import": r"KWH\s*Normal\s*Import",
    "normal_export": r"KWH\s*Normal\s*Export",
    "offpeak_import": r"KWH\s*Off\s*Peak\s*Import",
    "offpeak_export": r"KWH\s*Off\s*Peak\s*Export",
    "peak_import": r"KWH\s*Peak\s*Import",
    "peak_export": r"KWH\s*Peak\s*Export",
}

SOLAR_ZONE_PATTERNS = {
    "solar_generation_normal": "WNL",
    "solar_generation_offpeak": "WOP",
    "solar_generation_peak": "WPK",
}

DEFAULT_EXPORT_FIELDS = [
    "record_id",
    "bill_date",
    "due_date",
    "connected_load_watts",
    "solar_capacity_kw",
    "units_imported",
    "units_exported",
    "billed_consumption",
    "normal_import",
    "normal_export",
    "offpeak_import",
    "offpeak_export",
    "peak_import",
    "peak_export",
    "solar_generation_normal",
    "solar_generation_offpeak",
    "solar_generation_peak",
    "net_grid_consumption",
    "solar_generation_kwh",
    "fixed_charge",
    "energy_charge",
    "electricity_duty",
    "meter_rent",
    "total_amount",
    "estimated_daily_solar_kwh",
]

COMPLETENESS_KEYS = [
    "units_imported",
    "units_exported",
    "billed_consumption",
    "net_grid_consumption",
    "solar_generation_kwh",
    "fixed_charge",
    "energy_charge",
    "electricity_duty",
    "meter_rent",
    "total_amount",
]

DATE_PATTERN = re.compile(r"^\d{2}-\d{2}-\d{4}$")


@dataclass
class ParseIssue:
    file: str
    message: str


@dataclass
class ParseFolderResult:
    folder: Path
    pdf_count: int
    bills: list = field(default_factory=list)
    failures: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    duplicates: list = field(default_factory=list)


def extract(pattern, text, cast=str):
    match = re.search(pattern, text, re.MULTILINE)
    return cast(match.group(1)) if match else None


def extract_delta(pattern, text):
    match = re.search(
        rf"{pattern}\s+([\d\.]+)\s+([\d\.]+)\s+\d+\s+(?:\d+|\(Nil\))",
        text,
        re.MULTILINE,
    )
    if not match:
        return None

    start = float(match.group(1))
    end = float(match.group(2))
    return int(round(end - start))


def extract_solar_delta(zone_code, text):
    solar_idx = text.find("Solar Generation")
    if solar_idx == -1:
        return None

    solar_text = text[solar_idx:]
    match = re.search(
        rf"\d{{2}}-\d{{2}}-\d{{4}}\s*{zone_code}\s*[A-Z]\s*([\d\.]+)\s*([\d\.]+)\s*\d+\s*(?:\d+|\(Nil\))",
        solar_text,
        re.MULTILINE,
    )
    if not match:
        return None

    start = float(match.group(1))
    end = float(match.group(2))
    return int(round(end - start))


def parse_zone_block(text):
    match = re.search(r"Trading([\s\S]+?)\s+\d+\s*/\s*\d+", text)
    if not match:
        return {}

    block = match.group(1)
    tokens = re.findall(r"\(Nil\)|\d+\.\d+|\d+", block)
    if len(tokens) < 24:
        return {}

    reading_tokens = tokens[:12]
    unit_tokens = tokens[-6:]
    fields = [
        "normal_import",
        "normal_export",
        "offpeak_import",
        "offpeak_export",
        "peak_import",
        "peak_export",
    ]

    values = {}
    for index, field in enumerate(fields):
        start = float(reading_tokens[index * 2])
        end = float(reading_tokens[index * 2 + 1])
        unit_token = unit_tokens[index]
        values[field] = int(round(end - start)) if unit_token == "(Nil)" else int(float(unit_token))

    return values


def extract_charge_fallbacks(text):
    sections = [
        r"Net Payable[\s\S]*?(?=Senior Superintendent|Page\s+\d|$)",
        r"Payable amt.*?(?=Demand for|E&OE)",
        r"Total Amt\.\(Bill#.*?(?=Demand for|Net Payable|E&OE)",
    ]
    for pattern in sections:
        match = re.search(pattern, text, re.DOTALL)
        amounts = re.findall(r"(\d+\.\d+)", match.group(0)) if match else []
        if len(amounts) >= 11:
            return {
                "fixed_charge": float(amounts[0]),
                "energy_charge": float(amounts[2]),
                "electricity_duty": float(amounts[5]),
                "meter_rent": float(amounts[6]),
                "total_amount": float(amounts[10]),
            }
    return {}


def choose_first(*values):
    for value in values:
        if value is not None:
            return value
    return None


def parse_bill_date(value):
    if not value:
        return (9999, 12, 31)

    try:
        day, month, year = value.split("-")
        return (int(year), int(month), int(day))
    except (AttributeError, TypeError, ValueError):
        return (9999, 12, 31)


def completeness_score(bill):
    return sum(bill.get(key) is not None for key in COMPLETENESS_KEYS)


def bill_selection_key(bill):
    return (
        completeness_score(bill),
        int(bool(bill.get("bill_number"))),
        int(all([bill.get("consumer_number"), bill.get("meter_number"), bill.get("bill_date")])),
        int(bool(bill.get("due_date"))),
        int(bool(bill.get("solar_capacity_kw"))),
    )


def build_bill_identity(bill):
    if bill.get("bill_number"):
        return f"bill:{bill['bill_number']}"

    consumer_cycle = [
        bill.get("consumer_number"),
        bill.get("meter_number"),
        bill.get("bill_date"),
    ]
    if all(consumer_cycle):
        return "cycle:" + "|".join(consumer_cycle)

    identity_fallback = [
        bill.get("bill_date"),
        bill.get("total_amount"),
        bill.get("units_imported"),
        bill.get("units_exported"),
        bill.get("solar_generation_kwh"),
    ]
    if any(value is not None for value in identity_fallback):
        return "fallback:" + "|".join("" if value is None else str(value) for value in identity_fallback)

    return f"file:{bill.get('file', 'unknown')}"


def has_strong_bill_identity(bill):
    return bool(bill.get("bill_number")) or all(
        [bill.get("consumer_number"), bill.get("meter_number"), bill.get("bill_date")]
    )


def validate_bill(bill):
    errors = []
    warnings = []

    bill_date = bill.get("bill_date")
    if not isinstance(bill_date, str) or not DATE_PATTERN.fullmatch(bill_date):
        errors.append("missing or invalid bill_date")

    if bill.get("total_amount") is None:
        errors.append("missing total_amount")

    if not has_strong_bill_identity(bill):
        errors.append("missing bill identity")

    if bill.get("due_date") is None:
        warnings.append("missing due_date")

    if bill.get("solar_capacity_kw") is None:
        warnings.append("missing solar_capacity_kw")

    if bill.get("units_imported") is None:
        warnings.append("missing units_imported")

    if bill.get("units_exported") is None:
        warnings.append("missing units_exported")

    return errors, warnings


def build_record_id(bill):
    record_values = [
        bill.get("bill_date"),
        bill.get("due_date"),
        bill.get("total_amount"),
        bill.get("units_imported"),
        bill.get("units_exported"),
        bill.get("solar_generation_kwh"),
        bill.get("billed_consumption"),
    ]
    digest = hashlib.sha1(
        "|".join("" if value is None else str(value) for value in record_values).encode("utf-8")
    ).hexdigest()
    return digest[:12]


def parse_kseb_bill(pdf_path):
    text = extract_text(pdf_path)

    data = {
        "file": Path(pdf_path).name,
        "consumer_number": extract(r"Consumer#\s*(\d+)", text),
        "bill_number": extract(r"Bill#\s*(\d+)", text),
        "bill_date": extract(r"Bill Date\s*(\d{2}-\d{2}-\d{4})", text),
        "due_date": extract(r"Due Date\s*(\d{2}-\d{2}-\d{4})", text),
        "connected_load_watts": extract(r"Connected Load\s*(\d+)\s*Watts", text, int),
        "solar_capacity_kw": extract(r"Plant Capacity\s*([\d\.]+)\s*KW", text, float),
        "meter_number": extract(r"Meter#\s*([A-Z0-9]+)", text),
        "units_imported": extract(r"Units Imported\s*(\d+)", text, int),
        "units_exported": extract(r"Units Exported\s*(\d+)", text, int),
        "billed_consumption": extract(r"Billed Consumption\s*(\d+)", text, int),
    }

    for key, pattern in ZONE_PATTERNS.items():
        data[key] = extract_delta(pattern, text)

    for key, value in parse_zone_block(text).items():
        data[key] = choose_first(data.get(key), value)

    for key, zone_code in SOLAR_ZONE_PATTERNS.items():
        data[key] = extract_solar_delta(zone_code, text)

    zone_imports = [
        data["normal_import"],
        data["offpeak_import"],
        data["peak_import"],
    ]
    zone_exports = [
        data["normal_export"],
        data["offpeak_export"],
        data["peak_export"],
    ]

    if all(value is not None for value in zone_imports):
        data["units_imported"] = choose_first(data["units_imported"], sum(zone_imports))

    if all(value is not None for value in zone_exports):
        data["units_exported"] = choose_first(data["units_exported"], sum(zone_exports))

    if data["units_imported"] is not None and data["units_exported"] is not None:
        data["net_grid_consumption"] = data["units_imported"] - data["units_exported"]
        data["billed_consumption"] = choose_first(
            data["billed_consumption"],
            data["net_grid_consumption"],
        )
    else:
        data["net_grid_consumption"] = None

    solar_generation_parts = [
        data["solar_generation_normal"],
        data["solar_generation_offpeak"],
        data["solar_generation_peak"],
    ]
    data["solar_generation_kwh"] = (
        sum(value or 0 for value in solar_generation_parts)
        if any(value is not None for value in solar_generation_parts)
        else None
    )

    data["fixed_charge"] = extract(r"Fixed Charge\[FC\]\s*([\d\.]+)", text, float)
    data["energy_charge"] = extract(
        r"Energy Charge[^\[]*\[(?:EC|ECO)\]\s*([\d\.]+)", text, float
    )
    data["electricity_duty"] = extract(
        r"Electricity Duty\[ED\]\s*([\d\.]+)", text, float
    )
    data["meter_rent"] = extract(r"Meter Rent\[MR\]\s*([\d\.]+)", text, float)
    data["total_amount"] = extract(r"Total Amt\.\(Bill#.*?\)\s*([\d\.]+)", text, float)

    if data["total_amount"] is None:
        data["total_amount"] = extract(
            r"Payable amt\.\(excluding ACD\).*?:Rs\.([\d\.]+)/-",
            text,
            float,
        )

    fallback_charges = extract_charge_fallbacks(text)
    for key, value in fallback_charges.items():
        if key == "energy_charge":
            data[key] = choose_first(data.get(key), value) if data.get(key) not in (None, 0.0) else value
        elif data.get(key) is None:
            data[key] = value

    if data["solar_capacity_kw"] is not None:
        data["estimated_daily_solar_kwh"] = round(data["solar_capacity_kw"] * 4.5, 2)
    else:
        data["estimated_daily_solar_kwh"] = None

    return data


def dedupe_bills(bills):
    selected = {}
    decisions = []
    for bill in bills:
        key = build_bill_identity(bill)
        existing = selected.get(key)
        if existing is None:
            selected[key] = bill
            continue

        if bill_selection_key(bill) > bill_selection_key(existing):
            selected[key] = bill
            decisions.append(
                f"Duplicate {key}: kept {bill.get('file', 'unknown')} over {existing.get('file', 'unknown')}."
            )
        else:
            decisions.append(
                f"Duplicate {key}: kept {existing.get('file', 'unknown')} and skipped {bill.get('file', 'unknown')}."
            )

    return sorted(selected.values(), key=lambda bill: parse_bill_date(bill.get("bill_date"))), decisions


def parse_folder(folder):
    folder = Path(folder)
    if not folder.exists():
        raise FileNotFoundError(f"PDF folder does not exist: {folder}")
    if not folder.is_dir():
        raise NotADirectoryError(f"PDF folder is not a directory: {folder}")

    pdf_files = sorted(folder.glob("*.pdf"))
    if not pdf_files:
        raise FileNotFoundError(f"No PDF files were found in: {folder}")

    result = ParseFolderResult(folder=folder, pdf_count=len(pdf_files))

    for pdf in pdf_files:
        try:
            bill = parse_kseb_bill(pdf)
            errors, warnings = validate_bill(bill)
            if errors:
                message = "; ".join(errors)
                result.failures.append(ParseIssue(pdf.name, message))
                print(f"Failed: {pdf.name} ({message})")
                continue

            for warning in warnings:
                result.warnings.append(ParseIssue(pdf.name, warning))

            result.bills.append(bill)
            print(f"Parsed: {pdf.name}")
        except Exception as exc:
            result.failures.append(ParseIssue(pdf.name, str(exc)))
            print(f"Failed: {pdf.name} ({exc})")

    result.bills, result.duplicates = dedupe_bills(result.bills)
    for decision in result.duplicates:
        print(decision)
    for warning in result.warnings:
        print(f"Warning: {warning.file} ({warning.message})")

    return result


def ensure_exportable(result):
    if result.failures:
        preview = ", ".join(f"{issue.file}: {issue.message}" for issue in result.failures[:3])
        remaining = len(result.failures) - 3
        if remaining > 0:
            preview = f"{preview}, and {remaining} more"
        raise RuntimeError(
            "Parsing did not complete cleanly, so exports were not updated. "
            f"Review the failing files and rerun: {preview}"
        )

    if not result.bills:
        raise RuntimeError(f"No valid bills were parsed from: {result.folder}")


def ensure_safe_raw_json_path(raw_json_path):
    if not raw_json_path:
        return

    raw_path = Path(raw_json_path).expanduser()
    resolved_path = raw_path.resolve() if raw_path.is_absolute() else (Path.cwd() / raw_path).resolve()
    try:
        resolved_path.relative_to(SERVED_DASHBOARD_DIR)
    except ValueError:
        return

    raise ValueError(
        "Refusing to write sensitive raw bill data inside the served dashboard directory. "
        "Use a local-only path such as exports/bills.raw.json instead."
    )


def build_export_bill(bill):
    export_bill = {
        "record_id": build_record_id(bill),
        "bill_date": bill.get("bill_date"),
        "due_date": bill.get("due_date"),
        "connected_load_watts": bill.get("connected_load_watts"),
        "solar_capacity_kw": bill.get("solar_capacity_kw"),
        "units_imported": bill.get("units_imported"),
        "units_exported": bill.get("units_exported"),
        "billed_consumption": bill.get("billed_consumption"),
        "normal_import": bill.get("normal_import"),
        "normal_export": bill.get("normal_export"),
        "offpeak_import": bill.get("offpeak_import"),
        "offpeak_export": bill.get("offpeak_export"),
        "peak_import": bill.get("peak_import"),
        "peak_export": bill.get("peak_export"),
        "solar_generation_normal": bill.get("solar_generation_normal"),
        "solar_generation_offpeak": bill.get("solar_generation_offpeak"),
        "solar_generation_peak": bill.get("solar_generation_peak"),
        "net_grid_consumption": bill.get("net_grid_consumption"),
        "solar_generation_kwh": bill.get("solar_generation_kwh"),
        "fixed_charge": bill.get("fixed_charge"),
        "energy_charge": bill.get("energy_charge"),
        "electricity_duty": bill.get("electricity_duty"),
        "meter_rent": bill.get("meter_rent"),
        "total_amount": bill.get("total_amount"),
        "estimated_daily_solar_kwh": bill.get("estimated_daily_solar_kwh"),
    }
    return export_bill


def write_json(data, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as file_handle:
        json.dump(data, file_handle, indent=2)


def write_csv(data, path, fieldnames=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = data or []
    if fieldnames is None:
        keys = []
        for row in rows:
            for key in row.keys():
                if key not in keys:
                    keys.append(key)
        fieldnames = keys

    with open(path, "w", newline="", encoding="utf-8") as file_handle:
        writer = csv.DictWriter(file_handle, fieldnames=fieldnames)
        if fieldnames:
            writer.writeheader()
        if rows:
            writer.writerows(rows)


def export_bills(bills, json_path, csv_path, include_sensitive=False):
    exported_bills = bills if include_sensitive else [build_export_bill(bill) for bill in bills]
    fieldnames = None if include_sensitive else DEFAULT_EXPORT_FIELDS
    write_json(exported_bills, json_path)
    write_csv(exported_bills, csv_path, fieldnames=fieldnames)
    return exported_bills


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", nargs="?", default=DEFAULT_PDF_DIR, help="Folder containing KSEB bill PDFs")
    parser.add_argument("--json", default=DEFAULT_JSON_PATH)
    parser.add_argument("--csv", default=DEFAULT_CSV_PATH)
    parser.add_argument(
        "--include-sensitive",
        action="store_true",
        help="Write raw parsed fields instead of the default export.",
    )
    parser.add_argument(
        "--raw-json",
        help="Optional path for a local raw JSON export outside dashboard/ (for example: exports/bills.raw.json).",
    )

    args = parser.parse_args()

    result = parse_folder(args.folder)
    ensure_exportable(result)
    bills = result.bills
    if args.raw_json:
        ensure_safe_raw_json_path(args.raw_json)
        write_json(bills, args.raw_json)

    export_bills(
        bills,
        json_path=args.json,
        csv_path=args.csv,
        include_sensitive=args.include_sensitive,
    )

    print(f"\nParsed {len(bills)} bills")
    print(f"JSON saved to: {args.json}")
    print(f"CSV saved to: {args.csv}")
    if args.raw_json:
        print(f"Raw JSON saved to: {args.raw_json}")


if __name__ == "__main__":
    main()
