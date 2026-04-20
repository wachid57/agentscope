#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AgentScope Dynamic Agent Server
Receives agent config from Go backend and runs agents on demand.
"""
import functools
import json
import logging
import os
from typing import AsyncGenerator, Any

from quart import Quart, Response, request, jsonify

from agentscope.agent import ReActAgent
from agentscope.formatter import (
    OpenAIChatFormatter,
    AnthropicChatFormatter,
    DashScopeChatFormatter,
    GeminiChatFormatter,
    OllamaChatFormatter,
)
from agentscope.memory import InMemoryMemory
from agentscope.message import Msg, TextBlock
from agentscope.tool import ToolResponse
from agentscope.model import (
    OpenAIChatModel,
    AnthropicChatModel,
    DashScopeChatModel,
    GeminiChatModel,
    OllamaChatModel,
)
from agentscope.pipeline import stream_printing_messages
from agentscope.session import JSONSession
from agentscope.tool import (
    Toolkit,
    execute_python_code,
    execute_shell_command,
    view_text_file,
    write_text_file,
    insert_text_file,
)

# Invoice agent custom tools (optional — loaded only when openpyxl/requests are available)
try:
    import sys, os as _os
    sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "examples/deployment/invoice_agent"))
    from tools import check_sheet_changed, read_gws_sheet, read_excel_invoice, create_invoice, send_telegram_message, send_telegram_file  # type: ignore
    _INVOICE_TOOLS_AVAILABLE = True
except Exception as _e:
    _INVOICE_TOOLS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"Invoice agent tools not loaded: {_e}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)

SESSION_DIR = os.environ.get("SESSION_DIR", "./sessions")

# ── Model factory ─────────────────────────────────────────────────────────────

PROVIDER_MAP = {
    "openai":      ("openai", OpenAIChatModel,     OpenAIChatFormatter),
    "openrouter":  ("openai", OpenAIChatModel,     OpenAIChatFormatter),  # OpenRouter is OpenAI-compatible
    "anthropic":   ("anthropic", AnthropicChatModel,  AnthropicChatFormatter),
    "dashscope":   ("dashscope", DashScopeChatModel,  DashScopeChatFormatter),
    "gemini":      ("gemini",  GeminiChatModel,    GeminiChatFormatter),
    "ollama":      ("ollama",  OllamaChatModel,    OllamaChatFormatter),
    "deepseek":    ("openai",  OpenAIChatModel,    OpenAIChatFormatter),  # DeepSeek is OpenAI-compatible
}

ENV_KEY_MAP = {
    "openai":     "OPENAI_API_KEY",
    "anthropic":  "ANTHROPIC_API_KEY",
    "dashscope":  "DASHSCOPE_API_KEY",
    "gemini":     "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "deepseek":   "DEEPSEEK_API_KEY",
}

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
DEEPSEEK_BASE   = "https://api.deepseek.com/v1"


def build_model(model_cfg: dict) -> Any:
    provider  = model_cfg.get("provider", "openai").lower()
    model_name = model_cfg.get("model_name", "")
    api_key   = model_cfg.get("api_key") or os.environ.get(ENV_KEY_MAP.get(provider, ""), "")
    base_url  = model_cfg.get("base_url", "")
    stream    = model_cfg.get("stream", True)
    max_tokens = model_cfg.get("max_tokens") or None

    if provider not in PROVIDER_MAP:
        raise ValueError(f"Unsupported provider: {provider}")

    _, ModelClass, _ = PROVIDER_MAP[provider]

    kwargs: dict = {
        "model_name": model_name,
        "stream": stream,
    }

    if provider in ("openai", "openrouter", "deepseek"):
        if api_key:
            kwargs["api_key"] = api_key
        # Override base_url for openrouter / deepseek
        if provider == "openrouter":
            kwargs["client_args"] = {"base_url": base_url or OPENROUTER_BASE}
        elif provider == "deepseek":
            kwargs["client_args"] = {"base_url": base_url or DEEPSEEK_BASE}
        elif base_url:
            kwargs["client_args"] = {"base_url": base_url}
        if max_tokens:
            kwargs["generate_args"] = {"max_tokens": max_tokens}

    elif provider == "anthropic":
        if api_key:
            kwargs["api_key"] = api_key
        if max_tokens:
            kwargs["generate_args"] = {"max_tokens": max_tokens}

    elif provider == "dashscope":
        if api_key:
            kwargs["api_key"] = api_key

    elif provider == "gemini":
        if api_key:
            kwargs["api_key"] = api_key

    elif provider == "ollama":
        if base_url:
            kwargs["client_args"] = {"host": base_url}

    return ModelClass(**kwargs)


def build_formatter(provider: str) -> Any:
    _, _, FormatterClass = PROVIDER_MAP.get(provider.lower(), PROVIDER_MAP["openai"])
    return FormatterClass()


# ── Tool factory ──────────────────────────────────────────────────────────────

BUILTIN_TOOLS = {
    "execute_python_code":   execute_python_code,
    "execute_shell_command": execute_shell_command,
    "view_text_file":        view_text_file,
    "write_text_file":       write_text_file,
    "insert_text_file":      insert_text_file,
}

if _INVOICE_TOOLS_AVAILABLE:
    BUILTIN_TOOLS["check_sheet_changed"]   = check_sheet_changed
    BUILTIN_TOOLS["read_gws_sheet"]        = read_gws_sheet
    BUILTIN_TOOLS["read_excel_invoice"]    = read_excel_invoice
    BUILTIN_TOOLS["create_invoice"]        = create_invoice
    BUILTIN_TOOLS["send_telegram_message"] = send_telegram_message
    BUILTIN_TOOLS["send_telegram_file"]    = send_telegram_file


def _strip_bound_params_from_doc(doc: str, bound_keys: set) -> str:
    """Remove lines describing pre-bound parameters from a numpy-style docstring."""
    if not doc or not bound_keys:
        return doc
    lines = doc.splitlines()
    out: list[str] = []
    skip = False
    param_indent: int = 0
    for line in lines:
        stripped = line.strip()
        # Measure indent of this line
        indent = len(line) - len(line.lstrip())
        # Detect "param_name:" line for a bound key
        is_bound_param = any(
            stripped.startswith(k + ":") or stripped.startswith(k + " :")
            for k in bound_keys
        )
        if is_bound_param:
            skip = True
            param_indent = indent
            continue
        if skip:
            # Continuation lines have deeper indent than the param line
            if indent > param_indent and stripped:
                continue  # still part of this param's description
            else:
                skip = False  # next param or section — stop skipping
        out.append(line)
    return "\n".join(out)


def _wrap_tool_fn(fn):
    """Wrap a plain str-returning tool function to return ToolResponse."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        if isinstance(result, ToolResponse):
            return result
        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        return ToolResponse(content=[TextBlock(type="text", text=text)])
    return wrapper


