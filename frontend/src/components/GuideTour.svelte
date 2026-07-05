<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { prefs } from '../stores/prefs'
  import { traceStore } from '../stores/trace'
  import { placeTour, TOUR_TARGETS, POP_W, type TourPlacement } from '../lib/guide'
  import { withColorWords } from '../lib/i18n'

  const { dict, cb } = prefs
  const dispatch = createEventDispatcher<{ done: void }>()

  let step = 1
  let placement: TourPlacement | null = null

  function measure() {
    const el = document.querySelector(`[data-tour="${TOUR_TARGETS[step - 1]}"]`)
    if (!el) {
      placement = null
      return
    }
    placement = placeTour(el.getBoundingClientRect(), window.innerWidth, window.innerHeight)
  }

  function next() {
    if (step >= TOUR_TARGETS.length) {
      dispatch('done')
      return
    }
    step += 1
    measure()
  }
  function back() {
    if (step <= 1) return
    step -= 1
    measure()
  }

  onMount(() => {
    traceStore.pause() // read the tour without the playhead moving
    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  $: ts = $dict.tour[step - 1]
</script>

{#if placement}
  <div
    class="spot"
    style="left:{placement.spot.x}px; top:{placement.spot.y}px; width:{placement.spot.w}px; height:{placement.spot.h}px"
  ></div>
  <div class="pop" style="left:{placement.pop.x}px; top:{placement.pop.y}px; width:{POP_W}px">
    <div class="step-label">{$dict.stepLabel.replace('{n}', String(step))}</div>
    <div class="pop-title">{ts.title}</div>
    <div class="pop-body">{withColorWords(ts.body, $dict, $cb)}</div>
    <div class="buttons">
      <button class="skip" on:click={() => dispatch('done')}>{$dict.skip}</button>
      <button class="back" style="opacity:{step <= 1 ? 0.35 : 1}" on:click={back}>{$dict.back}</button>
      <button class="next" on:click={next}>{step >= TOUR_TARGETS.length ? $dict.done : $dict.next}</button>
    </div>
  </div>
{/if}

<style>
  .spot {
    position: fixed; z-index: 90; border: 1.5px solid var(--accent); border-radius: 8px;
    box-shadow: 0 0 0 9999px var(--shade); pointer-events: none; transition: all 0.25s ease;
  }
  .pop {
    position: fixed; z-index: 95; background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); transition: all 0.25s ease;
    box-sizing: border-box;
  }
  .step-label { font-size: 10.5px; color: var(--accent); font-weight: 700; letter-spacing: 0.8px; }
  .pop-title { font-size: 14px; font-weight: 600; color: var(--strong); margin-top: 4px; }
  .pop-body { font-size: 12.5px; color: var(--muted); line-height: 1.55; margin-top: 6px; text-wrap: pretty; }
  .buttons { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  .skip { background: transparent; border: 0; color: var(--faint); cursor: pointer; font-size: 12px; padding: 4px 0; }
  .back { margin-left: auto; background: transparent; border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 12px; }
  .next { background: var(--accent); border: 0; color: #ffffff; border-radius: 6px; padding: 5px 14px; cursor: pointer; font-size: 12px; font-weight: 600; }
</style>
