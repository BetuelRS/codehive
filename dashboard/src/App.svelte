<script lang="ts">
  import { onMount } from "svelte";
  import { currentView, initWS, loadWorkers, workers } from "./lib/stores";
  import type { View } from "./lib/stores";
  import Dashboard from "./routes/Dashboard.svelte";
  import Executions from "./routes/Executions.svelte";
  import Workers from "./routes/Workers.svelte";
  import Settings from "./routes/Settings.svelte";
  import StatusBadge from "./components/StatusBadge.svelte";

  const nav: { id: View; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "◉" },
    { id: "executions", label: "Executions", icon: "▷" },
    { id: "workers", label: "Workers", icon: "⚙" },
    { id: "settings", label: "Settings", icon: "⚡" },
  ];

  let onlineCount = $derived($workers.filter((w) => w.status === "idle" || w.status === "busy").length);

  onMount(() => {
    initWS();
    loadWorkers();
  });
</script>

<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <span class="logo">◇</span>
      <span class="brand-name">CodeHive</span>
    </div>
    <nav class="nav">
      {#each nav as item}
        <button
          class="nav-item"
          class:active={$currentView === item.id}
          onclick={() => currentView.set(item.id)}
        >
          <span class="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>
    <div class="sidebar-footer">
      <span class="version">v1.0.0</span>
    </div>
  </aside>

  <div class="main">
    <header class="header">
      <h1 class="page-title">
        {#if $currentView === "dashboard"}Dashboard
        {:else if $currentView === "executions"}Executions
        {:else if $currentView === "workers"}Workers
        {:else}Settings{/if}
      </h1>
      <div class="header-status">
        <StatusBadge
          status={onlineCount > 0 ? "online" : "offline"}
          label="{onlineCount} worker{onlineCount !== 1 ? 's' : ''}"
        />
      </div>
    </header>
    <main class="content">
      {#if $currentView === "dashboard"}
        <Dashboard />
      {:else if $currentView === "executions"}
        <Executions />
      {:else if $currentView === "workers"}
        <Workers />
      {:else if $currentView === "settings"}
        <Settings />
      {/if}
    </main>
  </div>
</div>

<style>
  .layout {
    display: flex;
    height: 100%;
  }
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 18px;
    border-bottom: 1px solid var(--border);
  }
  .logo {
    font-size: 24px;
    color: var(--accent);
  }
  .brand-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 2px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-secondary);
    font-weight: 500;
    transition: all 0.15s;
    text-align: left;
    width: 100%;
  }
  .nav-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .nav-item.active {
    background: var(--accent);
    color: #fff;
  }
  .nav-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
  }
  .sidebar-footer {
    padding: 12px 18px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-primary);
  }
  .page-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .header-status {
    display: flex;
    align-items: center;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
</style>