def build_toolkit(tools_cfg: list) -> tuple:
    """Return (Toolkit, pre_configured_hint: str)."""
    toolkit = Toolkit()
    hints: list[str] = []
    for tool in tools_cfg:
        if not tool.get("enabled", True):
            continue
        name = tool.get("name", "")
        config = {k: v for k, v in (tool.get("config") or {}).items() if v}
        if name in BUILTIN_TOOLS:
            fn = BUILTIN_TOOLS[name]
            if config:
                fn = functools.partial(fn, **config)
                fn.__name__ = BUILTIN_TOOLS[name].__name__
                # Strip pre-bound param descriptions so LLM never sees them
                fn.__doc__ = _strip_bound_params_from_doc(
                    BUILTIN_TOOLS[name].__doc__, set(config.keys())
                )
                params_str = ", ".join(f'{k}="{v}"' for k, v in config.items())
                hints.append(f"- {name}({params_str})")
            toolkit.register_tool_function(_wrap_tool_fn(fn))
            logger.info(f"Registered tool: {name} (config keys: {list(config)})")
        else:
            logger.warning(f"Unknown tool: {name}, skipping")

    hint_block = ""
    if hints:
        hint_block = (
            "\n\n[TOOL CONFIGURATION — DO NOT ASK USER]\n"
            "The following tools already have their parameters pre-configured. "
            "Call them IMMEDIATELY without asking the user for any of these values:\n"
            + "\n".join(hints)
        )
    return toolkit, hint_block


# ── Agent runner ──────────────────────────────────────────────────────────────

