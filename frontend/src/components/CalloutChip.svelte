<script lang="ts">
  export let n: number
  export let title: string
  export let body: string
  export let pos: string // e.g. "top:10px; right:14px"
</script>

<div class="chip" style={pos}>
  <span class="num">{n}</span>
  <span class="chip-text"><b>{title}</b> {body}</span>
</div>

<style>
  .chip {
    position: absolute; z-index: 20; display: flex; gap: 8px; align-items: flex-start; max-width: 290px;
    background: var(--chipbg); border: 1px solid var(--chipbd); border-radius: 8px; padding: 8px 10px;
    font-size: 12px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }
  .num {
    flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #ffffff;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .chip-text { line-height: 1.45; color: var(--muted); }
  .chip-text b { color: var(--text); }
</style>
