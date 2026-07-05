<script lang="ts">
  import { traceStore } from '../stores/trace'
  import { prefs } from '../stores/prefs'

  const { playing, speed } = traceStore
  const { dict, sys } = prefs
  const SPEEDS = [0.25, 0.5, 1, 2, 4]

  function onSpeed(e: Event) {
    traceStore.setSpeed(Number((e.target as HTMLSelectElement).value))
  }
</script>

<div class="controls">
  <button class="play" on:click={() => traceStore.toggle()} title="Play/Pause (Space)">
    {$playing ? '⏸' : '▶'}
  </button>

  <label class="speed">
    {$dict.speed}
    <select on:change={onSpeed} value={$speed}>
      {#each SPEEDS as s}
        <option value={s}>{s}×</option>
      {/each}
    </select>
  </label>

  <label class="sys">
    <input type="checkbox" checked={$sys} on:change={(e) => sys.set(e.currentTarget.checked)} />
    {$dict.sys}
  </label>
</div>

<style>
  .controls { display: flex; align-items: center; gap: 14px; }
  .play { background: var(--btn2); color: var(--text); border: 0; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .speed, .sys { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .sys { cursor: pointer; }
  select { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; }
</style>
