# -*- coding: utf-8 -*-
"""
Invoice Sheet Scheduler
=======================
Poll Google Sheets (via priva-gws) secara berkala untuk mendeteksi perubahan.
Jika ada perubahan, trigger Invoice Agent untuk membaca sheet dan memproses invoice.

Flow:
  APScheduler (interval)
      │
      └─ check_sheet_changed(spreadsheet_id)
             │ changed=False → skip, hemat token
             │ changed=True  ↓
             └─ POST /chat  (Invoice Agent)
                    │
                    ├─ read_gws_sheet → data invoice
                    ├─ create_invoice → pdf_url
                    └─ send_telegram_message → notifikasi

Env vars (semua wajib kecuali yang ada default):
  SPREADSHEET_ID       – ID Google Sheets yang dipantau
  TELEGRAM_CHAT_ID     – chat ID tujuan notifikasi Telegram
  SCHEDULER_INTERVAL   – interval polling dalam detik (default: 300 = 5 menit)
  AGENT_URL            – URL Invoice Agent server (default: http://localhost:5002)
  SCHEDULER_SESSION_ID – session ID untuk percakapan scheduler (default: scheduler-auto)

  # diteruskan ke agent (sudah diset via env agent_server):
  GWS_API_URL / GWS_API_KEY / GWS_USER_ID / GWS_TENANT_ID
  INVOICE_API_URL / INVOICE_API_KEY
  TELEGRAM_API_URL / TELEGRAM_JWT_TOKEN / TELEGRAM_BOT_ID
"""
import json
import logging
import os
import sys

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from tools import check_sheet_changed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("invoice.scheduler")

# ── Config dari env ────────────────────────────────────────────────────────────

SPREADSHEET_ID    = os.environ.get("SPREADSHEET_ID", "")
TELEGRAM_CHAT_ID  = os.environ.get("TELEGRAM_CHAT_ID", "")
SCHEDULER_INTERVAL = int(os.environ.get("SCHEDULER_INTERVAL", "300"))
AGENT_URL         = os.environ.get("AGENT_URL", "http://localhost:5002")
SESSION_ID        = os.environ.get("SCHEDULER_SESSION_ID", "scheduler-auto")
USER_ID           = "scheduler"


def _build_prompt(spreadsheet_id: str, chat_id: str) -> str:
    return (
        f"Baca data invoice dari Google Sheet dengan spreadsheet_id='{spreadsheet_id}' "
        f"menggunakan read_gws_sheet, kemudian buat invoice menggunakan create_invoice, "
        f"lalu kirim notifikasi ke Telegram chat_id='{chat_id}' menggunakan send_telegram_message. "
        f"Jangan tanya konfirmasi, langsung proses semua langkah."
    )


def _trigger_agent(spreadsheet_id: str, chat_id: str) -> None:
    """Kirim request ke Invoice Agent dan stream hasilnya ke log."""
    prompt = _build_prompt(spreadsheet_id, chat_id)
    logger.info(f"Triggering agent for sheet {spreadsheet_id}")

    try:
        with requests.post(
            f"{AGENT_URL}/chat",
            json={
                "user_input": prompt,
                "user_id":    USER_ID,
                "session_id": SESSION_ID,
            },
            stream=True,
            timeout=300,
        ) as resp:
            if resp.status_code != 200:
                logger.error(f"Agent returned HTTP {resp.status_code}: {resp.text[:200]}")
                return

            for line in resp.iter_lines():
                if not line:
                    continue
                # SSE format: "data: {...}"
                text = line.decode("utf-8") if isinstance(line, bytes) else line
                if text.startswith("data:"):
                    payload = text[5:].strip()
                    try:
                        msg = json.loads(payload)
                        role = msg.get("role", "")
                        content = msg.get("content", "")
                        if role and content:
                            logger.info(f"[{role}] {str(content)[:200]}")
                    except json.JSONDecodeError:
                        pass

        logger.info("Agent run completed")
    except requests.exceptions.Timeout:
        logger.error("Agent request timed out after 300s")
    except Exception as e:
        logger.error(f"Agent trigger failed: {e}")


def poll_and_process() -> None:
    """Fungsi yang dipanggil scheduler setiap interval."""
    if not SPREADSHEET_ID:
        logger.warning("SPREADSHEET_ID not set, skipping poll")
        return

    logger.info(f"Polling sheet {SPREADSHEET_ID} for changes...")

    result_raw = check_sheet_changed(SPREADSHEET_ID)
    try:
        result = json.loads(result_raw)
    except json.JSONDecodeError:
        logger.error(f"check_sheet_changed returned invalid JSON: {result_raw}")
        return

    if "error" in result:
        logger.error(f"check_sheet_changed error: {result['error']}")
        return

    if result.get("first_run"):
        logger.info("First run — recording baseline, no invoice triggered")
        return

    if not result.get("changed"):
        modified = result.get("modified_time") or result.get("hash", "")[:12]
        logger.info(f"No changes detected (last: {modified})")
        return

    prev = result.get("prev_modified_time") or result.get("prev_hash", "")[:12]
    curr = result.get("modified_time") or result.get("hash", "")[:12]
    logger.info(f"Change detected! {prev} → {curr}")

    if not TELEGRAM_CHAT_ID:
        logger.warning("TELEGRAM_CHAT_ID not set — agent will run but cannot send Telegram")

    _trigger_agent(SPREADSHEET_ID, TELEGRAM_CHAT_ID)


def main() -> None:
    if not SPREADSHEET_ID:
        logger.error("SPREADSHEET_ID env var is required")
        sys.exit(1)

    logger.info(
        f"Starting Invoice Scheduler | "
        f"sheet={SPREADSHEET_ID} | "
        f"interval={SCHEDULER_INTERVAL}s | "
        f"agent={AGENT_URL}"
    )

    # Jalankan sekali saat startup untuk inisialisasi state (first_run)
    poll_and_process()

    scheduler = BlockingScheduler(timezone="Asia/Jakarta")
    scheduler.add_job(
        poll_and_process,
        trigger=IntervalTrigger(seconds=SCHEDULER_INTERVAL),
        id="sheet_poll",
        name=f"Poll sheet {SPREADSHEET_ID}",
        replace_existing=True,
        max_instances=1,   # jangan tumpuk run jika run sebelumnya belum selesai
    )

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    main()
