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
  lang: 'goviz.lang',
  theme: 'goviz.theme',
  guide: 'goviz.guide',
  loop: 'goviz.loop',
  labels: 'goviz.labels',
  cb: 'goviz.cb',
  sys: 'goviz.sys',
  onboarded: 'goviz.onboarded',
} as const

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PrefKey = (typeof KEYS)[keyof typeof KEYS]

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

// Best-effort persist; null means "no explicit choice" and removes any stored
// value so loadPrefs falls back to the default on the next start.
export function savePref(storage: StorageLike | null, key: PrefKey, value: string | boolean | null): void {
  if (!storage) return
  try {
    if (value === null) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, String(value))
    }
  } catch {
    // storage unavailable (private mode etc.) — prefs just won't survive restarts
  }
}

export function effectiveLabels(labels: boolean | null, guide: GuideVariant): boolean {
  return labels ?? guide === 'inline'
}
