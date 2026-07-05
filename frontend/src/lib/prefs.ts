// Persistent user preferences: types, defaults, and (de)serialization against a
// localStorage-like store. Pure — the Svelte store wrapper lives in stores/prefs.ts.

export type Lang = 'en' | 'ko'
export type Theme = 'dark' | 'light'
export type GuideVariant = 'tour' | 'callouts' | 'inline'

export interface Prefs {
  lang: Lang
  theme: Theme
  guide: GuideVariant
  loop: boolean
  labels: boolean | null // null = defer to guide style (inline shows labels)
  cb: boolean // colorblind-friendly palette
  sys: boolean // show system goroutines
  onboarded: boolean // first-run guide already shown
}

export const KEYS = {
  lang: 'tracego.lang',
  theme: 'tracego.theme',
  guide: 'tracego.guide',
  loop: 'tracego.loop',
  labels: 'tracego.labels',
  cb: 'tracego.cb',
  sys: 'tracego.sys',
  onboarded: 'tracego.onboarded',
} as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function detectLang(navLang: string | undefined): Lang {
  return navLang && navLang.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export function loadPrefs(storage: StorageLike | null, navLang?: string): Prefs {
  const get = (k: string): string | null => {
    try {
      return storage ? storage.getItem(k) : null
    } catch {
      return null
    }
  }
  const bool = (k: string) => get(k) === 'true'
  const lang = get(KEYS.lang)
  const theme = get(KEYS.theme)
  const guide = get(KEYS.guide)
  const labels = get(KEYS.labels)
  return {
    lang: lang === 'en' || lang === 'ko' ? lang : detectLang(navLang),
    theme: theme === 'light' ? 'light' : 'dark',
    guide: guide === 'callouts' || guide === 'inline' ? guide : 'tour',
    loop: bool(KEYS.loop),
    labels: labels === null ? null : labels === 'true',
    cb: bool(KEYS.cb),
    sys: bool(KEYS.sys),
    onboarded: bool(KEYS.onboarded),
  }
}

// Best-effort persist; null means "no explicit choice" and is never written.
export function savePref(storage: StorageLike | null, key: string, value: string | boolean | null): void {
  if (!storage || value === null) return
  try {
    storage.setItem(key, String(value))
  } catch {
    // storage unavailable (private mode etc.) — prefs just won't survive restarts
  }
}

export function effectiveLabels(labels: boolean | null, guide: GuideVariant): boolean {
  return labels ?? guide === 'inline'
}
