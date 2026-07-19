from pathlib import Path

from scripts import parse_kseb_bill as parser


SAMPLE_NEW_FORMAT_TEXT = """
Consumer# 1156708008182
Bill# 5670250902808
Bill Date 08-09-2025 Due Date 18-09-2025
Connected Load 9806 Watts
Meter# L&T012150015607434
Power Unit Zone Trading Initial Reading(IR) Final Reading(FR) OMF Units*
KWH Cumulative Import 14425.00 14643.00 1 218
Fixed Charge[FC] 410.00
Energy Charge[EC] 856.30
Electricity Duty[ED] 85.63
Meter Rent[MR] 30.00
f) Total Amt.(Bill#5670250902808) (a+b+c+e) 1307.00
"""

SAMPLE_MONTHLY_TOD_SPLIT_LAYOUT = """
Consumer# 1156451000011
Bill# 5645250901947
Bill Date 02-09-2025 Due Date 12-09-2025
Meter# VTKM56460001213622
Zone
Normal
Normal
Off Peak
Off Peak
Peak
Peak
Trading
Initial Reading(IR) Final Reading(FR) OMF Units*
Import Export Import Export Import Export
4818.00 4926.00 16862.00 17211.00 12407.00 12728.00 0.00 0.00 3096.00 3184.00 0.00 0.00 1 1 1 1 1 1 108 349 321 0 88 0
1 / 2
Total Amt.(Bill#5645250901947) (a+b+c+e) 1217.00
"""


SAMPLE_NEW_FORMAT_TEXT_WITH_DECIMAL_UNITS = """
Consumer# 1156708008182
Bill# 5670260102746
Bill Date 08-01-2026 Due Date 18-01-2026
Connected Load 9806 Watts
Meter# L&T012150015607434
Power Unit Zone Trading Initial Reading(IR) Final Reading(FR) OMF Units*
KWH Cumulative Import 14931.00 15132.00 1 201.00
Fixed Charge[FC] 410.00
Energy Charge[EC] 765.35
Electricity Duty[ED] 76.54
Meter Rent[MR] 30.00
e) Total Amt.(Bill#5670260102746) (a+b+c+e) 1207.00
"""

SAMPLE_TOD_SPLIT_LAYOUT_IMPORT_ONLY = """
Consumer# 1155472029424
Bill# 5547260213402
Bill Date 24-02-2026 Due Date 05-03-2026
Connected Load 4274 Watts
Meter# VTK020250015041909
Trading
Initial Reading(IR) Final Reading(FR)
OMF
Units*
Zone
Normal
Import
Off Peak
Import
Peak
Import
821.00
792.00
366.00
821.00
792.00
366.00
1
1
1
214
202
96
1 / 2
b) Energy Charges Energy Charge-Normal[ECN]
1300.05
Payable amt.(excluding ACD) as on 2026-02-24 02:03:10:Rs.4293/-
Energy Charge-Peak[ECP]
810.00
Energy Charge-Offpeak[ECO]
1363.50
Auto Recovery FS[FSM]
20.48
c) Other Charges
Electricity Duty[ED]
Meter Rent[MR]
Total Amt.(Bill#5547260213402)          (a+b+c+e)
3494.03
347.36
12.00
4293.00
"""

SAMPLE_MISALIGNED_DUTY_VALUE = """
Consumer# 1156451000011
Bill# 5645250901947
Bill Date 02-09-2025 Due Date 12-09-2025
Meter# VTKM56460001213622
Fixed Charge[FC] 310.00
Energy Charge[EC] 777.10
Electricity Duty[ED]
Meter reading snapshot
for audit row
18816.00
Meter Rent[MR] 32.00
Total Amt.(Bill#5645250901947) (a+b+c+e) 1217.00
"""


def test_parse_cumulative_import_format(monkeypatch):
    monkeypatch.setattr(parser, "extract_text", lambda _path: SAMPLE_NEW_FORMAT_TEXT)

    parsed = parser.parse_kseb_bill(Path("sample.pdf"))

    assert parsed["bill_number"] == "5670250902808"
    assert parsed["bill_date"] == "08-09-2025"
    assert parsed["due_date"] == "18-09-2025"
    assert parsed["normal_import"] is None
    assert parsed["normal_export"] is None
    assert parsed["units_imported"] == 218
    assert parsed["units_exported"] == 0
    assert parsed["billed_consumption"] == 218
    assert parsed["total_amount"] == 1307.0


def test_parse_cumulative_import_format_decimal_units(monkeypatch):
    monkeypatch.setattr(parser, "extract_text", lambda _path: SAMPLE_NEW_FORMAT_TEXT_WITH_DECIMAL_UNITS)

    parsed = parser.parse_kseb_bill(Path("sample.pdf"))

    assert parsed["bill_number"] == "5670260102746"
    assert parsed["bill_date"] == "08-01-2026"
    assert parsed["due_date"] == "18-01-2026"
    assert parsed["normal_import"] is None
    assert parsed["normal_export"] is None
    assert parsed["units_imported"] == 201
    assert parsed["units_exported"] == 0
    assert parsed["billed_consumption"] == 201
    assert parsed["total_amount"] == 1207.0


def test_parse_monthly_tod_split_layout(monkeypatch):
    monkeypatch.setattr(parser, "extract_text", lambda _path: SAMPLE_MONTHLY_TOD_SPLIT_LAYOUT)

    parsed = parser.parse_kseb_bill(Path("sample.pdf"))

    assert parsed["bill_number"] == "5645250901947"
    assert parsed["bill_date"] == "02-09-2025"
    assert parsed["due_date"] == "12-09-2025"
    assert parsed["normal_import"] == 108
    assert parsed["normal_export"] == 349
    assert parsed["offpeak_import"] == 321
    assert parsed["offpeak_export"] == 0
    assert parsed["peak_import"] == 88
    assert parsed["peak_export"] == 0
    assert parsed["units_imported"] == 517
    assert parsed["units_exported"] == 349
    assert parsed["net_grid_consumption"] == 168
    assert parsed["billed_consumption"] == 168
    assert parsed["total_amount"] == 1217.0


def test_parse_tod_split_layout_import_only(monkeypatch):
    monkeypatch.setattr(parser, "extract_text", lambda _path: SAMPLE_TOD_SPLIT_LAYOUT_IMPORT_ONLY)

    parsed = parser.parse_kseb_bill(Path("sample.pdf"))

    assert parsed["bill_number"] == "5547260213402"
    assert parsed["bill_date"] == "24-02-2026"
    assert parsed["due_date"] == "05-03-2026"
    assert parsed["normal_import"] == 214
    assert parsed["offpeak_import"] == 202
    assert parsed["peak_import"] == 96
    assert parsed["units_imported"] == 512
    assert parsed["units_exported"] == 0
    assert parsed["billed_consumption"] == 512
    assert parsed["energy_charge"] == 3494.03
    assert parsed["total_amount"] == 4293.0


def test_parser_ignores_far_unrelated_decimal_after_duty_label(monkeypatch):
    monkeypatch.setattr(parser, "extract_text", lambda _path: SAMPLE_MISALIGNED_DUTY_VALUE)

    parsed = parser.parse_kseb_bill(Path("sample.pdf"))

    assert parsed["total_amount"] == 1217.0
    assert parsed["fixed_charge"] == 310.0
    assert parsed["energy_charge"] == 777.1
    # This large value is unrelated noise; parser should not consume it as ED.
    assert parsed["electricity_duty"] is None
    assert parsed["meter_rent"] == 32.0
