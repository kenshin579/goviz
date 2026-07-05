<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { prefs } from '../stores/prefs'
  import type { Lang, Theme, GuideVariant } from '../lib/prefs'
  import { effectiveLabels } from '../lib/prefs'

  const { dict, lang, theme, guide, loop, labels, cb, sys } = prefs
  const dispatch = createEventDispatcher<{ close: void }>()

  const LANGS: { v: Lang; label: string }[] = [
    { v: 'en', label: 'English' },
    { v: 'ko', label: '한국어' },
  ]
  $: THEMES = [
    { v: 'dark' as Theme, label: $dict.dark },
    { v: 'light' as Theme, label: $dict.light },
  ]
  $: GUIDES = [
    { v: 'tour' as GuideVariant, label: $dict.guideTour },
    { v: 'callouts' as GuideVariant, label: $dict.guideCall },
    { v: 'inline' as GuideVariant, label: $dict.guideHints },
  ]
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') dispatch('close') }} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch('close')}>
  <div class="panel" on:click|stopPropagation>
    <div class="head">
      <span class="head-title">{$dict.settingsTip}</span>
      <button class="close" title="Close" on:click={() => dispatch('close')}>×</button>
    </div>
    <div class="row">
      <span class="row-label">{$dict.lang}</span>
      <div class="seg">
        {#each LANGS as o}
          <button class:active={$lang === o.v} on:click={() => lang.set(o.v)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="row-label">{$dict.theme}</span>
      <div class="seg">
        {#each THEMES as o}
          <button class:active={$theme === o.v} on:click={() => theme.set(o.v)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="row-label">{$dict.guide}</span>
      <div class="seg">
        {#each GUIDES as o}
          <button class:active={$guide === o.v} on:click={() => guide.set(o.v)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <label class="row toggle">
      <span class="row-label">{$dict.loopL}</span>
      <input type="checkbox" checked={$loop} on:change={(e) => loop.set(e.currentTarget.checked)} />
    </label>
    <label class="row toggle">
      <span class="row-label">{$dict.labelsL}</span>
      <input
        type="checkbox"
        checked={effectiveLabels($labels, $guide)}
        on:change={(e) => labels.set(e.currentTarget.checked)}
      />
    </label>
    <label class="row toggle">
      <span class="row-label">{$dict.cbL}</span>
      <input type="checkbox" checked={$cb} on:change={(e) => cb.set(e.currentTarget.checked)} />
    </label>
    <label class="row toggle">
      <span class="row-label">{$dict.sys}</span>
      <input type="checkbox" checked={$sys} on:change={(e) => sys.set(e.currentTarget.checked)} />
    </label>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 100; background: var(--shade); display: flex; align-items: center; justify-content: center; }
  .panel { width: 320px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45); }
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .head-title { font-size: 14px; font-weight: 600; color: var(--strong); }
  .close { margin-left: auto; background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--border); }
  .row-label { font-size: 13px; color: var(--muted); }
  .seg { display: flex; background: var(--panel2); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .seg button { border: 0; padding: 5px 12px; font-size: 12.5px; cursor: pointer; background: transparent; color: var(--muted); }
  .seg button.active { background: var(--accent); color: #ffffff; }
  .toggle { cursor: pointer; }
  .toggle input { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
</style>
