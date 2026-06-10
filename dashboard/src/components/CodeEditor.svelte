<script lang="ts">
  let {
    value = $bindable(""),
    language = "python",
  }: {
    value?: string;
    language?: string;
  } = $props();

  const langNames: Record<string, string> = {
    python: "Python",
    javascript: "JavaScript",
    typescript: "TypeScript",
    java: "Java",
    cpp: "C++",
    rust: "Rust",
    go: "Go",
  };
</script>

<div class="editor-wrap">
  <div class="toolbar">
    <span class="lang-label">{langNames[language] || language}</span>
  </div>
  <textarea
    class="editor"
    spellcheck="false"
    bind:value
    placeholder="// write code here..."
    rows="12"
  ></textarea>
</div>

<style>
  .editor-wrap {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-secondary);
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
  }
  .lang-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .editor {
    width: 100%;
    padding: 12px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: none;
    outline: none;
    resize: vertical;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 13px;
    line-height: 1.6;
    tab-size: 2;
  }
  .editor:focus {
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .editor::placeholder {
    color: var(--text-muted);
  }
</style>
