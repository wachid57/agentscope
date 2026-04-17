# -*- coding: utf-8 -*-
"""
Invoice Agent Server
====================
A standalone Quart server that exposes a streaming /chat endpoint.
The ReActAgent is pre-configured with four tools:
  1. read_gws_sheet      – read Google Sheets via priva-gws MCP
  2. read_excel_invoice  – parse a local .xlsx file (fallback)
  3. create_invoice      – POST to priva-invoice external API
  4. send_telegram_message – send a message through priva-telegram /api/v1/send

Environment variables:
  AGENT_SERVER_PORT   – HTTP port (default 5002)
  SESSION_DIR         – path to persist sessions (default ./sessions)
  OPENAI_API_KEY      – LLM API key
  OPENAI_MODEL        – model name (default gpt-4o-mini)
  INVOICE_API_URL     – e.g. http://priva-invoice:8080
  INVOICE_API_KEY     – API key for priva-invoice external endpoint
  TELEGRAM_API_URL    – priva-telegram service URL, e.g. http://priva-telegram:8080
  TELEGRAM_JWT_TOKEN  – JWT token from priva-telegram /auth/login
  TELEGRAM_BOT_ID     – UUID of the registered bot in priva-telegram
  GWS_API_URL         – priva-gws service URL, e.g. http://priva-gws:8080
  GWS_API_KEY         – API key for priva-gws MCP endpoint
  GWS_USER_ID         – user ID that has Google OAuth connected in priva-gws
  GWS_TENANT_ID       – tenant ID in priva-gws

Usage:
  python main.py
  # then POST to http://localhost:5002/chat
"""
import json
import logging
import os
from typing import AsyncGenerator

from quart import Quart, Response, request, jsonify

from tools import read_gws_sheet, read_excel_invoice, create_invoice, send_telegram_message

from agentscope.agent import ReActAgent
from agentscope.formatter import OpenAIChatFormatter
from agentscope.memory import InMemoryMemory
from agentscope.message import Msg
from agentscope.model import OpenAIChatModel
from agentscope.pipeline import stream_printing_messages
from agentscope.session import JSONSession
from agentscope.tool import Toolkit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)

SESSION_DIR = os.environ.get("SESSION_DIR", "./sessions")

SYSTEM_PROMPT = """You are an Invoice Processing Agent. Your job is to automate the full invoice workflow:

1. **Read data** – use `read_gws_sheet` to read invoice data from a Google Sheets spreadsheet
   via priva-gws. If the user provides a local Excel file instead, use `read_excel_invoice`.
2. **Create Invoice** – use `create_invoice` with the extracted data to generate an invoice
   and PDF via the priva-invoice service.
3. **Notify via Telegram** – use `send_telegram_message` to send the invoice summary and
   PDF link through the priva-telegram service.

### Rules
- Prefer `read_gws_sheet` for Google Sheets (user gives a spreadsheet ID or Google Sheets URL).
  Extract the spreadsheet ID from the URL if needed: the ID is the part between /d/ and /edit.
- Use `read_excel_invoice` only for local .xlsx file paths.
- Pass the full items JSON string from the read result directly into `create_invoice`.
- After creating the invoice, compose a clear Telegram message (Markdown) that includes:
    - Invoice number
    - Customer name
    - Number of items
    - PDF URL (if available)
- If any step fails, report the error clearly and do NOT continue to the next step.

### Example workflow (Google Sheets)
User: "Buat invoice dari sheet https://docs.google.com/spreadsheets/d/1BxiM.../edit dan kirim ke chat 123456789"
→ read_gws_sheet(spreadsheet_id="1BxiM...")
→ create_invoice(customer_name=..., items_json=..., phone=..., tax_percent=...)
→ send_telegram_message(chat_id="123456789", text="...")

### Example workflow (local Excel)
User: "Process invoice from /data/invoices/march.xlsx and send to Telegram chat 123456789"
→ read_excel_invoice(file_path="/data/invoices/march.xlsx")
→ create_invoice(customer_name=..., items_json=..., phone=..., tax_percent=...)
→ send_telegram_message(chat_id="123456789", text="...")
"""


def build_agent() -> ReActAgent:
    """Build a fresh ReActAgent with invoice tools registered."""
    toolkit = Toolkit()
    toolkit.register_tool_function(read_gws_sheet)
    toolkit.register_tool_function(read_excel_invoice)
    toolkit.register_tool_function(create_invoice)
    toolkit.register_tool_function(send_telegram_message)

    model = OpenAIChatModel(
        model_name=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        api_key=os.environ.get("OPENAI_API_KEY", ""),
        stream=True,
    )

    return ReActAgent(
        name="InvoiceAgent",
        sys_prompt=SYSTEM_PROMPT,
        model=model,
        formatter=OpenAIChatFormatter(),
        toolkit=toolkit,
        memory=InMemoryMemory(),
    )


async def run_agent_stream(
    user_input: str,
    user_id: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    session = JSONSession(save_dir=SESSION_DIR)
    agent   = build_agent()

    await session.load_session_state(
        session_id=f"{user_id}-{session_id}",
        agent=agent,
    )

    user_msg = Msg(user_id, user_input, "user")

    async for msg, _ in stream_printing_messages(
        agents=[agent],
        coroutine_task=agent(user_msg),
    ):
        data = json.dumps(msg.to_dict(), ensure_ascii=False)
        yield f"data: {data}\n\n"

    await session.save_session_state(
        session_id=f"{user_id}-{session_id}",
        agent=agent,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
async def health():
    return jsonify({"status": "ok", "service": "invoice-agent"})


@app.route("/chat", methods=["POST"])
async def chat():
    """
    POST /chat
    {
        "user_input":  "Buat invoice dari sheet 1BxiM... kirim ke Telegram chat 123456789",
        "user_id":     "user-001",
        "session_id":  "session-abc"
    }
    Returns: text/event-stream (SSE)
    """
    data = await request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    user_input = data.get("user_input", "")
    user_id    = data.get("user_id", "anonymous")
    session_id = data.get("session_id", "")

    if not user_input:
        return jsonify({"error": "user_input is required"}), 400
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    logger.info(f"Invoice agent chat — user: {user_id}, session: {session_id}")

    async def generate():
        try:
            async for chunk in run_agent_stream(user_input, user_id, session_id):
                yield chunk
        except Exception as e:
            logger.exception("Invoice agent error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


if __name__ == "__main__":
    port = int(os.environ.get("AGENT_SERVER_PORT", 5002))
    logger.info(f"Starting Invoice Agent server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
