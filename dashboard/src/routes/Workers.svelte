<script lang="ts">
  import { onMount } from "svelte";
  import StatusBadge from "../components/StatusBadge.svelte";
  import { workers, loadWorkers } from "../lib/stores";
  import type { WorkerInfo } from "../lib/api";

  let selectedWorker = $state<WorkerInfo | null>(null);

  onMount(() => {
    loadWorkers();
  });

  function selectWorker(w: WorkerInfo) {
    selectedWorker = selectedWorker?.id === w.id ? null : w;
  }
</script>

<div class="workers-page">
  <div class="workers-grid">
    <h2 class="section-title">Workers ({$workers.length})</h2>
    <div class="grid">
      {#each $workers as worker (worker.id)}
        <div
          class="worker-card"
          class:selected={selectedWorker?.id === worker.id}
          onclick={() => selectWorker(worker)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && selectWorker(worker)}
        >
          <div class="card-header">
            <span class="worker-name">{worker.hostname}</span>
            <StatusBadge status={worker.status} />
          </div>
          <div class="card-metrics">
            <div class="metric">
              <span class="metric-val">{worker.resources.cpus} CPU</span>
              <span class="metric-lbl">{(worker.resources.memory / 1024).toFixed(0)} GB</span>
            </div>
            <div class="metric">
              <span class="metric-val">{worker.currentJob ? 1 : 0}/1</span>
              <span class="metric-lbl">jobs</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="heartbeat">{worker.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleString() : 'never'}</span>
          </div>
        </div>
      {:else}
        <div class="empty">No workers connected.</div>
      {/each}
    </div>
  </div>

  {#if selectedWorker}
    <div class="detail-panel">
      <h3 class="detail-title">{selectedWorker.hostname}</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Status</span>
          <StatusBadge status={selectedWorker.status} />
        </div>
        <div class="detail-item">
          <span class="detail-label">ID</span>
          <span class="detail-val">{selectedWorker.id}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">CPU</span>
          <span class="detail-val">{selectedWorker.resources.cpus} cores</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Memory</span>
          <span class="detail-val">{(selectedWorker.resources.memory / 1024).toFixed(1)} GB</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Current Job</span>
          <span class="detail-val">{selectedWorker.currentJob ?? 'none'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Last Heartbeat</span>
          <span class="detail-val">{new Date(selectedWorker.lastHeartbeat).toLocaleString()}</span>
        </div>
      </div>
      <div class="labels-section">
        <span class="detail-label">Labels</span>
        <div class="label-chips">
          {#each Object.entries(selectedWorker.labels) as [key, val]}
            <span class="label-chip">{key}={val}</span>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .workers-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .worker-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .worker-card:hover {
    border-color: var(--accent);
  }
  .worker-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .worker-name {
    font-weight: 600;
    font-size: 14px;
  }
  .card-metrics {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
  }
  .metric {
    display: flex;
    flex-direction: column;
  }
  .metric-val {
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .metric-lbl {
    font-size: 11px;
    color: var(--text-muted);
  }
  .card-footer {
    font-size: 11px;
    color: var(--text-muted);
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    grid-column: 1 / -1;
  }
  .detail-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    background: var(--bg-secondary);
  }
  .detail-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .detail-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  .detail-val {
    font-size: 14px;
    font-weight: 600;
  }
  .labels-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .label-chip {
    padding: 2px 10px;
    background: var(--bg-tertiary);
    border-radius: 999px;
    font-size: 12px;
    color: var(--accent);
  }
</style>