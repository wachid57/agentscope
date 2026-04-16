#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AgentScope Dynamic Agent Server
Receives agent config from Go backend and runs agents on demand.
"""
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
from agentscope.message import Msg
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
    "execute_python_code":  execute_python_code,
    "execute_shell_command": execute_shell_command,
    "view_text_file":       view_text_file,
    "write_text_file":      write_text_file,
    "insert_text_file":     insert_text_file,
}


def build_toolkit(tools_cfg: list) -> Toolkit:
    toolkit = Toolkit()
    for tool in tools_cfg:
        if not tool.get("enabled", True):
            continue
        name = tool.get("name", "")
        if name in BUILTIN_TOOLS:
            toolkit.register_tool_function(BUILTIN_TOOLS[name])
            logger.info(f"Registered tool: {name}")
        else:
            logger.warning(f"Unknown tool: {name}, skipping")
    return toolkit


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
    toolkit   = build_toolkit(agent_cfg.get("tools", []))

    session = JSONSession(save_dir=SESSION_DIR)

    agent = ReActAgent(
        name=agent_cfg.get("name", "Assistant"),
        sys_prompt=agent_cfg.get("sys_prompt", "You are a helpful assistant."),
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

    async for msg, _ in stream_printing_messages(
        agents=[agent],
        coroutine_task=agent(user_msg),
    ):
        data = json.dumps(msg.to_dict(), ensure_ascii=False)
        yield f"data: {data}\n\n"

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

    agent_cfg  = data.get("agent_config")
    user_input = data.get("user_input", "")
    user_id    = data.get("user_id", "anonymous")
    session_id = data.get("session_id", "")

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
