// Theme/colorblind-aware color palette for both canvases, the legend, and the
// empty-state preview cards. Pure: components subscribe to a derived store that
// calls makePalette (stores/prefs.ts).
import type { IntervalState } from './format'
import type { EdgeCategory } from './types'
import type { Theme } from './prefs'

export interface Palette {
  state: Record<IntervalState, string>
  category: Record<EdgeCategory, string>
  dim: string // node not alive / inactive edge
  ring: string // selection ring / super-node outline
  ghost: number // focus-mode alpha for non-chain elements
  accent: string // playhead / primary buttons
  canvasBg: string
  text: string // lane & node labels
  headerBand: string // timeline group-header background
}

export function makePalette(theme: Theme, colorblind: boolean): Palette {
  const light = theme === 'light'
  return {
    state: colorblind
      ? { running: '#0072b2', runnable: '#9aa3b2', blocked: '#d55e00' }
      : { running: '#4caf50', runnable: '#9aa3b2', blocked: '#c25450' },
    category: { channel: '#5b8def', mutex: '#e0a030', other: '#a78bdb' },
    dim: light ? '#d4d8e0' : '#2a2e38',
    ring: light ? '#12161f' : '#ffffff',
    ghost: 0.15,
    accent: light ? '#3e6fd9' : '#5b8def',
    canvasBg: light ? '#f5f6f8' : '#0f1117',
    text: light ? '#333a4a' : '#cdd3df',
    headerBand: light ? '#e3e6ec' : '#1b2130',
  }
}
