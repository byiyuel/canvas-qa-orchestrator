import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Play, 
  Settings, 
  Activity, 
  Terminal, 
  AlertTriangle, 
  CheckCircle, 
  Shield, 
  Link2, 
  Clock, 
  Trash2,
  Cpu,
  RefreshCw
} from 'lucide-react';

function App() {
  // Config state
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [proxyServer, setProxyServer] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [minDuration, setMinDuration] = useState(1);
  const [maxDuration, setMaxDuration] = useState(5);
  
  // Custom Game configurations for UI
  const [iframeSelector, setIframeSelector] = useState('iframe');
  const [iframeTargetSelector, setIframeTargetSelector] = useState('canvas');

  // Real-time metrics from WebSockets
  const [activeSessions, setActiveSessions] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(5);
  const [utilization, setUtilization] = useState('0%');
  const [totalSuccess, setTotalSuccess] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const [totalLaunched, setTotalLaunched] = useState(0);
  
  // Terminal log storage
  const [logs, setLogs] = useState([]);
  
  // UX controls
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Reference for terminal scrolling
  const terminalEndRef = useRef(null);

  // Setup toast notifications helper
  const addToast = (type, message, details = '') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setNotifications((prev) => [{ id, type, message, details }, ...prev]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Auto scroll terminal to bottom on new log additions
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  // Connect to WebSockets on mounting
  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      loggerLog('SYSTEM', 'Established real-time WebSocket session client connection');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      loggerLog('SYSTEM', 'Disconnected from backend socket service.');
    });

    // Listen for real-time telemetry metrics
    socket.on('system:metrics', (data) => {
      setActiveSessions(data.activeSessions);
      setMaxCapacity(data.maxCapacity);
      setUtilization(data.utilization);
      setTotalSuccess(data.totalSuccessSessions || 0);
      setTotalFailed(data.totalFailedSessions || 0);
      setTotalLaunched(data.totalLaunched || 0);
    });

    // Listen for log streams from spawned Python execution runtimes
    socket.on('session:log', (logEntry) => {
      appendLog(logEntry.sessionId, logEntry.type, logEntry.data);
    });

    // Listen for session status updates
    socket.on('session:status', (statusEntry) => {
      if (statusEntry.status === 'started') {
        loggerLog('SYSTEM', `Runner instance initialization success. PID: ${statusEntry.sessionId}`);
      } else if (statusEntry.status === 'terminated') {
        loggerLog(
          statusEntry.code === 0 ? 'SYSTEM' : 'ERROR', 
          `Runner process completed. PID: ${statusEntry.sessionId} | Code: ${statusEntry.code}`
        );
      } else if (statusEntry.status === 'error') {
        loggerLog('ERROR', `Runner process crash. PID: ${statusEntry.sessionId} | ${statusEntry.message}`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Helper to append standard stdout/stderr logs
  const appendLog = (pid, type, message) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time,
        pid,
        type, // 'stdout' or 'stderr'
        text: message
      }
    ]);
  };

  // Helper to log system events inside terminal view
  const loggerLog = (type, text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time,
        pid: 'SYS',
        type, // 'SYSTEM' or 'ERROR'
        text
      }
    ]);
  };

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const payload = {
        targetUrl,
        proxyServer: proxyServer.trim() || undefined,
        proxyUser: proxyUser.trim() || undefined,
        proxyPass: proxyPass.trim() || undefined,
        minDuration: minDuration * 60,
        maxDuration: maxDuration * 60,
        iframeSelector,
        iframeTargetSelector
      };

      const res = await fetch('http://localhost:3000/api/start-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        addToast(
          'success', 
          'Stability Test Dispatched', 
          `PID: ${data.pid}`
        );
      } else if (res.status === 429) {
        addToast(
          'warning',
          'Orchestrator Throttled',
          'Maximum capacity bounds hit.'
        );
      } else {
        addToast('error', 'Execution Failed', data.message);
      }
    } catch (err) {
      addToast('error', 'Network Timeout', 'Could not contact backend port.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopAll = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/stop-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Termination Dispatched', data.message);
      } else {
        addToast('error', 'Termination Failed', data.message || 'Unknown error occurred.');
      }
    } catch (err) {
      addToast('error', 'Network Timeout', 'Could not establish connection to Express API.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-zinc-800 selection:text-zinc-50 antialiased p-6 sm:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Flat Minimal Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-6 mb-8 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-zinc-50 font-bold tracking-tight text-xl">canvas-qa-orchestrator</h1>
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded">v1.1.0</span>
            </div>
            <p className="text-xs text-zinc-500">Continuous regression stability engine for Canvas & HTML5 applications.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono bg-zinc-950 border border-zinc-800 px-3 py-1 rounded">
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-zinc-400">{socketConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid System */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Configuration Form Column (1/3 Sidebar) */}
          <div className="lg:col-span-1 space-y-6">
            <form onSubmit={handleLaunch} className="bg-zinc-950 border border-zinc-800 rounded p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                <Settings className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-50">Profile Parameters</h2>
              </div>

              {/* URL */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">Target URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link2 className="w-3.5 h-3.5 text-zinc-600" />
                  </div>
                  <input
                    type="url"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">Iframe Target</label>
                  <input
                    type="text"
                    required
                    value={iframeSelector}
                    onChange={(e) => setIframeSelector(e.target.value)}
                    placeholder="iframe"
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">Canvas Selector</label>
                  <input
                    type="text"
                    required
                    value={iframeTargetSelector}
                    onChange={(e) => setIframeTargetSelector(e.target.value)}
                    placeholder="canvas"
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Proxy Settings */}
              <div className="border-t border-zinc-900 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">Proxy Route</span>
                  <span className="text-[9px] text-zinc-600 font-mono">OPTIONAL</span>
                </div>
                
                <input
                  type="text"
                  value={proxyServer}
                  onChange={(e) => setProxyServer(e.target.value)}
                  placeholder="http://host:port"
                  className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none transition-colors"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={proxyUser}
                    onChange={(e) => setProxyUser(e.target.value)}
                    placeholder="User"
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                  <input
                    type="password"
                    value={proxyPass}
                    onChange={(e) => setProxyPass(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-zinc-500 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Durations */}
              <div className="border-t border-zinc-900 pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-400 font-sans">Session Scope Limits</span>
                  <span className="text-zinc-500 font-mono">{minDuration}m - {maxDuration}m</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Min Duration</span>
                      <span>{minDuration}m</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={minDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMinDuration(val);
                        if (val > maxDuration) setMaxDuration(val);
                      }}
                      className="w-full accent-zinc-50 bg-zinc-800 rounded h-1 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Max Duration</span>
                      <span>{maxDuration}m</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={maxDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMaxDuration(Math.max(val, minDuration));
                      }}
                      className="w-full accent-zinc-50 bg-zinc-800 rounded h-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Stop Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-medium text-xs py-2.5 rounded transition-all cursor-pointer flex items-center justify-center gap-2 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Spawning Process...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Launch Stability Suite</span>
                    </>
                  )}
                </button>

                {activeSessions > 0 && (
                  <button
                    type="button"
                    onClick={handleStopAll}
                    className="w-full bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/60 font-medium text-xs py-2.5 rounded transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Stop All Sessions ({activeSessions})</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Diagnostics and Terminal Column (2/3 Main Body) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Minimal Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              
              {/* Concurrency Counter */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">Concurrencies</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-zinc-50 leading-none">{activeSessions}</span>
                  <span className="text-xs text-zinc-600 font-mono">/ {maxCapacity}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] font-mono text-zinc-500">Capacity: {utilization}</span>
                </div>
              </div>

              {/* Success Badge */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">Success Runs</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 leading-none">
                  {totalSuccess}
                </div>
                <span className="text-[9px] font-mono text-zinc-500 mt-2">Closed with code 0</span>
              </div>

              {/* Failures Badge */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">Failures</span>
                <div className="text-2xl font-bold font-mono text-rose-500 leading-none">
                  {totalFailed}
                </div>
                <span className="text-[9px] font-mono text-zinc-500 mt-2">Crashed or timed out</span>
              </div>

              {/* Total Launched */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">Aggregated runs</span>
                <div className="text-2xl font-bold font-mono text-zinc-50 leading-none">
                  {totalLaunched}
                </div>
                <span className="text-[9px] font-mono text-zinc-500 mt-2">Cumulative launches</span>
              </div>
            </div>

            {/* Raw Monospace Log Terminal */}
            <div className="bg-black border border-zinc-800 rounded overflow-hidden">
              {/* Terminal Titlebar */}
              <div className="bg-zinc-950 px-4 py-2.5 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-mono text-zinc-400">telemetry-log-stream</span>
                </div>
                
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 font-mono px-2 py-0.5 rounded border border-zinc-900 hover:border-zinc-800 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Console
                </button>
              </div>

              {/* Monospace Output Lines */}
              <div className="p-4 h-96 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-black scrollbar-thin scrollbar-thumb-zinc-850">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-700 italic font-mono select-none">
                    $ tail -f stdout
                  </div>
                ) : (
                  logs.map((log) => {
                    let textClass = 'text-zinc-300';
                    let label = '';
                    
                    if (log.type === 'stderr') {
                      textClass = 'text-rose-500';
                      label = '[STDERR] ';
                    } else if (log.type === 'SYSTEM') {
                      textClass = 'text-sky-400';
                      label = '[SYSTEM] ';
                    } else if (log.type === 'ERROR') {
                      textClass = 'text-red-600 font-bold';
                      label = '[CRASH] ';
                    }

                    return (
                      <div key={log.id} className="flex items-start gap-3 select-text hover:bg-zinc-900/30 px-1 py-0.5 rounded transition-all">
                        <span className="text-zinc-650 shrink-0 select-none">{log.time}</span>
                        <span className="text-zinc-500 shrink-0 select-none">[{log.pid}]</span>
                        <span className={`${textClass} whitespace-pre-wrap break-all`}>
                          {label}{log.text}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>

          </div>
        </div>

        {/* Notifications and status messages rendering */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0 font-mono">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded text-xs border backdrop-blur flex items-start gap-2.5 transition-all shadow-lg ${
                notif.type === 'success'
                  ? 'bg-zinc-950 border-emerald-900/60 text-emerald-400'
                  : notif.type === 'warning'
                  ? 'bg-zinc-950 border-amber-900/60 text-amber-400'
                  : 'bg-zinc-950 border-rose-950/60 text-rose-500'
              }`}
            >
              {notif.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              {notif.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              
              <div className="space-y-0.5">
                <p className="font-semibold">{notif.message}</p>
                {notif.details && <p className="text-[10px] text-zinc-500">{notif.details}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
