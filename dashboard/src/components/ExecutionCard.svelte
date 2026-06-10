<script lang="ts">
  import type { ExecutionResult } from "../lib/api";

  let { execution, expanded = false }: { execution: ExecutionResult; expanded?: boolean } = $props();

  function statusClass(status: string): string {
    if (status === "completed") return "status-ok";
    if (status === "failed") return "status-err";
    if (status === "timeout") return "status-warn";
    return "status-pending";
  }
</script>

<div class="exec-card" class:expanded>
  <div class="card-header">
    <span class="exec-id">{execution.id.slice(0, 8)}</span>
    <span class="lang-badge">{execution.language ?? '-'}</span>
    <span class={statusClass(execution.status)}>{execution.status}</span>
  </div>
  {#if expanded}
    <div class="card-body">
      {#if execution.startedAt}
        <div class="row">
          <span class="label">Started</span>
          <span>{execution.startedAt}</span>
        </div>
      {/if}
      {#if execution.finishedAt}
        <div class="row">
          <span class="label">Finished</span>
          <span>{execution.finishedAt}</span>
        </div>
      {/if}
      {#if execution.durationMs}
        <div class="row">
          <span class="label">Duration</span>
          <span>{(execution.durationMs / 1000).toFixed(2)}s</span>
        </div>
      {/if}
      {#if execution.exitCode !== null}
        <div class="row">
          <span class="label">Exit Code</span>
          <span>{execution.exitCode}</span>
        </div>
      {/if}
      {#if execution.stdout}
        <div class="block">
          <span class="label">stdout</span>
          <pre>{execution.stdout}</pre>
        </div>
      {/if}
      {#if execution.stderr}
        <div class="block">
          <span class="label">stderr</span>
          <pre class="stderr">{execution.stderr}</pre>
        </div>
      {/if}
      {#if execution.error}
        <div class="block">
          <span class="label">Error</span>
          <pre class="error">{execution.error}</pre>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card-preview">
      {#if execution.stdout}
        <pre class="preview">{execution.stdout.slice(0, 120)}</pre>
      {:else if execution.stderr}
        <pre class="preview stderr">{execution.stderr.slice(0, 120)}</pre>
      {:else if execution.status === "queued" || execution.status === "running"}
        <span class="muted">{execution.status}...</span>
      {:else}
        <span class="muted">No output</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .exec-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    background: var(--bg-secondary);
    transition: border-color 0.15s;
  }
  .exec-card:hover {
    border-color: var(--accent);
  }
  .expanded {
    border-color: var(--accent);
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .exec-id {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .lang-badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
  }
  .status-ok { color: var(--green); font-size: 12px; font-weight: 500; }
  .status-err { color: var(--red); font-size: 12px; font-weight: 500; }
  .status-warn { color: var(--orange); font-size: 12px; font-weight: 500; }
  .status-pending { color: var(--text-muted); font-size: 12px; }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .row {
    display: flex;
    gap: 8px;
    font-size: 13px;
  }
  .label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    min-width: 70px;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  pre {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 8px;
    font-size: 12px;
    overflow-x: auto;
    max-height: 200px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .stderr { color: var(--red); }
  .error { color: var(--red); }
  .card-preview {
    margin-top: 4px;
  }
  .preview {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 6px;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-height: 20px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>