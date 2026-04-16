FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libsndfile1 \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install agentscope with core dependencies + web server for agent_server.py
RUN pip install -e ".[full]" && pip install quart

# Copy examples and agent server
COPY examples/ ./examples/
COPY agent_server.py ./

# Default working directory
WORKDIR /app

# Default: run the dynamic agent HTTP server
CMD ["python", "agent_server.py"]
