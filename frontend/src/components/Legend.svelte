<script lang="ts">
  import { prefs } from '../stores/prefs'
  import type { IntervalState } from '../lib/format'
  import type { EdgeCategory } from '../lib/types'

  const { dict, palette, guide } = prefs

  const STATE_KEYS: IntervalState[] = ['running', 'runnable', 'blocked']
  const EDGE_KEYS: EdgeCategory[] = ['channel', 'mutex', 'other']
</script>

<div class="legend" data-tour="legend">
  {#if $guide === 'inline'}
    <span class="group">{$dict.legStateGroup}</span>
  {/if}
  {#each STATE_KEYS as s}
    <span class="item"><span class="swatch" style="background:{$palette.state[s]}"></span>{$dict.states[s]}</span>
  {/each}
  <span class="item"><span class="swatch" style="background:{$palette.dim}"></span>{$dict.notAlive}</span>
  {#if $guide === 'inline'}
    <span class="group gap">{$dict.legEdgeGroup}</span>
  {/if}
  {#each EDGE_KEYS as e}
    <span class="item"><span class="edge" style="border-top-color:{$palette.category[e]}"></span>{$dict.cats[e]} ({$dict.inferred})</span>
  {/each}
  {#if $guide === 'inline'}
    <span class="hint">{$dict.legFocusHint}</span>
  {/if}
</div>

<style>
  .legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 6px 14px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); align-items: center; }
  .item { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .edge { width: 16px; height: 0; border-top: 2px solid; display: inline-block; }
  .group { font-size: 10px; letter-spacing: 0.6px; color: var(--faint); font-weight: 600; }
  .gap { margin-left: 8px; }
  .hint { margin-left: auto; color: var(--faint); }
</style>
