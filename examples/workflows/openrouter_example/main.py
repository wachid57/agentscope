# -*- coding: utf-8 -*-
"""Contoh penggunaan AgentScope dengan OpenRouter sebagai LLM provider.

OpenRouter adalah proxy yang mendukung 200+ model (GPT-4o, Claude, Gemini,
Llama, Mistral, dll) via satu API key dengan antarmuka OpenAI-compatible.

Cara pakai:
    export OPENROUTER_API_KEY=sk-or-...
    python main.py

Daftar model tersedia: https://openrouter.ai/models
"""
import asyncio
import os

from agentscope.agent import ReActAgent
from agentscope.message import Msg
from agentscope.model import OpenAIChatModel


def make_openrouter_model(model_name: str) -> OpenAIChatModel:
    """Buat model yang terhubung ke OpenRouter.

    OpenRouter kompatibel dengan OpenAI SDK — cukup ganti base_url
    dan gunakan OPENROUTER_API_KEY sebagai api_key.

    Args:
        model_name: Nama model OpenRouter, contoh:
            - "openai/gpt-4o"
            - "anthropic/claude-3.5-sonnet"
            - "google/gemini-2.0-flash-001"
            - "meta-llama/llama-3.3-70b-instruct"
            - "mistralai/mistral-small-3.1-24b-instruct"
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "OPENROUTER_API_KEY belum diset. "
            "Dapatkan API key di https://openrouter.ai/keys"
        )

    return OpenAIChatModel(
        model_name=model_name,
        api_key=api_key,
        stream=True,
        # Gunakan client_kwargs untuk override base_url ke OpenRouter
        client_kwargs={
            "base_url": "https://openrouter.ai/api/v1",
            # Opsional: tambahkan header OpenRouter untuk analytics
            "default_headers": {
                "HTTP-Referer": "https://github.com/agentscope-ai/agentscope",
                "X-Title": "AgentScope",
            },
        },
    )


async def main() -> None:
    # Pilih model dari OpenRouter — ganti sesuai kebutuhan
    model = make_openrouter_model("openai/gpt-4o-mini")

    agent = ReActAgent(
        name="Asisten",
        sys_prompt="Kamu adalah asisten AI yang membantu dan ramah.",
        model=model,
    )

    # Kirim pesan ke agent
    response = await agent(
        Msg("user", "Halo! Siapa kamu dan model apa yang kamu gunakan?", "user")
    )
    print(f"\n[{response.name}]: {response.content}\n")


if __name__ == "__main__":
    asyncio.run(main())
