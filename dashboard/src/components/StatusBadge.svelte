<script lang="ts">
  let {
    status,
    label,
  }: { status: string; label?: string } = $props();

  const colors: Record<string, string> = {
    idle: "var(--green)",
    online: "var(--green)",
    offline: "var(--text-muted)",
    busy: "var(--yellow)",
    completed: "var(--green)",
    running: "var(--blue)",
    queued: "var(--yellow)",
    pending: "var(--yellow)",
    failed: "var(--red)",
    timeout: "var(--orange)",
  };

  const bgColors: Record<string, string> = {
    idle: "var(--green-bg)",
    online: "var(--green-bg)",
    offline: "transparent",
    busy: "var(--yellow-bg)",
    completed: "var(--green-bg)",
    running: "var(--blue-bg)",
    queued: "var(--yellow-bg)",
    pending: "var(--yellow-bg)",
    failed: "var(--red-bg)",
    timeout: "var(--orange-bg)",
  };
</script>

<span
  class="badge"
  style="--badge-color: {colors[status] || 'var(--text-muted)'}; --badge-bg: {bgColors[status] || 'transparent'}"
>
  <span class="dot"></span>
  {label || status}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    color: var(--badge-color);
    background: var(--badge-bg);
    border: 1px solid color-mix(in srgb, var(--badge-color) 25%, transparent);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--badge-color);
  }
</style>
