from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    consumer_number: str = Field(min_length=4, max_length=32)
    mobile_number: str = Field(min_length=10, max_length=20)


class SessionResponse(BaseModel):
    customer_id: str
    masked_consumer_number: str
    masked_mobile_number: str
    has_push_support: bool


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    status: str
    kind: str
    created_at: datetime
    delivered_at: datetime | None = None


class BillSummary(BaseModel):
    id: str
    label: str
    bill_date: date
    due_date: date | None = None
    billing_period_days: int | None = None
    billing_period_category: str | None = None
    total_amount: float
    units_imported: float | None = None
    units_exported: float | None = None
    solar_generation_kwh: float | None = None
    solar_self_used_kwh: float | None = None
    home_demand_kwh: float | None = None
    solar_coverage: float | None = None
    net_grid_consumption_kwh: float | None = None
    fixed_charge: float | None = None
    energy_charge: float | None = None
    electricity_duty: float | None = None
    meter_rent: float | None = None
    tax_and_rent: float | None = None
    other_charges: float | None = None
    charge_breakdown_valid: bool | None = None
    cost_per_home_unit: float | None = None
    normalized_total_amount: float | None = None
    normalized_home_demand_kwh: float | None = None


class DashboardResponse(BaseModel):
    latest_bill_date: date | None = None
    next_sync_check_at: datetime | None = None
    totals: dict[str, Any]
    trend: list[BillSummary]
    notifications: list[NotificationItem]


class StatusResponse(BaseModel):
    customer_id: str
    last_synced_at: datetime | None = None
    next_sync_check_at: datetime | None = None
    active_documents: int
    active_bills: int
    latest_bill_date: date | None = None


class UploadResponse(BaseModel):
    document_id: str | None = None
    parser_status: str
    filename: str
    error_message: str | None = None


class UploadBatchResponse(BaseModel):
    uploads: list[UploadResponse]


class AccountExportResponse(BaseModel):
    customer: dict[str, Any]
    bills: list[dict[str, Any]]
    documents: list[dict[str, Any]]
    notifications: list[NotificationItem]


class MessageResponse(BaseModel):
    message: str
