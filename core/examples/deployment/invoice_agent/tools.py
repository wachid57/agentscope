# -*- coding: utf-8 -*-
"""
Tools for the Invoice Agent:
  - check_sheet_changed  : lightweight check apakah sheet berubah sejak terakhir dicek
  - read_gws_sheet       : read a Google Sheets spreadsheet via priva-gws MCP
  - read_excel_invoice   : parse a local Excel file and return structured invoice rows
  - create_invoice       : call priva-invoice external API to create an invoice + PDF
  - send_telegram_message: send a message through priva-telegram /api/v1/send
"""
import hashlib
import json
import os
from typing import Any

import openpyxl
import requests

# ── State file untuk menyimpan modifiedTime terakhir per spreadsheet ───────────
_STATE_FILE = os.environ.get("SHEET_STATE_FILE", "/tmp/sheet_state.json")


def _load_state() -> dict:
    try:
        with open(_STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_state(state: dict) -> None:
    with open(_STATE_FILE, "w") as f:
        json.dump(state, f)


# ── 1. Check sheet changed (lightweight — hanya cek modifiedTime via Drive) ───

def check_sheet_changed(
    spreadsheet_id: str,
    gws_api_url: str = "",
    gws_api_key: str = "",
    gws_user_id: str = "",
    gws_tenant_id: str = "",
) -> str:
    """Check whether a Google Sheets file has been modified since the last check.

    Uses google.drive.list with a file ID query to fetch modifiedTime — this is
    a single lightweight Drive API call and does NOT read sheet contents at all.
    The last-seen modifiedTime is persisted in SHEET_STATE_FILE so state survives
    restarts.

    Args:
        spreadsheet_id: Google Sheets ID (same as used in read_gws_sheet).
        gws_api_url:    Base URL of priva-gws. Falls back to env GWS_API_URL.
        gws_api_key:    API key for priva-gws. Falls back to env GWS_API_KEY.
        gws_user_id:    User ID with Google OAuth. Falls back to env GWS_USER_ID.
        gws_tenant_id:  Tenant ID. Falls back to env GWS_TENANT_ID.

    Returns:
        JSON string:
          {"changed": true,  "modified_time": "<ISO>", "prev_modified_time": "<ISO>"}
          {"changed": false, "modified_time": "<ISO>"}
          {"error": "..."}
    """
    base_url  = gws_api_url   or os.environ.get("GWS_API_URL",   "http://localhost:8083")
    api_key   = gws_api_key   or os.environ.get("GWS_API_KEY",   "")
    user_id   = gws_user_id   or os.environ.get("GWS_USER_ID",   "")
    tenant_id = gws_tenant_id or os.environ.get("GWS_TENANT_ID", "")

    if not api_key:
        return json.dumps({"error": "No GWS_API_KEY provided"})

    payload: dict[str, Any] = {
        "action": "google.drive.list",
        "params": {
            "query": f"'{spreadsheet_id}' in parents or id='{spreadsheet_id}'",
            "page_size": 1,
        },
        "metadata": {},
    }
    if user_id:
        payload["metadata"]["user_id"] = user_id
    if tenant_id:
        payload["metadata"]["tenant_id"] = tenant_id

    try:
        resp = requests.post(
            f"{base_url}/api/v1.0/mcp/google",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=15,
        )
        body = resp.json()
    except Exception as e:
        return json.dumps({"error": str(e)})

    if body.get("status") != "success":
        err = body.get("error", {})
        return json.dumps({"error": err.get("message", "priva-gws error")})

    files = body.get("data", {}).get("files", [])
    # Drive list by query id='X' returns the file itself in results
    modified_time = None
    for f in files:
        if f.get("id") == spreadsheet_id or not modified_time:
            modified_time = f.get("modified_at") or f.get("modifiedTime")
            break

    if not modified_time:
        # Fallback: file not found in list results — use a lightweight hash of
        # a single-cell range to detect changes without reading all content.
        return _check_sheet_hash(spreadsheet_id, base_url, api_key, user_id, tenant_id)

    state = _load_state()
    key = f"modified_time:{spreadsheet_id}"
    prev = state.get(key)

    state[key] = modified_time
    _save_state(state)

    if prev is None:
        # First run — treat as changed so initial invoice is processed
        return json.dumps({"changed": True, "modified_time": modified_time, "first_run": True})

    changed = modified_time != prev
    result: dict[str, Any] = {"changed": changed, "modified_time": modified_time}
    if changed:
        result["prev_modified_time"] = prev
    return json.dumps(result)


def _check_sheet_hash(
    spreadsheet_id: str,
    base_url: str,
    api_key: str,
    user_id: str,
    tenant_id: str,
) -> str:
    """Fallback: read a narrow range and hash it to detect changes."""
    payload: dict[str, Any] = {
        "action": "google.sheets.read",
        "params": {"spreadsheet_id": spreadsheet_id, "range": "A1:Z3"},
        "metadata": {},
    }
    if user_id:
        payload["metadata"]["user_id"] = user_id
    if tenant_id:
        payload["metadata"]["tenant_id"] = tenant_id

    try:
        resp = requests.post(
            f"{base_url}/api/v1.0/mcp/google",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        body = resp.json()
    except Exception as e:
        return json.dumps({"error": str(e)})

    if body.get("status") != "success":
        return json.dumps({"error": body.get("error", {}).get("message", "priva-gws error")})

    content = json.dumps(body.get("data", {}).get("values", []), sort_keys=True)
    current_hash = hashlib.sha256(content.encode()).hexdigest()

    state = _load_state()
    key = f"hash:{spreadsheet_id}"
    prev_hash = state.get(key)

    state[key] = current_hash
    _save_state(state)

    if prev_hash is None:
        return json.dumps({"changed": True, "hash": current_hash, "first_run": True})

    changed = current_hash != prev_hash
    result: dict[str, Any] = {"changed": changed, "hash": current_hash}
    if changed:
        result["prev_hash"] = prev_hash
    return json.dumps(result)


# ── 2. Read Google Sheets via priva-gws ───────────────────────────────────────

def read_gws_sheet(
    spreadsheet_id: str,
    range_: str = "A1:Z1000",
    gws_api_url: str = "",
    gws_api_key: str = "",
    gws_user_id: str = "",
    gws_tenant_id: str = "",
) -> str:
    """Read a Google Sheets spreadsheet through the priva-gws MCP service and
    return structured invoice data (customer_name, phone, tax_percent, items).

    The sheet must have a header row (case-insensitive) containing at least:
        customer_name | description | qty | price
    Optional columns: phone, tax_percent

    Args:
        spreadsheet_id: Google Sheets ID (from the URL: /d/<ID>/edit).
        range_:         A1 notation range to read, e.g. "Sheet1!A1:F100".
                        Defaults to "A1:Z1000" (entire sheet).
        gws_api_url:    Base URL of priva-gws, e.g. "http://localhost:8083".
                        Falls back to env GWS_API_URL.
        gws_api_key:    API key for priva-gws (Bearer token).
                        Falls back to env GWS_API_KEY.
        gws_user_id:    User ID that has Google OAuth connected in priva-gws.
                        Falls back to env GWS_USER_ID.
        gws_tenant_id:  Tenant ID in priva-gws. Falls back to env GWS_TENANT_ID.

    Returns:
        JSON string with keys: customer_name, phone, tax_percent, items
        (same format as read_excel_invoice), or {"error": "..."} on failure.
    """
    base_url  = gws_api_url   or os.environ.get("GWS_API_URL",   "http://localhost:8083")
    api_key   = gws_api_key   or os.environ.get("GWS_API_KEY",   "")
    user_id   = gws_user_id   or os.environ.get("GWS_USER_ID",   "")
    tenant_id = gws_tenant_id or os.environ.get("GWS_TENANT_ID", "")

    if not api_key:
        return json.dumps({"error": "No GWS_API_KEY provided"})

    payload: dict[str, Any] = {
        "action": "google.sheets.read",
        "params": {
            "spreadsheet_id": spreadsheet_id,
            "range": range_,
        },
        "metadata": {},
    }
    if user_id:
        payload["metadata"]["user_id"] = user_id
    if tenant_id:
        payload["metadata"]["tenant_id"] = tenant_id

    try:
        resp = requests.post(
            f"{base_url}/api/v1.0/mcp/google",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=30,
        )
        body = resp.json()
    except Exception as e:
        return json.dumps({"error": str(e)})

    if body.get("status") != "success":
        err = body.get("error", {})
        return json.dumps({"error": err.get("message", "priva-gws error")})

    raw_values: list[list] = body.get("data", {}).get("values", [])
    if not raw_values:
        return json.dumps({"error": "Sheet is empty or range returned no data"})

    # Parse header row (case-insensitive)
    headers = [str(h).strip().lower() if h else "" for h in raw_values[0]]

    def col(name: str) -> int | None:
        return headers.index(name) if name in headers else None

    c_customer = col("customer_name")
    c_phone    = col("phone")
    c_desc     = col("description")
    c_qty      = col("qty")
    c_price    = col("price")
    c_tax      = col("tax_percent")

    if c_desc is None or c_qty is None or c_price is None:
        return json.dumps({"error": f"Required columns missing. Found: {headers}"})

    customer_name = ""
    phone = ""
    tax_percent = 0.0
    items = []

    for row in raw_values[1:]:
        # pad short rows
        while len(row) <= max(filter(None, [c_customer, c_phone, c_desc, c_qty, c_price, c_tax, 0])):
            row.append("")

        if c_customer is not None and row[c_customer]:
            customer_name = str(row[c_customer]).strip()
        if c_phone is not None and row[c_phone]:
            phone = str(row[c_phone]).strip()
        if c_tax is not None and row[c_tax]:
            try:
                tax_percent = float(row[c_tax])
            except (ValueError, TypeError):
                pass

        desc  = str(row[c_desc]).strip()  if row[c_desc]  else ""
        try:
            qty   = float(row[c_qty])   if row[c_qty]   else 0
            price = float(row[c_price]) if row[c_price] else 0
        except (ValueError, TypeError):
            qty, price = 0, 0

        if desc:
            items.append({"description": desc, "qty": qty, "price": price})

    return json.dumps({
        "customer_name": customer_name,
        "phone":         phone,
        "tax_percent":   tax_percent,
        "items":         items,
    }, ensure_ascii=False)


# ── 2. Read Excel (local file fallback) ────────────────────────────────────────

def read_excel_invoice(file_path: str, sheet_name: str = "") -> str:
    """Read an Excel (.xlsx) file and return the invoice rows as JSON.

    The sheet must have at least these columns (order-insensitive, case-insensitive):
        customer_name | description | qty | price
    An optional 'phone' and 'tax_percent' column are also supported.

    Args:
        file_path:  Absolute or relative path to the .xlsx file.
        sheet_name: Sheet name to read. Defaults to the first sheet.

    Returns:
        A JSON string with keys:
          - customer_name (str)
          - phone         (str, optional)
          - tax_percent   (float)
          - items         (list of {description, qty, price})
    """
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb[sheet_name] if sheet_name else wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return json.dumps({"error": "Empty sheet"})

        headers = [str(h).strip().lower() if h else "" for h in rows[0]]

        def col(name: str) -> int | None:
            return headers.index(name) if name in headers else None

        c_customer  = col("customer_name")
        c_phone     = col("phone")
        c_desc      = col("description")
        c_qty       = col("qty")
        c_price     = col("price")
        c_tax       = col("tax_percent")

        customer_name = ""
        phone = ""
        tax_percent = 0.0
        items = []

        for row in rows[1:]:
            if not any(row):
                continue
            if c_customer is not None and row[c_customer]:
                customer_name = str(row[c_customer]).strip()
            if c_phone is not None and row[c_phone]:
                phone = str(row[c_phone]).strip()
            if c_tax is not None and row[c_tax]:
                try:
                    tax_percent = float(row[c_tax])
                except (ValueError, TypeError):
                    pass
            desc  = str(row[c_desc]).strip()  if c_desc  is not None and row[c_desc]  else ""
            qty   = float(row[c_qty])          if c_qty   is not None and row[c_qty]   else 0
            price = float(row[c_price])        if c_price is not None and row[c_price] else 0
            if desc:
                items.append({"description": desc, "qty": qty, "price": price})

        result = {
            "customer_name": customer_name,
            "phone":         phone,
            "tax_percent":   tax_percent,
            "items":         items,
        }
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── 2. Create Invoice ──────────────────────────────────────────────────────────

def create_invoice(
    customer_name: str,
    items_json: str,
    phone: str = "",
    tax_percent: float = 0.0,
    invoice_api_url: str = "",
    invoice_api_key: str = "",
) -> str:
    """Create an invoice via the priva-invoice external API.

    Args:
        customer_name:   Customer full name.
        items_json:      JSON string — list of {description, qty, price}.
        phone:           Customer phone number (optional).
        tax_percent:     Tax percentage, e.g. 10 for 10% (optional).
        invoice_api_url: Base URL of the priva-invoice service, e.g.
                         "http://localhost:8080". Falls back to env
                         INVOICE_API_URL.
        invoice_api_key: API key for the external endpoint. Falls back to env
                         INVOICE_API_KEY.

    Returns:
        JSON string with invoice_id, invoice_number, pdf_url on success or
        an error key on failure.
    """
    base_url = invoice_api_url or os.environ.get("INVOICE_API_URL", "http://localhost:8080")
    api_key  = invoice_api_key  or os.environ.get("INVOICE_API_KEY", "")

    try:
        items: list[dict[str, Any]] = json.loads(items_json)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"items_json parse error: {e}"})

    payload = {
        "customer_name": customer_name,
        "phone":         phone,
        "items":         items,
        "tax_percent":   tax_percent,
    }

    try:
        resp = requests.post(
            f"{base_url}/api/v1.0/external/invoices",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=30,
        )
        return json.dumps(resp.json(), ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── 3. Send Telegram Message via priva-telegram ────────────────────────────────

def send_telegram_message(
    chat_id: str,
    text: str,
    bot_id: str = "",
    parse_mode: str = "Markdown",
    telegram_api_url: str = "",
    telegram_jwt_token: str = "",
) -> str:
    """Send a message to a Telegram chat through the priva-telegram service.

    The priva-telegram service handles bot token lookup, message recording,
    audit logging, and actual delivery via the Telegram Bot API.

    Args:
        chat_id:            Telegram chat ID (numeric string).
        text:               Message text. Supports Markdown or HTML.
        bot_id:             UUID of the registered bot in priva-telegram.
                            Falls back to env TELEGRAM_BOT_ID.
        parse_mode:         "Markdown" | "HTML". Default "Markdown".
        telegram_api_url:   Base URL of priva-telegram, e.g.
                            "http://localhost:8080". Falls back to env
                            TELEGRAM_API_URL.
        telegram_jwt_token: JWT token for priva-telegram /api/v1/send.
                            Falls back to env TELEGRAM_JWT_TOKEN.

    Returns:
        JSON string with {"success": true} on success or {"error": "..."}.
    """
    base_url        = telegram_api_url   or os.environ.get("TELEGRAM_API_URL",   "http://localhost:8080")
    jwt_token       = telegram_jwt_token or os.environ.get("TELEGRAM_JWT_TOKEN", "")
    resolved_bot_id = bot_id             or os.environ.get("TELEGRAM_BOT_ID",    "")

    if not jwt_token:
        return json.dumps({"error": "No TELEGRAM_JWT_TOKEN provided"})
    if not resolved_bot_id:
        return json.dumps({"error": "No TELEGRAM_BOT_ID provided"})

    payload = {
        "bot_id":     resolved_bot_id,
        "chat_id":    chat_id,
        "text":       text,
        "parse_mode": parse_mode,
    }

    try:
        resp = requests.post(
            f"{base_url}/api/v1/send",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=15,
        )
        return json.dumps(resp.json(), ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})
