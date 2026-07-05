<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { prefs } from '../stores/prefs'
  import { withColorWords } from '../lib/i18n'

  const { dict, palette, cb } = prefs
  const dispatch = createEventDispatcher<{ sample: void; open: void }>()

  // Static preview-lane segments (percent widths), copied from the mockup.
  const LANES: { label: string; segs: { w: number; s: 'running' | 'runnable' | 'blocked' }[] }[] = [
    { label: 'main', segs: [{ w: 12, s: 'running' }, { w: 55, s: 'blocked' }, { w: 33, s: 'running' }] },
    { label: 'producer', segs: [{ w: 10, s: 'runnable' }, { w: 42, s: 'running' }, { w: 18, s: 'blocked' }, { w: 30, s: 'running' }] },
    { label: 'worker-1', segs: [{ w: 18, s: 'runnable' }, { w: 26, s: 'blocked' }, { w: 56, s: 'running' }] },
  ]
</script>

<div class="empty-rich">
  <div class="col">
    <div>
      <div class="title">{$dict.emptyTitle}</div>
      <div class="desc">{$dict.emptyDesc}</div>
    </div>
    <div class="cards">
      <div class="card">
        <div class="mini-tl">
          {#each LANES as lane}
            <div class="mini-lane">
              <span class="mini-label">{lane.label}</span>
              <div class="mini-bar">
                {#each lane.segs as seg}
                  <div style="width:{seg.w}%;background:{$palette.state[seg.s]}"></div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <div class="card-title">{$dict.card1Title}</div>
        <div class="card-desc">{withColorWords($dict.card1Desc, $dict, $cb)}</div>
      </div>
      <div class="card">
        <svg viewBox="0 0 220 96" class="mini-graph">
          <line x1="60" y1="30" x2="130" y2="55" style="stroke:{$palette.category.channel};stroke-width:2" />
          <line x1="130" y1="55" x2="180" y2="26" style="stroke:{$palette.dim};stroke-width:1.5" />
          <line x1="130" y1="55" x2="95" y2="75" style="stroke:{$palette.category.mutex};stroke-width:2" />
          <circle cx="60" cy="30" r="8" style="fill:{$palette.state.running}" />
          <circle cx="130" cy="55" r="8" style="fill:{$palette.state.blocked}" />
          <circle cx="180" cy="26" r="8" style="fill:{$palette.state.runnable}" />
          <circle cx="95" cy="75" r="8" style="fill:{$palette.dim}" />
        </svg>
        <div class="card-title">{$dict.card2Title}</div>
        <div class="card-desc">{$dict.card2Desc}</div>
      </div>
    </div>
    <div class="actions">
      <button class="primary" on:click={() => dispatch('sample')}>{$dict.sampleBtn}</button>
      <button class="secondary" on:click={() => dispatch('open')}>{$dict.openBtn2}</button>
    </div>
    <div class="hint">
      {$dict.noTracePre}
      <code>go test -trace trace.out ./...</code>
      {$dict.noTracePost}
    </div>
  </div>
</div>

<style>
  .empty-rich { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; }
  .col { max-width: 660px; display: flex; flex-direction: column; gap: 22px; text-align: left; }
  .title { font-size: 22px; font-weight: 600; color: var(--strong); }
  .desc { font-size: 13.5px; color: var(--muted); margin-top: 6px; line-height: 1.55; text-wrap: pretty; }
  .cards { display: flex; gap: 14px; }
  .card { flex: 1; background: var(--panel2); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
  .mini-tl { display: flex; flex-direction: column; gap: 5px; }
  .mini-lane { display: flex; align-items: center; gap: 6px; }
  .mini-label { flex: none; width: 52px; font-size: 10px; color: var(--muted); }
  .mini-bar { flex: 1; display: flex; height: 10px; border-radius: 2px; overflow: hidden; }
  .mini-graph { width: 100%; height: 96px; display: block; }
  .card-title { margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--text); }
  .card-desc { margin-top: 3px; font-size: 11.5px; color: var(--muted); line-height: 1.5; }
  .actions { display: flex; gap: 10px; align-items: center; }
  .primary { background: var(--accent); color: #ffffff; border: 0; padding: 9px 18px; border-radius: 6px; cursor: pointer; font-size: 13.5px; font-weight: 600; }
  .secondary { background: transparent; color: var(--text); border: 1px solid var(--border); padding: 9px 16px; border-radius: 6px; cursor: pointer; font-size: 13.5px; }
  .hint { font-size: 12px; color: var(--faint); }
  code { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; color: var(--muted); font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
</style>
