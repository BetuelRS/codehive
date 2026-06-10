<script lang="ts">
  let {
    status,
    label,
  }: { status: string; label?: string } = $props();

  const colors: Record<string, string> = {
    online: "var(--green)",
    offline: "var(--text-muted)",
    busy: "var(--yellow)",
    completed: "var(--green)",
    running: "var(--blue)",
    pending: "var(--yellow)",
    failed: "var(--red)",
  };

  const bgColors: Record<string, string> = {
    online: "var(--green-bg)",
    offline: "transparent",
    busy: "var(--yellow-bg)",
    completed: "var(--green-bg)",
    running: "var(--blue-bg)",
    pending: "var(--yellow-bg)",
    failed: "var(--red-bg)",
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
