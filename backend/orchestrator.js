/**
 * QA Session Orchestrator Server
 * Express-based HTTP API and Socket.io server for real-time telemetry, log streaming, and managing Playwright regression runs.
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Middleware for parsing JSON requests
app.use(express.json());

// Create HTTP server wrapping the Express app
const server = http.createServer(app);

// Bind Socket.io to the server instance with safe CORS settings
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Centralized metrics tracking object
const metrics = {
  activeSessions: 0,
  maxCapacity: 5,
  totalSuccessSessions: 0,
  totalFailedSessions: 0,
  totalLaunched: 0
};

// Map of active process references
const activeProcesses = new Map();

// Helper utility to safely validate input parameters
function validateParams(body) {
  const { targetUrl, minDuration, maxDuration, proxyServer } = body;
  
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, message: 'Invalid or missing targetUrl' };
  }
  
  if (minDuration !== undefined && (typeof minDuration !== 'number' || minDuration <= 0)) {
    return { valid: false, message: 'minDuration must be a positive number' };
  }
  
  if (maxDuration !== undefined && (typeof maxDuration !== 'number' || maxDuration <= 0)) {
    return { valid: false, message: 'maxDuration must be a positive number' };
  }

  if (proxyServer && typeof proxyServer !== 'string') {
    return { valid: false, message: 'proxyServer must be a string' };
  }

  return { valid: true };
}

// Socket connection listener
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Push initial status immediately to the newly connected client
  socket.emit('system:metrics', {
    ...metrics,
    utilization: `${((metrics.activeSessions / metrics.maxCapacity) * 100).toFixed(1)}%`,
    timestamp: new Date()
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Broadcast metrics payload to all connected clients every 2 seconds
setInterval(() => {
  const utilization = `${((metrics.activeSessions / metrics.maxCapacity) * 100).toFixed(1)}%`;
  io.emit('system:metrics', {
    ...metrics,
    utilization,
    timestamp: new Date()
  });
}, 2000);

/**
 * POST /api/start-test
 * Spawns a background browser test session using game_qa_performance_test.py
 */
app.post('/api/start-test', (req, res) => {
  // 1. Throttle check
  if (metrics.activeSessions >= metrics.maxCapacity) {
    return res.status(429).json({ 
      error: 'Too Many Requests',
      message: `Maximum concurrent testing capacity (${metrics.maxCapacity}) reached.` 
    });
  }

  // 2. Input Validation
  const validation = validateParams(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Bad Request', message: validation.message });
  }

  const { 
    targetUrl, 
    proxyServer, 
    proxyUser, 
    proxyPass,
    iframeSelector = 'iframe',
    iframeTargetSelector = 'button'
  } = req.body;

  // Assemble dynamic execution arguments securely as individual array items
  const scriptPath = path.join(__dirname, '../engine/core_worker.py');
  const pythonArgs = [
    scriptPath,
    '--url', targetUrl,
    '--iframe-selector', iframeSelector,
    '--canvas-selector', iframeTargetSelector,
    '--batch-size', '10'
  ];

  if (proxyServer) {
    pythonArgs.push('--proxy-server', proxyServer);
    if (proxyUser && proxyPass) {
      pythonArgs.push('--proxy-user', proxyUser);
      pythonArgs.push('--proxy-pass', proxyPass);
    }
  }

  // Increment counters
  metrics.activeSessions++;
  metrics.totalLaunched++;
  
  console.log(`[Orchestrator] Spawning process. Active count: ${metrics.activeSessions}. Executing: python ${pythonArgs.join(' ')}`);

  // Spawn Python child process asynchronously
  const pythonProcess = spawn('python', pythonArgs);
  const pid = pythonProcess.pid;

  // Save reference
  activeProcesses.set(pid, pythonProcess);

  // Notify clients about the new session activation
  io.emit('session:status', {
    sessionId: pid,
    status: 'started',
    timestamp: new Date()
  });

  // Capture stdout stream and broadcast via WebSockets
  pythonProcess.stdout.on('data', (data) => {
    const chunkText = data.toString().trim();
    if (chunkText) {
      io.emit('session:log', {
        sessionId: pid,
        type: 'stdout',
        data: chunkText,
        timestamp: new Date()
      });
    }
  });

  // Capture stderr stream and broadcast via WebSockets
  pythonProcess.stderr.on('data', (data) => {
    const chunkText = data.toString().trim();
    if (chunkText) {
      io.emit('session:log', {
        sessionId: pid,
        type: 'stderr',
        data: chunkText,
        timestamp: new Date()
      });
    }
  });

  // Handle process level errors
  pythonProcess.on('error', (err) => {
    console.error(`[Orchestrator - Error] Failed to start Python process:`, err);
    metrics.totalFailedSessions++;
    io.emit('session:status', {
      sessionId: pid,
      status: 'error',
      message: err.message,
      timestamp: new Date()
    });
  });

  // Handle process completion
  pythonProcess.on('close', (code) => {
    metrics.activeSessions = Math.max(0, metrics.activeSessions - 1);
    activeProcesses.delete(pid);
    
    if (code === 0) {
      metrics.totalSuccessSessions++;
    } else {
      metrics.totalFailedSessions++;
    }
    
    console.log(`[Orchestrator] Process ${pid} terminated with exit code ${code}. Active count: ${metrics.activeSessions}`);
    
    // Broadcast status change immediately to notify the frontend
    io.emit('session:status', {
      sessionId: pid,
      status: 'terminated',
      code: code,
      timestamp: new Date()
    });
  });

  // Instantly return 202 Accepted containing configuration payload details
  return res.status(202).json({
    status: 'Pending',
    message: 'Testing session triggered successfully.',
    pid: pid,
    concurrencyState: `${metrics.activeSessions}/${metrics.maxCapacity}`
  });
});

/**
 * GET /api/status
 * Queries active running session metric.
 */
app.get('/api/status', (req, res) => {
  res.status(200).json({
    activeSessions: metrics.activeSessions,
    maxCapacity: metrics.maxCapacity,
    utilization: `${((metrics.activeSessions / metrics.maxCapacity) * 100).toFixed(1)}%`
  });
});

/**
 * POST /api/stop-all
 * Terminates all running Playwright test worker instances immediately.
 */
app.post('/api/stop-all', (req, res) => {
  let count = 0;
  for (const [pid, process] of activeProcesses.entries()) {
    try {
      process.kill();
      count++;
    } catch (err) {
      console.error(`Failed to kill process ${pid}:`, err);
    }
  }
  return res.status(200).json({
    status: 'Success',
    message: `Terminated ${count} active session runner processes.`
  });
});

// Start unified server
server.listen(PORT, () => {
  console.log(`[Orchestrator] QA Orchestration Service active on port ${PORT} (WS Enabled)`);
});
