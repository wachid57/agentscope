FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Force pip to show progress bar and package names during install
    PIP_PROGRESS_BAR=on

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

# Step 1: upgrade pip so progress output is accurate
RUN echo "==> [1/3] Upgrading pip..." && \
    pip install --upgrade pip

# Step 2: install agentscope[full] — shows each package being downloaded/installed
RUN echo "==> [2/3] Installing agentscope[full] dependencies..." && \
    pip install -e ".[full]" -v 2>&1 | grep -E "^(Collecting|Downloading|Installing|Building|Successfully|ERROR|WARNING|  Running)" || true && \
    echo "==> [2/3] agentscope[full] installed successfully."

# Step 3: install quart for agent HTTP server
RUN echo "==> [3/3] Installing quart (agent HTTP server)..." && \
    pip install quart -v 2>&1 | grep -E "^(Collecting|Downloading|Installing|Building|Successfully|ERROR|WARNING|  Running)" || true && \
    echo "==> [3/3] quart installed successfully."

# Copy examples and agent server
COPY examples/ ./examples/
COPY agent_server.py ./

# Default working directory
WORKDIR /app

# Default: run the dynamic agent HTTP server
CMD ["python", "agent_server.py"]
