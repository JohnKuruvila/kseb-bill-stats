from collections.abc import Iterable
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Bill, Customer, NotificationEvent


def _safe_number(value):
    return float(value) if value is not None else None


def _first_number(*values):
    for value in values:
        if value is not None:
            return float(value)
    return None


def _sum(values: Iterable[float | None]) -> float:
    return round(sum(value for value in values if value is not None), 2)


def _non_negative_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    return value if value >= 0 else None


def _has_consistent_charge_breakdown(
    total_amount: float,
    fixed_charge: float | None,
    energy_charge: float | None,
    tax_and_rent: float | None,
) -> bool:
    charge_components = [value for value in [fixed_charge, energy_charge, tax_and_rent] if value is not None]
    if not charge_components:
        return False
    tolerance = max(50.0, total_amount * 0.2)
    return sum(charge_components) <= (total_amount + tolerance)


def derive_bill_view(bill: Bill) -> dict:
    metrics = bill.metrics_json or {}
    zone_imports = [metrics.get("normal_import"), metrics.get("offpeak_import"), metrics.get("peak_import")]
    zone_exports = [metrics.get("normal_export"), metrics.get("offpeak_export"), metrics.get("peak_export")]
    zone_import_total = sum(v for v in zone_imports if v is not None) if all(v is not None for v in zone_imports) else None
    zone_export_total = sum(v for v in zone_exports if v is not None) if all(v is not None for v in zone_exports) else None
    units_imported = _first_number(metrics.get("units_imported"), zone_import_total)
    units_exported = _first_number(metrics.get("units_exported"), zone_export_total)
    net_grid_consumption = _first_number(
        metrics.get("net_grid_consumption"),
        units_imported - units_exported if units_imported is not None and units_exported is not None else None,
    )
    solar_generation = _safe_number(metrics.get("solar_generation_kwh"))
    solar_self_used = None
    if solar_generation is not None and units_exported is not None:
        solar_self_used = max(solar_generation - units_exported, 0)
    home_demand = None
    if units_imported is not None and solar_self_used is not None:
        home_demand = units_imported + solar_self_used
    solar_coverage = None
    if home_demand is not None and home_demand > 0 and solar_self_used is not None:
        solar_coverage = solar_self_used / home_demand

    fixed_charge = _non_negative_or_none(_safe_number(metrics.get("fixed_charge")))
    energy_charge = _non_negative_or_none(_safe_number(metrics.get("energy_charge")))
    electricity_duty = _non_negative_or_none(_safe_number(metrics.get("electricity_duty")))
    meter_rent = _non_negative_or_none(_safe_number(metrics.get("meter_rent")))
    tax_components = [value for value in [electricity_duty, meter_rent] if value is not None]
    tax_and_rent = round(sum(tax_components), 2) if tax_components else None
    charge_breakdown_valid = _has_consistent_charge_breakdown(
        bill.total_amount,
        fixed_charge,
        energy_charge,
        tax_and_rent,
    )
    if not charge_breakdown_valid:
        fixed_charge = None
        energy_charge = None
        electricity_duty = None
        meter_rent = None
        tax_and_rent = None
        other_charges = None
    else:
        charge_components = [value for value in [fixed_charge, energy_charge, tax_and_rent] if value is not None]
        other_charges = round(bill.total_amount - sum(charge_components), 2) if charge_components else None
        other_charges = max(other_charges, 0) if other_charges is not None else None
    cost_per_home_unit = round(bill.total_amount / home_demand, 2) if home_demand is not None and home_demand > 0 else None

    normalized_multiplier = 30 / bill.billing_period_days if bill.billing_period_days else None
    normalized_total_amount = round(bill.total_amount * normalized_multiplier, 2) if normalized_multiplier else None
    normalized_home_demand = (
        round(home_demand * normalized_multiplier, 2)
        if normalized_multiplier is not None and home_demand is not None
        else None
    )

    # For charts/insights, use the inferred billing-period "start" month (usage month) rather
    # than the raw `bill_date` month. With the current inference, a bill issued in March covers
    # the billing period that starts in February, so we should label it as Feb.
    label_date = bill.period_start or bill.period_end or bill.bill_date

    return {
        "id": bill.id,
        "label": label_date.strftime("%b %Y"),
        "bill_date": bill.bill_date,
        "due_date": bill.due_date,
        "billing_period_days": bill.billing_period_days,
        "billing_period_category": bill.billing_period_category,
        "total_amount": round(bill.total_amount, 2),
        "units_imported": units_imported,
        "units_exported": units_exported,
        "solar_generation_kwh": solar_generation,
        "solar_self_used_kwh": solar_self_used,
        "home_demand_kwh": home_demand,
        "solar_coverage": solar_coverage,
        "net_grid_consumption_kwh": net_grid_consumption,
        "fixed_charge": fixed_charge,
        "energy_charge": energy_charge,
        "electricity_duty": electricity_duty,
        "meter_rent": meter_rent,
        "tax_and_rent": tax_and_rent,
        "other_charges": other_charges,
        "charge_breakdown_valid": charge_breakdown_valid,
        "cost_per_home_unit": cost_per_home_unit,
        "normalized_total_amount": normalized_total_amount,
        "normalized_home_demand_kwh": normalized_home_demand,
    }


def build_dashboard(db: Session, customer: Customer) -> dict:
    bills = db.scalars(select(Bill).where(Bill.customer_id == customer.id).order_by(Bill.bill_date.asc())).all()
    trend = [derive_bill_view(bill) for bill in bills]
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.customer_id == customer.id)
        .order_by(NotificationEvent.created_at.desc())
        .limit(20)
    ).all()

    bill_amounts = [bill["total_amount"] for bill in trend]
    demand_values = [bill["home_demand_kwh"] for bill in trend if bill["home_demand_kwh"] is not None]
    solar_values = [bill["solar_generation_kwh"] for bill in trend if bill["solar_generation_kwh"] is not None]
    normalized_amounts = [bill["normalized_total_amount"] for bill in trend if bill["normalized_total_amount"] is not None]

    totals = {
        "bill_count": len(trend),
        "total_spend": _sum(bill_amounts),
        "average_bill": round(mean(bill_amounts), 2) if bill_amounts else None,
        "normalized_average_30d_bill": round(mean(normalized_amounts), 2) if normalized_amounts else None,
        "total_home_demand_kwh": _sum(demand_values),
        "total_solar_generation_kwh": _sum(solar_values),
        "billing_cycle_hint_days": customer.billing_cycle_hint_days,
        "last_synced_at": customer.last_synced_at,
    }

    return {
        "latest_bill_date": bills[-1].bill_date if bills else None,
        "next_sync_check_at": customer.next_sync_check_at,
        "totals": totals,
        "trend": trend,
        "notifications": [
            {
                "id": notification.id,
                "title": notification.title,
                "body": notification.body,
                "status": notification.status,
                "kind": notification.kind,
                "created_at": notification.created_at,
                "delivered_at": notification.delivered_at,
            }
            for notification in notifications
        ],
    }
