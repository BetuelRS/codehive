<script lang="ts">
  import { onMount } from "svelte";
  import CodeEditor from "../components/CodeEditor.svelte";
  import ExecutionCard from "../components/ExecutionCard.svelte";
  import { api, type ExecutionResult } from "../lib/api";
  import { executions, loadExecutions } from "../lib/stores";

  let language = $state("python");
  let code = $state("");
  let stdin = $state("");
  let submitting = $state(false);
  let submitError = $state("");
  let selectedId = $state<string | null>(null);
  let detailExec = $state<ExecutionResult | null>(null);
  let detailLoading = $state(false);

  const languages = [
    "python", "javascript", "typescript", "java", "cpp", "rust", "go"
  ];

  onMount(() => {
    loadExecutions();
  });

  async function submit() {
    if (!code.trim()) return;
    submitting = true;
    submitError = "";
    try {
      await api.submitCode({ language, code, stdin: stdin || undefined });
      code = "";
      stdin = "";
      loadExecutions();
    } catch (e) {
      submitError = e instanceof Error ? e.message : "Submission failed";
    } finally {
      submitting = false;
    }
  }

  async function showDetail(id: string) {
    selectedId = id;
    detailLoading = true;
    try {
      detailExec = await api.getExecution(id);
    } catch {
      detailExec = null;
    } finally {
      detailLoading = false;
    }
  }
</script>

<div class="executions-page">
  <div class="submit-section">
    <h2 class="section-title">New Execution</h2>
    <div class="submit-form">
      <div class="form-row">
        <select bind:value={language} class="select">
          {#each languages as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
        <button class="btn primary" onclick={submit} disabled={submitting || !code.trim()}>
          {submitting ? "Running..." : "Run"}
        </button>
      </div>
      <CodeEditor bind:value={code} {language} />
      <div class="form-row">
        <input
          class="input"
          placeholder="stdin (optional)"
          bind:value={stdin}
        />
      </div>
      {#if submitError}
        <div class="error-msg">{submitError}</div>
      {/if}
    </div>
  </div>

  <div class="history-section">
    <h2 class="section-title">History</h2>
    <div class="exec-list">
      {#each $executions as exec (exec.id)}
        <div
          class="exec-row"
          class:selected={selectedId === exec.id}
          onclick={() => showDetail(exec.id)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && showDetail(exec.id)}
        >
          <span class="lang-badge">{exec.language ?? '-'}</span>
          <span class="status-text">{exec.status}</span>
          <span class="exec-time">{exec.startedAt ?? exec.finishedAt ?? ''}</span>
        </div>
      {:else}
        <div class="empty">No executions found.</div>
      {/each}
    </div>
  </div>

  {#if detailExec}
    <div class="detail-panel">
      <div class="detail-header">
        <h3>Execution Details</h3>
        <button class="btn ghost" onclick={() => (detailExec = null)}>Close</button>
      </div>
      <ExecutionCard execution={detailExec} expanded={true} />
    </div>
  {/if}
</div>

<style>
  .executions-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: start;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .submit-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .form-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .select,
  .input {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    outline: none;
  }
  .select:focus,
  .input:focus {
    border-color: var(--accent);
  }
  .select {
    flex: 1;
  }
  .input {
    width: 100%;
  }
  .btn {
    padding: 8px 20px;
    border-radius: var(--radius);
    font-weight: 500;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn.primary {
    background: var(--accent);
    color: #fff;
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.ghost {
    background: transparent;
    color: var(--text-secondary);
    padding: 4px 12px;
  }
  .btn.ghost:hover {
    color: var(--text-primary);
  }
  .error-msg {
    padding: 8px 12px;
    background: var(--red-bg);
    color: var(--red);
    border-radius: var(--radius-sm);
    font-size: 13px;
  }
  .history-section {
    border-left: 1px solid var(--border);
    padding-left: 20px;
  }
  .exec-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .exec-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.1s;
  }
  .exec-row:hover {
    background: var(--bg-secondary);
  }
  .exec-row.selected {
    background: var(--bg-tertiary);
  }
  .lang-badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
    min-width: 70px;
    text-align: center;
  }
  .status-text {
    font-size: 12px;
    color: var(--text-secondary);
    flex: 1;
  }
  .exec-time {
    font-size: 11px;
    color: var(--text-muted);
  }
  .empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
  }
  .detail-panel {
    grid-column: 1 / -1;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    background: var(--bg-secondary);
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .detail-header h3 {
    font-size: 15px;
    font-weight: 600;
  }
</style>
