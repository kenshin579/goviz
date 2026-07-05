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
  import GuideTour from './components/GuideTour.svelte'
  import CalloutChip from './components/CalloutChip.svelte'
  import { withColorWords } from './lib/i18n'

  const { summary } = traceStore
  const { dict, theme, sys, guide, onboarded, cb } = prefs
  let error = ''
  let loading = false
  let settingsOpen = false
  let tourOpen = false
  let calloutsOpen = false
  // Only the first-run tour should auto-play on finish; a ?-triggered replay
  // must leave playback exactly as the user had it.
  let playOnTourDone = false

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

  // First-run onboarding: shown once per install, in the configured guide style.
  // Inline hints render whenever the style is 'inline' (no flag involved).
  function onLoaded() {
    if ($onboarded) return
    onboarded.set(true)
    if ($guide === 'tour') {
      playOnTourDone = true
      tourOpen = true
    } else if ($guide === 'callouts') {
      calloutsOpen = true
      traceStore.play()
    } else traceStore.play()
  }

  function finishTour() {
    tourOpen = false
    if (playOnTourDone) {
      playOnTourDone = false
      traceStore.play()
    }
  }
  function dismissCallouts() {
    calloutsOpen = false
    traceStore.play()
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
    if (tourOpen || settingsOpen) return
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
      <button class="round" title={$dict.helpTip} disabled={!$summary} on:click={() => { if ($summary) tourOpen = true }}>?</button>
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
    {#if calloutsOpen}
      <div class="banner">
        <span class="banner-first">{$dict.firstTime}</span>
        <span class="banner-desc">{$dict.bannerDesc}</span>
        <button class="banner-btn" on:click={dismissCallouts}>{$dict.gotIt}</button>
      </div>
    {/if}
    <section class="timeline" data-tour="timeline">
      {#if $guide === 'inline'}
        <div class="strip sticky"><b>{$dict.tlStripT}</b>&nbsp;·&nbsp;{$dict.tlStripD}</div>
      {/if}
      <TimelineCanvas />
      {#if calloutsOpen}
        <CalloutChip n={1} title={$dict.chip1T} body={withColorWords($dict.chip1B, $dict, $cb)} pos="top:10px; right:14px" />
        <CalloutChip n={2} title={$dict.chip2T} body={$dict.chip2B} pos="bottom:10px; left:130px" />
      {/if}
    </section>
    <section class="graph" data-tour="graph">
      {#if $guide === 'inline'}
        <div class="strip"><b>{$dict.grStripT}</b>&nbsp;·&nbsp;{$dict.grStripD}</div>
      {/if}
      <GraphCanvas />
      {#if calloutsOpen}
        <CalloutChip n={3} title={$dict.chip3T} body={$dict.chip3B} pos="top:12px; left:14px" />
        <CalloutChip n={4} title={$dict.chip4T} body={$dict.chip4B} pos="bottom:12px; right:14px" />
      {/if}
    </section>
  {:else}
    <EmptyState loading={loading} on:sample={openSample} on:open={open} />
  {/if}
  {#if $summary}<Legend />{/if}
  {#if tourOpen}
    <GuideTour on:done={finishTour} />
  {/if}
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
  .banner { display: flex; align-items: center; gap: 10px; padding: 7px 14px; background: var(--bannerbg); border-bottom: 1px solid var(--bannerbd); font-size: 12.5px; }
  .banner-first { color: var(--accent); font-weight: 600; }
  .banner-desc { color: var(--muted); }
  .banner-btn { margin-left: auto; background: var(--accent); border: 0; color: #ffffff; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
  .strip { padding: 4px 14px; background: var(--panel2); border-bottom: 1px solid var(--border); font-size: 10.5px; letter-spacing: 0.6px; color: var(--muted); }
  .strip b { color: var(--text); font-weight: 600; }
  .sticky { position: sticky; top: 0; z-index: 5; }
</style>