async def run_agent_stream(
    agent_cfg: dict,
    user_input: str,
    user_id: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """Build agent from config, load session, run, stream responses."""

    model_cfg = agent_cfg.get("model", {})
    provider  = model_cfg.get("provider", "openai")

    model     = build_model(model_cfg)
    formatter = build_formatter(provider)
    toolkit, tool_hint = build_toolkit(agent_cfg.get("tools", []))

    session = JSONSession(save_dir=SESSION_DIR)

    base_sys_prompt = agent_cfg.get("sys_prompt", "You are a helpful assistant.")
    sys_prompt = base_sys_prompt + tool_hint

    agent = ReActAgent(
        name=agent_cfg.get("name", "Assistant"),
        sys_prompt=sys_prompt,
        model=model,
        formatter=formatter,
        toolkit=toolkit,
        memory=InMemoryMemory(),
    )

    # Restore previous session state if exists
    await session.load_session_state(
        session_id=f"{user_id}-{session_id}",
        agent=agent,
    )

    user_msg = Msg(user_id, user_input, "user")

    # Deduplicate complete responses across ReActAgent iterations.
    # The first text message is streamed live for good UX; subsequent messages
    # are buffered and only forwarded if their final content is new.
    accumulated_per_id: dict[str, str] = {}
    buffer_per_id: dict[str, list] = {}
    sent_contents: set[str] = set()
    first_text_msg_id: str | None = None

    async for msg, is_last in stream_printing_messages(
        agents=[agent],
        coroutine_task=agent(user_msg),
    ):
        msg_dict = msg.to_dict()
        content = msg_dict.get("content", "")
        msg_id = msg_dict.get("id", "")

        if not isinstance(content, str):
            if isinstance(content, list):
                # Extract text from content blocks (e.g. DashScope sends
                # cumulative [{"type":"text","text":"..."}] arrays).
                # Rewrite as a plain string so dedup logic applies.
                extracted = "".join(
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                )
                if extracted:
                    content = extracted
                    msg_dict = dict(msg_dict)
                    msg_dict["content"] = content
                else:
                    # No text blocks (thinking / tool-call only) — skip to
                    # avoid sending raw arrays that the frontend can't display.
                    continue
            else:
                # Non-list, non-string — skip silently
                continue

        prev = accumulated_per_id.get(msg_id, "")

        # Normalize to delta: some providers send cumulative content per chunk
        if content.startswith(prev):
            delta = content[len(prev):]
            accumulated_per_id[msg_id] = content
        else:
            delta = content
            accumulated_per_id[msg_id] = prev + content

        if first_text_msg_id is None:
            first_text_msg_id = msg_id

        if msg_id == first_text_msg_id:
            # Stream first text message live for good UX
            if delta:
                out = dict(msg_dict)
                out["content"] = delta
                yield f"data: {json.dumps(out, ensure_ascii=False)}\n\n"
            if is_last:
                sent_contents.add(accumulated_per_id.get(msg_id, ""))
        else:
            # Buffer subsequent messages and deduplicate by content
            if delta:
                buffer_per_id.setdefault(msg_id, []).append((dict(msg_dict), delta))
            if is_last:
                final_content = accumulated_per_id.get(msg_id, "")
                if final_content and final_content not in sent_contents:
                    sent_contents.add(final_content)
                    for buffered_dict, buffered_delta in buffer_per_id.get(msg_id, []):
                        buffered_dict["content"] = buffered_delta
                        yield f"data: {json.dumps(buffered_dict, ensure_ascii=False)}\n\n"
                buffer_per_id.pop(msg_id, None)

    # Persist session state
    await session.save_session_state(
        session_id=f"{user_id}-{session_id}",
        agent=agent,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
async def health():
    return jsonify({"status": "ok", "service": "agentscope-core"})


@app.route("/chat", methods=["POST"])
async def chat():
    """
    POST /chat
    Body:
    {
        "agent_config": { <full agent object from Go backend> },
        "user_input": "...",
        "user_id": "...",
        "session_id": "..."
    }
    Returns: text/event-stream (SSE)
    """
    data = await request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    agent_cfg       = data.get("agent_config")
    user_input      = data.get("user_input", "")
    user_id         = data.get("user_id", "anonymous")
    session_id      = data.get("session_id", "")
    integration_env = data.get("integration_env") or {}

    # Inject integration settings into env so tool functions can pick them up
    env_map = {
        "gws_api_key":   "GWS_API_KEY",
        "gws_base_url":  "GWS_API_URL",
        "gws_user_id":   "GWS_USER_ID",
        "gws_tenant_id": "GWS_TENANT_ID",
    }
    for cfg_key, env_key in env_map.items():
        val = integration_env.get(cfg_key, "")
        if val:
            os.environ[env_key] = val

    if not agent_cfg:
        return jsonify({"error": "agent_config is required"}), 400
    if not user_input:
        return jsonify({"error": "user_input is required"}), 400
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    logger.info(
        f"Chat request — agent: {agent_cfg.get('name')}, "
        f"provider: {agent_cfg.get('model', {}).get('provider')}, "
        f"session: {session_id}"
    )

    async def generate():
        try:
            async for chunk in run_agent_stream(agent_cfg, user_input, user_id, session_id):
                yield chunk
        except Exception as e:
            logger.exception("Error running agent")
            err = json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.route("/validate", methods=["POST"])
async def validate_config():
    """
    POST /validate
    Validate agent config (model credentials, etc.) without running.
    """
    data = await request.get_json()
    agent_cfg = data.get("agent_config", {})
    model_cfg = agent_cfg.get("model", {})

    try:
        model = build_model(model_cfg)
        return jsonify({
            "valid": True,
            "provider": model_cfg.get("provider"),
            "model_name": model_cfg.get("model_name"),
        })
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("AGENT_SERVER_PORT", 5001))
    logger.info(f"Starting AgentScope agent server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
