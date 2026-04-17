#!/usr/bin/env python3
"""Run this script once to generate sample_invoice.xlsx for testing."""
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Invoice"

ws.append(["customer_name", "phone", "tax_percent", "description", "qty", "price"])
ws.append(["PT Maju Bersama", "+62812345678", 11, "Jasa Konsultasi IT", 3, 1500000])
ws.append(["PT Maju Bersama", "",            "",  "Pengembangan Website", 1, 5000000])
ws.append(["PT Maju Bersama", "",            "",  "Maintenance Bulanan", 12, 500000])

wb.save("sample_invoice.xlsx")
print("sample_invoice.xlsx created")
