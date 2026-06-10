<script lang="ts">
  let theme = $state("dark");
  let wsReconnect = $state(true);
  let pollingInterval = $state(10);
  let saved = $state(false);

  function save() {
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="settings-page">
  <h2 class="page-title">Settings</h2>

  <div class="section">
    <h3 class="section-title">Appearance</h3>
    <div class="field">
      <label class="field-label" for="theme-select">Theme</label>
      <select id="theme-select" class="select" bind:value={theme}>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Connection</h3>
    <div class="field">
      <label class="field-label" for="ws-toggle">WebSocket Auto-Reconnect</label>
      <label class="toggle">
        <input id="ws-toggle" type="checkbox" bind:checked={wsReconnect} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="field">
      <label class="field-label" for="polling-interval">Polling Interval (seconds)</label>
      <input
        id="polling-interval"
        class="input"
        type="number"
        min="5"
        max="120"
        bind:value={pollingInterval}
      />
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">API</h3>
    <div class="field">
      <span class="field-label">API Endpoint</span>
      <code class="endpoint">/api</code>
    </div>
    <div class="field">
      <span class="field-label">WebSocket Endpoint</span>
      <code class="endpoint">/ws</code>
    </div>
  </div>

  <div class="actions">
    <button class="btn primary" onclick={save}>
      {saved ? "Saved!" : "Save Settings"}
    </button>
  </div>
</div>

<style>
  .settings-page {
    max-width: 600px;
  }
  .page-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .section {
    margin-bottom: 24px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .field:last-child {
    border-bottom: none;
  }
  .field-label {
    font-size: 14px;
    font-weight: 500;
  }
  .select,
  .input {
    padding: 6px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    width: 160px;
  }
  .select:focus,
  .input:focus {
    border-color: var(--accent);
  }
  .endpoint {
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--accent);
  }
  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    cursor: pointer;
  }
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary);
    border-radius: 999px;
    border: 1px solid var(--border);
    transition: background 0.2s;
  }
  .slider::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    left: 2px;
    top: 2px;
    background: var(--text-secondary);
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle input:checked + .slider {
    background: var(--accent);
    border-color: var(--accent);
  }
  .toggle input:checked + .slider::after {
    transform: translateX(18px);
    background: #fff;
  }
  .actions {
    margin-top: 20px;
  }
  .btn.primary {
    padding: 10px 24px;
    background: var(--accent);
    color: #fff;
    border-radius: var(--radius);
    font-weight: 500;
    transition: background 0.15s;
  }
  .btn.primary:hover {
    background: var(--accent-hover);
  }
</style>
