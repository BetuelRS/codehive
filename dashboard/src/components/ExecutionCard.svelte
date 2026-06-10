<script lang="ts">
  import StatusBadge from "./StatusBadge.svelte";
  import type { ExecutionResult } from "../lib/api";
  import { formatDuration, timeAgo } from "../lib/api";

  let {
    execution,
    expanded = false,
  }: { execution: ExecutionResult; expanded?: boolean } = $props();

  let showDetails = $state(false);
  $effect(() => { if (expanded) showDetails = true; });
</script>

<div class="card" class:expanded={showDetails}>
  <div class="header" onclick={() => (showDetails = !showDetails)} onkeydown={(e) => e.key === 'Enter' && (showDetails = !showDetails)} role="button" tabindex="0">
    <div class="meta">
      <span class="lang-tag">{execution.language}</span>
      <StatusBadge status={execution.status} />
      <span class="duration">{formatDuration(execution.durationMs)}</span>
    </div>
    <span class="time">{timeAgo(execution.createdAt)}</span>
  </div>

  {#if showDetails}
    <div class="body">
      <div class="section">
        <div class="section-title">Code</div>
        <pre class="code-block">{execution.code}</pre>
      </div>

      {#if execution.stdin}
        <div class="section">
          <div class="section-title">Stdin</div>
          <pre class="code-block">{execution.stdin}</pre>
        </div>
      {/if}

      <div class="cols">
        {#if execution.stdout}
          <div class="section">
            <div class="section-title">Stdout</div>
            <pre class="code-block output">{execution.stdout}</pre>
          </div>
        {/if}
        {#if execution.stderr}
          <div class="section">
            <div class="section-title">Stderr</div>
            <pre class="code-block error">{execution.stderr}</pre>
          </div>
        {/if}
      </div>

      <div class="footer-meta">
        <span>Exit: {execution.exitCode ?? "—"}</span>
        <span>ID: {execution.id.slice(0, 8)}</span>
        {#if execution.workerId}
          <span>Worker: {execution.workerId}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .card:hover {
    border-color: var(--accent);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lang-tag {
    padding: 1px 8px;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
  }
  .duration {
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .time {
    font-size: 12px;
    color: var(--text-muted);
  }
  .body {
    padding: 0 14px 14px;
    border-top: 1px solid var(--border);
  }
  .section {
    margin-top: 10px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .code-block {
    padding: 8px 10px;
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
  .code-block.output {
    color: var(--green);
  }
  .code-block.error {
    color: var(--red);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .footer-meta {
    display: flex;
    gap: 16px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
