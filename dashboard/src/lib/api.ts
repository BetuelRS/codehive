const BASE = "/api";

/** Code submission payload. */
export interface ExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
}

/** Execution result from API. */
export interface ExecutionResult {
  id: string;
  language: string;
  code: string;
  stdin: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  status: "pending" | "running" | "completed" | "failed";
  workerId?: string;
  createdAt: string;
}

/** Worker status from API. */
export interface WorkerInfo {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  load: number;
  runningJobs: number;
  maxJobs: number;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  languages: string[];
  lastSeen: string;
}

/** Dashboard aggregate statistics. */
export interface DashboardStats {
  executions24h: number;
  executions7d: number;
  activeWorkers: number;
  avgDurationMs: number;
  successRate: number;
}

/** Generic fetch wrapper with error handling. */
async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

/** API client methods for all endpoints. */
export const api = {
  submitCode(data: ExecutionRequest): Promise<ExecutionResult> {
    return request("/executions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getExecutions(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ExecutionResult[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request(`/executions${qs ? `?${qs}` : ""}`);
  },

  getExecution(id: string): Promise<ExecutionResult> {
    return request(`/executions/${id}`);
  },

  getWorkers(): Promise<WorkerInfo[]> {
    return request("/workers");
  },

  getWorker(id: string): Promise<WorkerInfo> {
    return request(`/workers/${id}`);
  },

  getStats(): Promise<DashboardStats> {
    return request("/stats");
  },
};

/** Creates WebSocket connection to dashboard server. */
export function connectWS(): WebSocket {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  return ws;
}

/** Formats ms to human-readable duration (e.g. 1.2s, 3m 15s). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/** Formats seconds to human-readable uptime (e.g. 2d 3h 15m). */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

/** Returns relative time string (e.g. 5m ago, 2h ago). */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
