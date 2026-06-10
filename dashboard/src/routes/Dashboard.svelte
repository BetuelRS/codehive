<script lang="ts">
  import { onMount } from "svelte";
  import { stats, liveFeed, loadStats } from "../lib/stores";
  import { formatDuration } from "../lib/api";
  import ExecutionCard from "../components/ExecutionCard.svelte";

  let statsData = $derived($stats);

  onMount(() => {
    loadStats();
  });
</script>

<div class="dashboard">
  <div class="metrics">
    <div class="metric-card">
      <span class="metric-label">Executions (24h)</span>
      <span class="metric-value">{statsData?.executions24h ?? "—"}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Executions (7d)</span>
      <span class="metric-value">{statsData?.executions7d ?? "—"}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Active Workers</span>
      <span class="metric-value">{statsData?.activeWorkers ?? "—"}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Avg Duration</span>
      <span class="metric-value">{statsData ? formatDuration(statsData.avgDurationMs) : "—"}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Success Rate</span>
      <span class="metric-value">{statsData ? `${(statsData.successRate * 100).toFixed(1)}%` : "—"}</span>
    </div>
  </div>

  <div class="feed-section">
    <h2 class="section-title">Live Feed</h2>
    <div class="feed">
      {#each $liveFeed as exec (exec.id)}
        <ExecutionCard execution={exec} />
      {:else}
        <div class="empty">No executions yet. Submit code to see results.</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
  .metric-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .metric-label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }
  .metric-value {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .feed {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
  }
</style>
