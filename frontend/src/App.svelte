<script lang="ts">
  import { OpenTraceDialog, LoadSampleTrace } from '../wailsjs/go/main/App'
  import { traceStore } from './stores/trace'
  import { prefs } from './stores/prefs'
  import type { TraceSummary } from './lib/types'
  import TimelineCanvas from './components/TimelineCanvas.svelte'
  import Controls from './components/Controls.svelte'
  import GraphCanvas from './components/GraphCanvas.svelte'
  import Legend from './components/Legend.svelte'
  import EmptyState from './components/EmptyState.svelte'
  import SettingsPopup from './components/SettingsPopup.svelte'

  const { summary } = traceStore
  const { dict, theme, sys, guide, onboarded } = prefs
  let error = ''
  let loading = false
  let settingsOpen = false
  let tourOpen = false // used by Task 14's GuideTour; the ? button sets it

  // Reflect theme on <html> so the CSS variable sets switch app-wide.
  $: if (typeof document !== 'undefined') document.documentElement.dataset.theme = $theme
  // prefs.sys is the persisted source of truth; traceStore mirrors it for the
  // existing filter plumbing (both canvases read traceStore.showSystem).
  $: traceStore.setShowSystem($sys)

  async function open() {
    error = ''
    loading = true
    try {
      const s = (await OpenTraceDialog()) as unknown as TraceSummary | null
      if (s) {
        traceStore.loadSummary(s)
        onLoaded()
      }
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  function onLoaded() {
    // Task 14 wires first-run onboarding here.
  }

  async function openSample() {
    error = ''
    loading = true
    try {
      const s = (await LoadSampleTrace()) as unknown as TraceSummary | null
      if (s) {
        traceStore.loadSummary(s)
        onLoaded()
      }
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code !== 'Space' || !$summary) return
    // If a control (button/select/checkbox) is focused, let its native Space
    // activation handle it — otherwise both fire and the toggle cancels out.
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    traceStore.toggle()
  }
</script>

<svelte:window on:keydown={onKeydown} />

<main>
  <header data-tour="header">
    <button class="open-btn" on:click={open} disabled={loading}>{$dict.openBtn}</button>
    {#if $summary}
      <span class="info">
        {$dict.info(
          $summary.goroutines.length,
          $summary.edges.length,
          (($summary.endTime - $summary.startTime) / 1e6).toFixed(1),
        )}
      </span>
      <Controls />
    {/if}
    <div class="header-right">
      <button class="round" title={$dict.settingsTip} on:click={() => (settingsOpen = !settingsOpen)}>⚙</button>
      <button class="round" title={$dict.helpTip} on:click={() => { if ($summary) tourOpen = true }}>?</button>
    </div>
  </header>

  {#if settingsOpen}
    <SettingsPopup on:close={() => (settingsOpen = false)} />
  {/if}

  {#if error}
    <div class="error-banner" role="alert">
      <span class="error-text">{error}</span>
      <button class="dismiss" on:click={() => (error = '')} aria-label="Dismiss error">×</button>
    </div>
  {/if}

  {#if $summary}
    <section class="timeline"><TimelineCanvas /></section>
    <section class="graph"><GraphCanvas /></section>
  {:else}
    <EmptyState on:sample={openSample} on:open={open} />
  {/if}
  {#if $summary}<Legend />{/if}
</main>

<style>
  main { font-family: system-ui, sans-serif; color: var(--text); background: var(--bg); height: 100vh; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .open-btn { background: var(--accent); color: white; border: 0; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
  .open-btn:disabled { opacity: 0.6; cursor: default; }
  .info { font-size: 13px; color: var(--muted); }
  .error-banner {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; background: #3a2326; border-bottom: 1px solid #5e2f33;
    color: #f0b7b3; font-size: 13px;
  }
  .error-text { flex: 1; }
  .dismiss {
    background: transparent; border: 0; color: #f0b7b3; cursor: pointer;
    font-size: 18px; line-height: 1; padding: 0 4px;
  }
  .timeline { flex: 0 0 42%; overflow: auto; border-bottom: 1px solid var(--border); position: relative; }
  .graph { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
  .graph :global(.graph-wrap) { flex: 1; min-height: 0; }
  .header-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .round { background: transparent; color: var(--muted); border: 1px solid var(--border); width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 13px; line-height: 1; }
</style>
