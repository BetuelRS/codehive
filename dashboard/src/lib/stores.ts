/** Svelte stores for dashboard state management. */
import { writable, derived } from "svelte/store";
import type { ExecutionResult, WorkerInfo, DashboardStats } from "./api";
import { api, connectWS } from "./api";

/** Navigation view type. */
export type View = "dashboard" | "executions" | "workers" | "settings";

/** Current active view. */
export const currentView = writable<View>("dashboard");

/** List of past executions. */
export const executions = writable<ExecutionResult[]>([]);
/** Total execution count for pagination. */
export const executionTotal = writable(0);
/** Loading state for executions fetch. */
export const executionsLoading = writable(false);

/** List of workers from API. */
export const workers = writable<WorkerInfo[]>([]);
/** Loading state for workers fetch. */
export const workersLoading = writable(false);

/** Dashboard aggregate stats. */
export const stats = writable<DashboardStats | null>(null);
/** Loading state for stats fetch. */
export const statsLoading = writable(false);

/** Currently selected execution detail. */
export const selectedExecution = writable<ExecutionResult | null>(null);
/** Real-time execution feed via WebSocket. */
export const liveFeed = writable<ExecutionResult[]>([]);

/** Handles incoming WebSocket message — updates live feed. */
function onWSMessage(ev: MessageEvent) {
  try {
    const data = JSON.parse(ev.data);
    if (data.type === "execution_update" || data.type === "execution_complete") {
      liveFeed.update((f) => [data.payload as ExecutionResult, ...f].slice(0, 50));
    }
  } catch {
    /* ignore */
  }
}

/** Initialises WebSocket connection with auto-reconnect. */
export function initWS() {
  try {
    const ws = connectWS();
    ws.onmessage = onWSMessage;
    ws.onclose = () => setTimeout(initWS, 3000);
    ws.onerror = () => ws.close();
  } catch {
    setTimeout(initWS, 5000);
  }
}

/** Fetches dashboard stats from API. */
export async function loadStats() {
  statsLoading.set(true);
  try {
    const s = await api.getStats();
    stats.set(s);
  } finally {
    statsLoading.set(false);
  }
}

/** Fetches executions list with pagination. */
export async function loadExecutions(limit = 50, offset = 0) {
  executionsLoading.set(true);
  try {
    const res = await api.getExecutions({ limit, offset });
    executions.set(res.items);
    executionTotal.set(res.total);
  } finally {
    executionsLoading.set(false);
  }
}

/** Fetches workers list from API. */
export async function loadWorkers() {
  workersLoading.set(true);
  try {
    const w = await api.getWorkers();
    workers.set(w);
  } finally {
    workersLoading.set(false);
  }
}

/** Derived: only online workers. */
export const onlineWorkers = derived(workers, ($w) =>
  $w.filter((w) => w.status === "online")
);

/** Derived: only failed executions. */
export const failedExecutions = derived(executions, ($e) =>
  $e.filter((e) => e.status === "failed")
);
