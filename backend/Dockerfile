# ==========================================
# Backend Dockerfile (Node.js & Python Automation Engine)
# ==========================================
# We use the official Playwright base image because it contains all necessary OS-level
# dependencies, fonts, and libraries required to run headless/headful browsers.
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Install Python3, pip, and venv which are required to run engine/core_worker.py
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up the container working directory
WORKDIR /app

# Copy package descriptors first from backend directory to optimize Docker layer caching
COPY backend/package*.json ./backend/

# Install Express, Socket.io, and other Node.js orchestrator dependencies
RUN cd backend && npm install

# Install the Python Playwright API binding
RUN pip3 install --no-cache-dir playwright

# Run the Playwright browser downloader to install the Chromium browser binary
# required by the Python automation scripts.
RUN python3 -m playwright install chromium

# Copy the source folders
COPY backend/ ./backend/
COPY engine/ ./engine/

# Expose the Orchestrator Express/WebSocket API port
EXPOSE 3000

# Run the Node.js server
CMD ["node", "backend/orchestrator.js"]
