# Canvas-QA-Orchestrator 🚀

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![TailwindCSS v4](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**Canvas-QA-Orchestrator** is a high-volume, real-time UI performance, and canvas stress-testing platform designed to run continuous 24/7 regression sequences. Combining a robust Express API orchestrator, an interactive React dashboard with TailwindCSS v4, and an asynchronous Python Playwright engine, this suite empowers developers and QA architects to validate layout responsiveness and canvas element endurance under varying execution states.

---

## 🏗️ Architecture & Core Mechanics

The platform leverages a decoupled, multi-language orchestration workflow to achieve isolation, crash resilience, and real-time state feedback.

### Workflow Topology
```text
  ┌──────────────────────────────────────────────────────────┐
  │                    Vite React Client                     │
  │     (Interactive Controls & Telemetry Data Visuals)      │
  └─────────────┬──────────────────────────────▲─────────────┘
                │                              │
       REST HTTP requests               Websocket Stream
       (Start QA Session)             (Live Telemetry & Logs)
                │                              │
  ┌─────────────▼──────────────────────────────┴─────────────┐
  │                 Node.js Express Server                   │
  │     (Concurrency Manager, Metrics Tracker & Socket)      │
  └─────────────┬──────────────────────────────▲─────────────┘
                │                              │
       Asynchronous Spawn              Pipe Stdout/Stderr
       (Args & Target Config)         (Log Chunks & PID state)
                │                              │
  ┌─────────────▼──────────────────────────────┴─────────────┐
  │             Python Async Playwright Engine               │
  │       (Isolated Headless/Headful Browser runner)         │
  └──────────────────────────────────────────────────────────┘
```

### Key Features
*   **Decoupled Multi-Language Execution**: Node.js handles I/O-intensive task management and event routing, while Python drives Playwright using asynchronous event loops.
*   **Resource Leak Immunity (7/24 Execution State)**: Browsers are spawned and destroyed completely in batches to reclaim system memory.
*   **WebSocket Telemetry Stream**: Captures stdout/stderr streams from child processes and broadcasts them directly to the client terminal log interface with milliseconds latency.
*   **Non-Linear Pointer Jitters**: Simulates real mouse movements inside targeted element bounding boxes to prevent synthetic-event flags and ensure valid browser engine interaction.
*   **Session-Level Proxy Rotation**: Allows specifying network identity rules per execution session.

---

## ⚡ Quick Start

### Docker Compose (Recommended 2-Minute Deployment)
To start the entire environment (Express API + React App) preconfigured with all system dependencies and browsers:

```bash
# Build and launch both services
docker compose up --build
```
*   **API Telemetry Service**: `http://localhost:3000`
*   **Web Dashboard**: `http://localhost:5173`

---

### Native Local Setup

#### 1. Start the Backend API
Navigate to the `backend` folder, install packages, and start:
```bash
cd backend
npm install
pip3 install playwright
python3 -m playwright install chromium
npm run start
```

#### 2. Start the Frontend Dashboard
Navigate to the `dashboard` folder, install packages, and start:
```bash
cd dashboard
npm install
npm run dev
```

---

## ⚙️ Advanced Runtime Configurations

Configurations are set up via the dashboard or parsed from the Express REST API schema:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `targetUrl` | String | *Required* | The application URL to test. |
| `iframeSelector` | String | `iframe` | Target container iframe CSS selector. |
| `iframeTargetSelector` | String | `canvas` | Target interactive element within the frame. |
| `proxyServer` | String | `null` | Optional HTTP/SOCKS5 server context (`ip:port`). |
| `proxyUser` | String | `null` | Optional proxy user authentication credential. |
| `proxyPass` | String | `null` | Optional proxy password authentication credential. |
| `minDuration` | Integer | `60` | Minimum duration limit in seconds. |
| `maxDuration` | Integer | `120` | Maximum duration limit in seconds. |

---

## 📄 Open Source License

This project is licensed under the terms of the [MIT License](LICENSE), welcoming open-source pull requests, code reviews, and community contributions. Feel free to clone, fork, and adapt it to your enterprise QA workflows.
