import { writable, derived, type Writable, type Readable } from 'svelte/store'
import { loadPrefs, savePref, KEYS, type Lang, type Theme, type GuideVariant } from '../lib/prefs'
import { t, type Dict } from '../lib/i18n'
import { makePalette, type Palette } from '../lib/palette'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface PrefsStore {
  lang: Writable<Lang>
  theme: Writable<Theme>
  guide: Writable<GuideVariant>
  loop: Writable<boolean>
  labels: Writable<boolean | null>
  cb: Writable<boolean>
  sys: Writable<boolean>
  onboarded: Writable<boolean>
  dict: Readable<Dict>
  palette: Readable<Palette>
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

// createPrefsStore wires each preference to localStorage: initial values come
// from loadPrefs, every set/update writes through via savePref.
export function createPrefsStore(
  storage: StorageLike | null = defaultStorage(),
  navLang: string | undefined = typeof navigator !== 'undefined' ? navigator.language : undefined,
): PrefsStore {
  const p = loadPrefs(storage, navLang)

  function persisted<T extends string | boolean | null>(key: string, initial: T): Writable<T> {
    const w = writable<T>(initial)
    return {
      subscribe: w.subscribe,
      set(v: T) {
        savePref(storage, key, v)
        w.set(v)
      },
      update(fn: (cur: T) => T) {
        w.update((cur) => {
          const v = fn(cur)
          savePref(storage, key, v)
          return v
        })
      },
    }
  }

  const lang = persisted<Lang>(KEYS.lang, p.lang)
  const theme = persisted<Theme>(KEYS.theme, p.theme)
  const cb = persisted<boolean>(KEYS.cb, p.cb)
  return {
    lang,
    theme,
    guide: persisted<GuideVariant>(KEYS.guide, p.guide),
    loop: persisted<boolean>(KEYS.loop, p.loop),
    labels: persisted<boolean | null>(KEYS.labels, p.labels),
    cb,
    sys: persisted<boolean>(KEYS.sys, p.sys),
    onboarded: persisted<boolean>(KEYS.onboarded, p.onboarded),
    dict: derived(lang, (l) => t(l)),
    palette: derived([theme, cb], ([th, c]) => makePalette(th, c)),
  }
}

// The app-wide singleton (mirrors stores/trace.ts).
export const prefs = createPrefsStore()
