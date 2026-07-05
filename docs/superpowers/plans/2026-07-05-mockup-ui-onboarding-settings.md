# 목업 기반 UI 개선 (온보딩·설정·테마·i18n·리치 빈 화면) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/design/UI 사용성 개선 제안/GoViz Onboarding.dc.html` 목업의 6개 기능 묶음(온보딩 가이드 3방식, 설정 팝업, 리치 빈 화면+샘플 트레이스, en/ko i18n, dark/light 테마+색약 팔레트, 범례 정리)을 단일 PR로 구현한다.

**Architecture:** 뷰 결정은 순수 `lib/` 모듈(Vitest 테스트) + 컴포넌트는 얇은 렌더러 원칙 유지. 새 `stores/prefs.ts`가 localStorage 지속 설정의 단일 소스이고, `lib/palette.ts`·`lib/i18n.ts`·`lib/guide.ts`가 파생 뷰 값을 계산한다. 유일한 Go 작업은 `LoadSampleTrace()` 바인딩(내장 워크로드를 `runtime/trace`로 녹화해 기존 `parse.Parse`로 파싱).

**Tech Stack:** Svelte 4 + TypeScript + Vitest (frontend), Go + Wails v2 (backend). 새 외부 의존성 없음.

**스펙:** `docs/superpowers/specs/2026-07-05-mockup-ui-onboarding-settings-design.md` — 구현 후 스펙의 "목업 커버리지 체크리스트"를 반드시 대조할 것.

**브랜치:** `feat/ui-onboarding-settings` (이미 생성됨, 스펙 커밋 포함). main 직접 커밋 금지.

**커맨드 (repo 루트 기준):**
- Frontend 테스트: `cd frontend && npm test -- <이름부분문자열>` / 전체: `npm test`
- 타입체크: `cd frontend && npm run check` (에러는 블로킹)
- Go: `go test ./...`, `go build ./...`

---

## File Structure

| 파일 | 역할 |
|---|---|
| Create `frontend/src/lib/prefs.ts` (+`prefs.test.ts`) | 설정 타입·기본값·로케일 감지·localStorage 직렬화 (순수) |
| Create `frontend/src/lib/palette.ts` (+`palette.test.ts`) | `makePalette(theme, colorblind)` → 캔버스/범례 색 (순수) |
| Create `frontend/src/lib/i18n.ts` (+`i18n.test.ts`) | en/ko 사전 + `{run}/{blk}` 색 단어 치환 (순수) |
| Create `frontend/src/lib/guide.ts` (+`guide.test.ts`) | 투어 대상 목록 + 스포트라이트/팝오버 위치 계산 (순수) |
| Create `frontend/src/stores/prefs.ts` (+`prefs.test.ts`) | 지속 설정 스토어 + `dict`/`palette` 파생 스토어 |
| Create `frontend/src/components/SettingsPopup.svelte` | 설정 팝업 |
| Create `frontend/src/components/EmptyState.svelte` | 리치 빈 화면 |
| Create `frontend/src/components/GuideTour.svelte` | 코치마크 투어 |
| Create `frontend/src/components/CalloutChip.svelte` | 콜아웃 번호 칩 (App에서 4회 사용) |
| Modify `frontend/src/lib/format.ts` | 색 상수를 palette 기반 기본값으로 재구현 |
| Modify `frontend/src/lib/playback.ts` (+test) | `nextPlayhead`에 loop 옵션 |
| Modify `frontend/src/lib/tooltip.ts` (+test) | 상태/카테고리 문구를 dict 파라미터로 |
| Modify `frontend/src/lib/timelineLayout.ts` (+test) | `opts.stateColor` 주입 지원 |
| Modify `frontend/src/stores/trace.ts` (+test) | `createTraceStore(getLoop)` |
| Modify `frontend/src/components/TimelineCanvas.svelte` | palette 구독, 테마 색, 힌트 스트립은 App에서 |
| Modify `frontend/src/components/GraphCanvas.svelte` | palette 구독 + 노드 라벨 상시 표시 |
| Modify `frontend/src/components/Legend.svelte` | i18n + palette + 그룹 라벨 + 중복 항목 제거 |
| Modify `frontend/src/components/Controls.svelte` | i18n + sys를 prefs로 |
| Modify `frontend/src/App.svelte` | 테마 적용, 헤더 버튼, 빈 화면, 온보딩 오케스트레이션 |
| Modify `frontend/src/style.css` | CSS 변수 2세트(dark/light) 도입, 보일러플레이트 제거 |
| Modify `app.go` (+`app_test.go`) | `LoadSampleTrace()` 바인딩 + 샘플 워크로드 |
| Modify `frontend/wailsjs/go/main/App.js` / `App.d.ts` | 바인딩 수동 추가 (wails build 시 동일하게 재생성됨) |

---

### Task 1: `lib/prefs.ts` — 설정 타입·직렬화 (순수)

**Files:**
- Create: `frontend/src/lib/prefs.ts`
- Test: `frontend/src/lib/prefs.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/lib/prefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectLang, loadPrefs, savePref, effectiveLabels, KEYS } from './prefs'

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => Object.fromEntries(m),
  }
}

describe('detectLang', () => {
  it('maps ko locales to ko and everything else to en', () => {
    expect(detectLang('ko')).toBe('ko')
    expect(detectLang('ko-KR')).toBe('ko')
    expect(detectLang('en-US')).toBe('en')
    expect(detectLang(undefined)).toBe('en')
  })
})

describe('loadPrefs', () => {
  it('returns defaults from an empty storage (lang via locale)', () => {
    const p = loadPrefs(fakeStorage(), 'ko-KR')
    expect(p).toEqual({
      lang: 'ko', theme: 'dark', guide: 'tour',
      loop: false, labels: null, cb: false, sys: false, onboarded: false,
    })
  })
  it('reads stored values and validates enums', () => {
    const p = loadPrefs(
      fakeStorage({
        [KEYS.lang]: 'en', [KEYS.theme]: 'light', [KEYS.guide]: 'callouts',
        [KEYS.loop]: 'true', [KEYS.labels]: 'false', [KEYS.cb]: 'true',
        [KEYS.sys]: 'true', [KEYS.onboarded]: 'true',
      }),
      'ko',
    )
    expect(p).toEqual({
      lang: 'en', theme: 'light', guide: 'callouts',
      loop: true, labels: false, cb: true, sys: true, onboarded: true,
    })
  })
  it('falls back to defaults on garbage enum values and null storage', () => {
    const p = loadPrefs(fakeStorage({ [KEYS.theme]: 'neon', [KEYS.guide]: 'xxl' }), 'en')
    expect(p.theme).toBe('dark')
    expect(p.guide).toBe('tour')
    expect(loadPrefs(null, 'en').lang).toBe('en')
  })
})

describe('savePref', () => {
  it('stringifies values under the given key and skips null', () => {
    const s = fakeStorage()
    savePref(s, KEYS.loop, true)
    savePref(s, KEYS.lang, 'ko')
    savePref(s, KEYS.labels, null)
    expect(s.dump()).toEqual({ [KEYS.loop]: 'true', [KEYS.lang]: 'ko' })
  })
})

describe('effectiveLabels', () => {
  it('defers null to the guide style (inline shows labels)', () => {
    expect(effectiveLabels(null, 'inline')).toBe(true)
    expect(effectiveLabels(null, 'tour')).toBe(false)
    expect(effectiveLabels(true, 'tour')).toBe(true)
    expect(effectiveLabels(false, 'inline')).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- prefs`
Expected: FAIL — `Cannot find module './prefs'` 류의 오류

- [ ] **Step 3: 구현**

`frontend/src/lib/prefs.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test -- prefs`
Expected: PASS (위 테스트 전부)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prefs.ts frontend/src/lib/prefs.test.ts
git commit -m "feat(frontend): add pure prefs serialization (lang/theme/guide/toggles)"
```

---

### Task 2: `lib/palette.ts` + `format.ts` 리팩터

**Files:**
- Create: `frontend/src/lib/palette.ts`
- Test: `frontend/src/lib/palette.test.ts`
- Modify: `frontend/src/lib/format.ts:12-42`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/lib/palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makePalette } from './palette'

describe('makePalette', () => {
  it('standard dark palette matches the current app colors', () => {
    const p = makePalette('dark', false)
    expect(p.state).toEqual({ running: '#4caf50', runnable: '#9aa3b2', blocked: '#c25450' })
    expect(p.category).toEqual({ channel: '#5b8def', mutex: '#e0a030', other: '#a78bdb' })
    expect(p.dim).toBe('#2a2e38')
    expect(p.ring).toBe('#ffffff')
    expect(p.accent).toBe('#5b8def')
    expect(p.canvasBg).toBe('#0f1117')
    expect(p.ghost).toBe(0.15)
  })
  it('colorblind palette swaps running/blocked to blue/orange', () => {
    const p = makePalette('dark', true)
    expect(p.state.running).toBe('#0072b2')
    expect(p.state.blocked).toBe('#d55e00')
    expect(p.state.runnable).toBe('#9aa3b2')
  })
  it('light theme swaps dim/ring/background/text', () => {
    const p = makePalette('light', false)
    expect(p.dim).toBe('#d4d8e0')
    expect(p.ring).toBe('#12161f')
    expect(p.canvasBg).toBe('#f5f6f8')
    expect(p.text).toBe('#333a4a')
    expect(p.accent).toBe('#3e6fd9')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- palette`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`frontend/src/lib/palette.ts`:

```ts
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
```

`frontend/src/lib/format.ts`에서 색 정의 블록을 palette 기반 기본값으로 교체 — 아래 코드로 **12-42행을 대체** (`goroutineLabel`/`effectiveEnd`/`taskColor`는 그대로 둠):

```ts
export type IntervalState = 'running' | 'runnable' | 'blocked'

import type { EdgeCategory } from './types'
import { makePalette } from './palette'

// Default palette (dark theme, standard colors). Theme-aware rendering paths
// get a live palette from stores/prefs.ts instead; these exports remain as the
// single fallback so pure layout code and tests need no theme plumbing.
const DEFAULT_PALETTE = makePalette('dark', false)

// stateColor returns a fill for a known state, or a neutral gray for anything
// unexpected (defensive against future trace states).
export function stateColor(state: IntervalState): string {
  return DEFAULT_PALETTE.state[state] ?? '#5b6270'
}

export const DIM_COLOR = DEFAULT_PALETTE.dim // node not alive / inactive edge
export const EDGE_ACTIVE_COLOR = DEFAULT_PALETTE.category.channel // edge firing near the playhead

// Per-category edge/comet colors. These encode the inferred synchronization
// kind, NOT a transferred value (the trace has no channel identity).
export const CATEGORY_COLORS: Record<EdgeCategory, string> = DEFAULT_PALETTE.category

export function categoryColor(category: EdgeCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.channel
}
```

주의: `palette.ts`는 `format.ts`에서 **type-only import**만 하므로 런타임 순환 참조가 없다.

- [ ] **Step 4: 통과 확인 (기존 테스트 회귀 포함)**

Run: `cd frontend && npm test`
Expected: PASS — palette 신규 + format/timelineLayout 등 기존 테스트 전부 (색 값이 동일하므로 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/palette.ts frontend/src/lib/palette.test.ts frontend/src/lib/format.ts
git commit -m "feat(frontend): add theme/colorblind palette; format colors delegate to it"
```

---

### Task 3: `lib/i18n.ts` — en/ko 사전 (순수)

**Files:**
- Create: `frontend/src/lib/i18n.ts`
- Test: `frontend/src/lib/i18n.test.ts`

문구는 목업 `docs/design/UI 사용성 개선 제안/GoViz Onboarding.dc.html`의 `copy` 객체(L312-377)가 원본이다. 아래 구현 코드에 전체를 옮겨 두었지만, 의심스러우면 목업과 대조할 것 (`minimalLine` 키만 의도적으로 제외 — minimal 빈 화면은 스코프 밖).

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/lib/i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { t, withColorWords } from './i18n'

describe('t', () => {
  it('returns the dictionary for each language', () => {
    expect(t('en').speed).toBe('Speed')
    expect(t('ko').speed).toBe('속도')
  })
  it('en and ko dictionaries have identical key sets (recursively)', () => {
    const keysOf = (o: unknown, prefix = ''): string[] =>
      o !== null && typeof o === 'object' && !Array.isArray(o)
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
            typeof v === 'function' ? [prefix + k] : keysOf(v, prefix + k + '.'),
          )
        : [prefix.slice(0, -1)]
    expect(keysOf(t('ko')).sort()).toEqual(keysOf(t('en')).sort())
  })
  it('both languages ship 4 tour steps', () => {
    expect(t('en').tour).toHaveLength(4)
    expect(t('ko').tour).toHaveLength(4)
  })
  it('info interpolates counts and duration', () => {
    expect(t('en').info(8, 10, '100.0')).toBe('8 goroutines · 10 edges · 100.0 ms')
    expect(t('ko').info(8, 10, '100.0')).toBe('고루틴 8 · 엣지 10 · 100.0 ms')
  })
})

describe('withColorWords', () => {
  it('substitutes {run}/{blk} using the standard color words', () => {
    expect(withColorWords('{run} running, {blk} blocked', t('en'), false)).toBe('green running, red blocked')
    expect(withColorWords('{run} 실행, {blk} 차단', t('ko'), false)).toBe('초록 실행, 빨강 차단')
  })
  it('uses colorblind words when cb is on', () => {
    expect(withColorWords('{run}/{blk}', t('en'), true)).toBe('blue/orange')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- i18n`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`frontend/src/lib/i18n.ts`:

```ts
// UI copy for en/ko, ported verbatim from the design mockup
// (docs/design/UI 사용성 개선 제안/GoViz Onboarding.dc.html, `copy` object).
// Pure: components read a derived dict store from stores/prefs.ts.
import type { IntervalState } from './format'
import type { EdgeCategory } from './types'
import type { Lang } from './prefs'

export interface TourStep {
  title: string
  body: string
}

export interface Dict {
  openBtn: string
  openBtn2: string
  speed: string
  sys: string
  helpTip: string
  settingsTip: string
  lang: string
  theme: string
  dark: string
  light: string
  guide: string
  guideTour: string
  guideCall: string
  guideHints: string
  loopL: string
  labelsL: string
  cbL: string
  cwStd: { run: string; blk: string }
  cwCb: { run: string; blk: string }
  info: (goroutines: number, edges: number, ms: string) => string
  emptyTitle: string
  emptyDesc: string
  card1Title: string
  card1Desc: string
  card2Title: string
  card2Desc: string
  sampleBtn: string
  noTracePre: string
  noTracePost: string
  firstTime: string
  bannerDesc: string
  gotIt: string
  chip1T: string
  chip1B: string
  chip2T: string
  chip2B: string
  chip3T: string
  chip3B: string
  chip4T: string
  chip4B: string
  tlStripT: string
  tlStripD: string
  grStripT: string
  grStripD: string
  legStateGroup: string
  legEdgeGroup: string
  states: Record<IntervalState, string>
  notAlive: string
  cats: Record<EdgeCategory, string>
  inferred: string
  legFocusHint: string
  stepLabel: string
  skip: string
  back: string
  next: string
  done: string
  tour: TourStep[]
}

const en: Dict = {
  openBtn: 'Open trace…',
  openBtn2: 'Open trace… (.out)',
  speed: 'Speed',
  sys: 'Show system goroutines',
  helpTip: 'How to read this view',
  settingsTip: 'Settings',
  lang: 'Language',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  guide: 'Guide style',
  guideTour: 'Tour',
  guideCall: 'Callouts',
  guideHints: 'Hints',
  loopL: 'Loop playback',
  labelsL: 'Always show node names',
  cbL: 'Colorblind-friendly colors',
  cwStd: { run: 'green', blk: 'red' },
  cwCb: { run: 'blue', blk: 'orange' },
  info: (g, e, ms) => `${g} goroutines · ${e} edges · ${ms} ms`,
  emptyTitle: "See your Go program's concurrency",
  emptyDesc:
    'goviz replays a standard Go execution trace: every goroutine gets a timeline lane on top, and a live graph below shows who unblocked whom — both driven by one shared playhead.',
  card1Title: '① Timeline',
  card1Desc: 'One lane per goroutine — {run} running, gray runnable, {blk} blocked. Hover a bar to see why it blocked.',
  card2Title: '② Live graph',
  card2Desc: 'Circles are goroutines at the playhead; a line lights up when one unblocks another — blue channel, orange mutex.',
  sampleBtn: '▶  Explore a sample trace',
  noTracePre: 'No trace yet? Create one with',
  noTracePost: 'and open it here.',
  firstTime: 'First time?',
  bannerDesc: 'The numbered notes below explain each area. You can hover anything for details, any time.',
  gotIt: 'Got it — play the trace',
  chip1T: 'Timeline.',
  chip1B: 'One lane per goroutine: {run} running, gray runnable, {blk} blocked. Hover a bar for the block reason.',
  chip2T: 'Playhead.',
  chip2B: 'Press ▶ or Space to replay; drag here to scrub. The blue line drives both views.',
  chip3T: 'Live graph.',
  chip3B: 'Each circle is a goroutine, colored by its state right now. An edge lights up when one goroutine unblocks another (inferred).',
  chip4T: 'Focus.',
  chip4B: 'Click any circle to highlight its causal chain in both views; click again to clear. Colors are explained in the legend below.',
  tlStripT: 'TIMELINE',
  tlStripD: 'one lane per goroutine · hover a bar to see why it blocked · drag to scrub',
  grStripT: 'LIVE GRAPH',
  grStripD: 'circles = goroutines at the playhead · edges light up when one wakes another · click a circle to focus its chain',
  legStateGroup: 'GOROUTINE STATE',
  legEdgeGroup: 'WAKE-UP EDGES',
  states: { running: 'running', runnable: 'runnable', blocked: 'blocked' },
  notAlive: 'not alive',
  cats: { channel: 'channel', mutex: 'mutex', other: 'other' },
  inferred: 'inferred',
  legFocusHint: 'click a goroutine to focus its causal chain',
  stepLabel: 'STEP {n} OF 4',
  skip: 'Skip',
  back: 'Back',
  next: 'Next',
  done: 'Done — play',
  tour: [
    {
      title: 'Timeline — one lane per goroutine',
      body: 'Each row is one goroutine over time: {run} means running, gray runnable (waiting for a CPU), {blk} blocked. Hover any bar to see why it blocked — e.g. “chan receive”.',
    },
    {
      title: 'Playback',
      body: 'Press ▶ (or Space) to replay the trace, and pick a speed. You can also drag anywhere on the timeline to scrub the blue playhead.',
    },
    {
      title: 'Live graph',
      body: 'Every circle is a goroutine, colored by its state at the playhead. A line lights up when one goroutine unblocks another — blue for channels, orange for mutexes. Edges are inferred from the trace.',
    },
    {
      title: 'Legend & focus',
      body: 'Colors are always explained down here. Click any circle in the graph to focus its causal chain across both views; click it again to clear.',
    },
  ],
}

const ko: Dict = {
  openBtn: '트레이스 열기…',
  openBtn2: '트레이스 열기… (.out)',
  speed: '속도',
  sys: '시스템 고루틴 표시',
  helpTip: '이 화면 읽는 법',
  settingsTip: '설정',
  lang: '언어',
  theme: '테마',
  dark: '다크',
  light: '라이트',
  guide: '안내 방식',
  guideTour: '투어',
  guideCall: '콜아웃',
  guideHints: '힌트',
  loopL: '반복 재생',
  labelsL: '노드 이름 항상 표시',
  cbL: '색약 친화 색상',
  cwStd: { run: '초록', blk: '빨강' },
  cwCb: { run: '파랑', blk: '주황' },
  info: (g, e, ms) => `고루틴 ${g} · 엣지 ${e} · ${ms} ms`,
  emptyTitle: 'Go 프로그램의 동시성을 눈으로 확인하세요',
  emptyDesc:
    'goviz는 표준 Go 실행 트레이스를 재생합니다. 위쪽 타임라인에는 고루틴별 레인이, 아래쪽 라이브 그래프에는 누가 누구를 깨웠는지가 표시되며, 두 뷰는 하나의 플레이헤드로 함께 움직입니다.',
  card1Title: '① 타임라인',
  card1Desc: '고루틴마다 한 줄 — {run}은 실행 중, 회색은 실행 대기, {blk}은 차단됨. 막대에 마우스를 올리면 차단 이유가 보입니다.',
  card2Title: '② 라이브 그래프',
  card2Desc: '원은 플레이헤드 시점의 고루틴이며, 한 고루틴이 다른 고루틴을 깨우면 선이 켜집니다 — 파랑은 채널, 주황은 뮤텍스.',
  sampleBtn: '▶  샘플 트레이스 살펴보기',
  noTracePre: '아직 트레이스가 없나요?',
  noTracePost: '명령으로 만든 뒤 여기서 열어보세요.',
  firstTime: '처음이신가요?',
  bannerDesc: '번호가 붙은 메모가 각 영역을 설명합니다. 언제든 요소에 마우스를 올려 자세히 볼 수 있어요.',
  gotIt: '확인했어요 — 재생 시작',
  chip1T: '타임라인.',
  chip1B: '고루틴마다 한 줄: {run} 실행 중, 회색 실행 대기, {blk} 차단됨. 막대에 호버하면 차단 이유가 보입니다.',
  chip2T: '플레이헤드.',
  chip2B: '▶ 또는 Space로 재생하고, 여기를 드래그해 탐색하세요. 파란 선이 두 뷰를 함께 움직입니다.',
  chip3T: '라이브 그래프.',
  chip3B: '각 원은 고루틴이며 현재 상태 색으로 칠해집니다. 한 고루틴이 다른 고루틴을 깨우면 엣지가 켜집니다(추정).',
  chip4T: '포커스.',
  chip4B: '원을 클릭하면 인과 체인이 두 뷰에서 강조되고, 다시 클릭하면 해제됩니다. 색 의미는 아래 범례에 있어요.',
  tlStripT: '타임라인',
  tlStripD: '고루틴마다 한 줄 · 막대에 호버하면 차단 이유 · 드래그로 탐색',
  grStripT: '라이브 그래프',
  grStripD: '원 = 플레이헤드 시점의 고루틴 · 하나가 다른 하나를 깨우면 선이 켜짐 · 원을 클릭하면 체인 포커스',
  legStateGroup: '고루틴 상태',
  legEdgeGroup: '웨이크업 엣지',
  states: { running: '실행 중', runnable: '실행 대기', blocked: '차단됨' },
  notAlive: '종료·미생성',
  cats: { channel: '채널', mutex: '뮤텍스', other: '기타' },
  inferred: '추정',
  legFocusHint: '고루틴을 클릭하면 인과 체인이 강조됩니다',
  stepLabel: '단계 {n} / 4',
  skip: '건너뛰기',
  back: '이전',
  next: '다음',
  done: '완료 — 재생',
  tour: [
    {
      title: '타임라인 — 고루틴마다 한 줄',
      body: '각 줄은 시간에 따른 고루틴 하나입니다. {run}은 실행 중, 회색은 실행 대기(CPU 기다림), {blk}은 차단됨. 막대에 마우스를 올리면 차단 이유(예: “chan receive”)가 보입니다.',
    },
    {
      title: '재생',
      body: '▶(또는 Space)를 눌러 트레이스를 재생하고 속도를 고를 수 있어요. 타임라인 아무 곳이나 드래그하면 파란 플레이헤드를 옮길 수 있습니다.',
    },
    {
      title: '라이브 그래프',
      body: '모든 원은 고루틴이며 플레이헤드 시점의 상태 색으로 칠해집니다. 한 고루틴이 다른 고루틴을 깨우면 선이 켜집니다 — 파랑은 채널, 주황은 뮤텍스. 엣지는 트레이스에서 추정된 것입니다.',
    },
    {
      title: '범례와 포커스',
      body: '색의 의미는 항상 아래 범례에 있습니다. 그래프의 원을 클릭하면 두 뷰 모두에서 인과 체인이 강조되고, 다시 클릭하면 해제됩니다.',
    },
  ],
}

const DICTS: Record<Lang, Dict> = { en, ko }

export function t(lang: Lang): Dict {
  return DICTS[lang] ?? en
}

// Replaces the {run}/{blk} placeholders with human color words that match the
// active palette (standard vs colorblind).
export function withColorWords(s: string, dict: Dict, colorblind: boolean): string {
  const cw = colorblind ? dict.cwCb : dict.cwStd
  return s.split('{run}').join(cw.run).split('{blk}').join(cw.blk)
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test -- i18n`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n.ts frontend/src/lib/i18n.test.ts
git commit -m "feat(frontend): add en/ko dictionary ported from the design mockup"
```

---

### Task 4: `stores/prefs.ts` — 지속 스토어 + 파생 dict/palette

**Files:**
- Create: `frontend/src/stores/prefs.ts`
- Test: `frontend/src/stores/prefs.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/stores/prefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { createPrefsStore } from './prefs'
import { KEYS } from '../lib/prefs'

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => Object.fromEntries(m),
  }
}

describe('createPrefsStore', () => {
  it('initializes from storage and persists on set', () => {
    const s = fakeStorage({ [KEYS.theme]: 'light' })
    const p = createPrefsStore(s, 'ko-KR')
    expect(get(p.theme)).toBe('light')
    expect(get(p.lang)).toBe('ko')
    p.loop.set(true)
    p.lang.set('en')
    expect(s.dump()[KEYS.loop]).toBe('true')
    expect(s.dump()[KEYS.lang]).toBe('en')
  })
  it('derives dict and palette from lang/theme/cb', () => {
    const p = createPrefsStore(fakeStorage(), 'en-US')
    expect(get(p.dict).speed).toBe('Speed')
    expect(get(p.palette).state.running).toBe('#4caf50')
    p.lang.set('ko')
    p.cb.set(true)
    expect(get(p.dict).speed).toBe('속도')
    expect(get(p.palette).state.running).toBe('#0072b2')
    p.theme.set('light')
    expect(get(p.palette).canvasBg).toBe('#f5f6f8')
  })
  it('works with null storage (no persistence, defaults only)', () => {
    const p = createPrefsStore(null, undefined)
    expect(get(p.lang)).toBe('en')
    p.onboarded.set(true) // must not throw
    expect(get(p.onboarded)).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- stores/prefs`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`frontend/src/stores/prefs.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test -- stores/prefs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/prefs.ts frontend/src/stores/prefs.test.ts
git commit -m "feat(frontend): add persisted prefs store with derived dict/palette"
```

---

### Task 5: CSS 변수 2세트 + 테마 적용 골격

**Files:**
- Modify: `frontend/src/style.css` (전체 교체)
- Modify: `frontend/src/App.svelte` (테마 반영 + 하드코딩 색 → 변수)

- [ ] **Step 1: `style.css` 전체 교체**

```css
/* Theme variables — dark is the default, light overrides via data-theme on <html>.
   Values come from the design mockup (docs/design/UI 사용성 개선 제안). */
:root {
  --bg: #0f1117;
  --panel: #161922;
  --panel2: #12151d;
  --border: #2a2e38;
  --text: #cdd3df;
  --strong: #e6ebf2;
  --muted: #8a93a3;
  --faint: #5b6270;
  --accent: #5b8def;
  --dim: #2a2e38;
  --chipbg: #101a2e;
  --chipbd: rgba(91, 141, 239, 0.45);
  --bannerbg: #14203a;
  --bannerbd: #2b4270;
  --btn2: #2a2e38;
  --shade: rgba(5, 7, 12, 0.58);
}
[data-theme='light'] {
  --bg: #f5f6f8;
  --panel: #ffffff;
  --panel2: #eceef2;
  --border: #d7dae1;
  --text: #333a4a;
  --strong: #12161f;
  --muted: #5f6675;
  --faint: #9aa1ad;
  --accent: #3e6fd9;
  --dim: #d4d8e0;
  --chipbg: #eaf0fc;
  --chipbd: rgba(62, 111, 217, 0.5);
  --bannerbg: #e3ecfc;
  --bannerbd: #b9cdf2;
  --btn2: #dde1e8;
  --shade: rgba(30, 38, 56, 0.4);
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
}

#app {
  height: 100vh;
}
```

(기존 Nunito @font-face·중앙정렬 보일러플레이트는 삭제 — 앱은 `system-ui`를 쓰고 있고 폰트는 어디서도 참조되지 않는지 `grep -rn "Nunito" frontend/src frontend/index.html`로 확인 후 제거. 참조가 있으면 @font-face 블록만 유지.)

- [ ] **Step 2: `App.svelte`에 테마 반영 추가**

`<script>` 상단에 prefs import와 테마 반영을 추가:

```ts
import { prefs } from './stores/prefs'

const { theme, sys } = prefs

// Reflect theme on <html> so the CSS variable sets switch app-wide.
$: if (typeof document !== 'undefined') document.documentElement.dataset.theme = $theme
// prefs.sys is the persisted source of truth; traceStore mirrors it for the
// existing filter plumbing (both canvases read traceStore.showSystem).
$: traceStore.setShowSystem($sys)
```

`<style>`의 하드코딩 색을 변수로 치환 (기존 값 → 변수):

```css
main { font-family: system-ui, sans-serif; color: var(--text); background: var(--bg); height: 100vh; display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.open-btn { background: var(--accent); color: white; border: 0; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
.open-btn:disabled { opacity: 0.6; cursor: default; }
.info { font-size: 13px; color: var(--muted); }
.timeline { flex: 0 0 42%; overflow: auto; border-bottom: 1px solid var(--border); position: relative; }
.graph { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--faint); }
```

(`.timeline`/`.graph`에 `position: relative`를 지금 추가해 둔다 — Task 12의 콜아웃 칩 absolute 배치가 여기 의존. `.graph`의 flex-column은 Task 12의 힌트 스트립 + 캔버스 세로 배치용. error-banner 스타일은 그대로 둔다.)

- [ ] **Step 3: 검증**

Run: `cd frontend && npm run check && npm test`
Expected: 둘 다 PASS (svelte-check 에러 0)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/style.css frontend/src/App.svelte
git commit -m "feat(frontend): introduce dark/light CSS variable sets and theme reflection"
```

---

### Task 6: 반복 재생 — `playback.ts` loop 옵션

**Files:**
- Modify: `frontend/src/lib/playback.ts`
- Modify: `frontend/src/stores/trace.ts:33,121-126,132`
- Test: `frontend/src/lib/playback.test.ts` (추가), `frontend/src/stores/trace.test.ts` (기존 회귀 확인)

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/src/lib/playback.test.ts`에 append:

```ts
describe('nextPlayhead loop', () => {
  it('wraps past the end instead of clamping when loop is on', () => {
    // span 100, at 1x over base 1000ms: 150ms from t=95 lands 10 units past end.
    const r = nextPlayhead(95, 150, 1, 0, 100, 1000, true)
    expect(r.atEnd).toBe(false)
    expect(r.time).toBeCloseTo(10)
  })
  it('still clamps at the end when loop is off', () => {
    const r = nextPlayhead(95, 150, 1, 0, 100, 1000, false)
    expect(r).toEqual({ time: 100, atEnd: true })
  })
})
```

(파일 상단 import에 `nextPlayhead`가 이미 있는지 확인; describe/it/expect는 기존 파일 스타일을 따른다.)

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- playback`
Expected: FAIL — loop 인자 없음/wrap 미구현

- [ ] **Step 3: 구현**

`frontend/src/lib/playback.ts`의 `nextPlayhead`를 다음으로 교체:

```ts
// nextPlayhead advances `current` by `dtMs` of real time at `speed`, mapping the
// whole [startTime, endTime] span onto baseMs of real time. Without loop the
// result clamps to endTime (atEnd=true once reached); with loop it wraps the
// overshoot back past startTime and never reports atEnd.
export function nextPlayhead(
  current: number,
  dtMs: number,
  speed: number,
  startTime: number,
  endTime: number,
  baseMs: number = BASE_PLAY_MS,
  loop: boolean = false,
): Advance {
  const span = endTime - startTime
  if (span <= 0) return { time: endTime, atEnd: true }
  const delta = (dtMs / baseMs) * span * speed
  const next = current + delta
  if (next >= endTime) {
    if (loop) return { time: startTime + ((next - startTime) % span), atEnd: false }
    return { time: endTime, atEnd: true }
  }
  return { time: next, atEnd: false }
}
```

`frontend/src/stores/trace.ts` — 팩토리가 loop 게터를 받도록:

```ts
// 시그니처 변경 (33행):
export function createTraceStore(getLoop: () => boolean = () => false): TraceStore {
```

```ts
// advance (121-126행) 교체:
    advance(dtMs) {
      if (!current) return
      const r = nextPlayhead(get(playhead), dtMs, get(speed), current.startTime, current.endTime, undefined, getLoop())
      playhead.set(r.time)
      if (r.atEnd) api.pause()
    },
```

```ts
// 싱글턴 (132행) 교체 — prefs의 loop 설정을 읽는다:
import { prefs } from './prefs'
// ...
export const traceStore = createTraceStore(() => get(prefs.loop))
```

(import 문은 파일 상단에 배치. `prefs`는 trace를 import하지 않으므로 순환 없음.)

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test`
Expected: PASS — playback 신규 2건 + trace.test.ts 기존 전부 (기본값 loop=false라 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/playback.ts frontend/src/lib/playback.test.ts frontend/src/stores/trace.ts
git commit -m "feat(frontend): loop playback option wired to prefs"
```

---

### Task 7: 툴팁 i18n — dict 파라미터

**Files:**
- Modify: `frontend/src/lib/tooltip.ts:6-26`
- Modify: `frontend/src/lib/tooltip.test.ts`

- [ ] **Step 1: 테스트 수정 (실패 유도)**

`tooltip.test.ts`에서 `intervalTooltip`/`nodeTooltip`/`edgeTooltip` 호출부에 en dict를 넘기고 기대값을 새 포맷으로 바꾼다. 파일 상단에 추가:

```ts
import { t } from './i18n'
const EN = t('en')
const KO = t('ko')
```

기존 세 함수의 테스트를 다음 스타일로 교체하고 ko 케이스를 하나씩 추가:

```ts
describe('intervalTooltip', () => {
  it('shows label + localized state, appending the block reason when present', () => {
    expect(intervalTooltip('worker', 'blocked', 'chan receive', EN)).toBe('worker\nblocked · chan receive')
    expect(intervalTooltip('worker', 'running', '', EN)).toBe('worker\nrunning')
    expect(intervalTooltip('worker', 'blocked', 'chan receive', KO)).toBe('worker\n차단됨 · chan receive')
  })
})

describe('nodeTooltip', () => {
  it('falls back to the localized not-alive text', () => {
    expect(nodeTooltip('g7', null, EN)).toBe('g7\nnot alive')
    expect(nodeTooltip('g7', 'running', KO)).toBe('g7\n실행 중')
  })
})

describe('edgeTooltip', () => {
  it('labels the category and marks it inferred, localized', () => {
    expect(edgeTooltip('channel', 'producer', 'consumer', EN)).toBe('producer → consumer\nchannel (inferred)')
    expect(edgeTooltip('mutex', 'a', 'b', KO)).toBe('a → b\n뮤텍스 (추정)')
  })
})
```

(regionTooltip/logTooltip/taskTooltip 테스트는 그대로 — 사용자 데이터라 번역 대상 아님.)

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- tooltip`
Expected: FAIL — 인자 개수/기대값 불일치

- [ ] **Step 3: 구현**

`tooltip.ts`의 세 함수를 교체 (region/log/task는 유지):

```ts
import type { IntervalState } from './format'
import type { EdgeCategory } from './types'

// The slice of the i18n Dict that tooltips need (structural — pass the whole Dict).
export interface TooltipCopy {
  states: Record<IntervalState, string>
  notAlive: string
  cats: Record<EdgeCategory, string>
  inferred: string
}

// intervalTooltip describes a hovered timeline interval. The block reason is
// only meaningful (and shown) for blocked intervals that carry one; reasons are
// raw runtime strings ("chan receive") and are intentionally not translated.
export function intervalTooltip(label: string, state: IntervalState, blockReason: string, L: TooltipCopy): string {
  const detail = state === 'blocked' && blockReason ? `${L.states[state]} · ${blockReason}` : L.states[state]
  return `${label}\n${detail}`
}

// nodeTooltip describes a hovered graph node at the current playhead time.
export function nodeTooltip(label: string, state: IntervalState | null, L: TooltipCopy): string {
  return `${label}\n${state ? L.states[state] : L.notAlive}`
}

// edgeTooltip describes a hovered causal edge. The trace exposes no channel
// identity or transferred value, so every relation is labelled inferred.
export function edgeTooltip(category: EdgeCategory, fromLabel: string, toLabel: string, L: TooltipCopy): string {
  return `${fromLabel} → ${toLabel}\n${L.cats[category]} (${L.inferred})`
}
```

호출부 컴파일 에러가 나는 곳(Timeline/GraphCanvas)은 이 태스크에서 함께 고친다:
- `TimelineCanvas.svelte`: `import { prefs } from '../stores/prefs'` + `const { dict } = prefs` 추가, `intervalTooltip(h.lane.label, h.rect.state, h.rect.blockReason, $dict)`로 변경.
- `GraphCanvas.svelte`: 동일하게 `nodeTooltip(n.label, g ? stateAt(g, $playhead) : null, $dict)`, `edgeTooltip(best.l.category, labelOf(s.id), labelOf(t.id), $dict)`.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test && npm run check`
Expected: 둘 다 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/tooltip.ts frontend/src/lib/tooltip.test.ts frontend/src/components/TimelineCanvas.svelte frontend/src/components/GraphCanvas.svelte
git commit -m "feat(frontend): localize tooltip state/category copy via dict parameter"
```

---

### Task 8: 타임라인 캔버스 팔레트 적용

**Files:**
- Modify: `frontend/src/lib/timelineLayout.ts:40-47,66-75`
- Modify: `frontend/src/components/TimelineCanvas.svelte`
- Test: `frontend/src/lib/timelineLayout.test.ts` (추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`timelineLayout.test.ts`에 append (기존 테스트가 쓰는 summary/opts 헬퍼 스타일 재사용 — 파일 내 기존 fixture를 그대로 이용해 최소 lane 1개가 나오는 입력으로):

```ts
it('uses opts.stateColor when provided', () => {
  // 기존 테스트 파일의 최소 summary fixture를 재사용해 lane 1개를 만든다.
  const rows = layoutTimelineRows(summary, groups, new Set(), { ...baseOpts, stateColor: () => '#123456' })
  const lane = rows.find((r) => r.kind === 'lane') as Extract<TimelineRow, { kind: 'lane' }>
  expect(lane.rects[0].color).toBe('#123456')
})
```

(`summary`/`groups`/`baseOpts`는 기존 테스트 파일의 지역 fixture 이름에 맞춰 조정한다 — 이 파일에는 이미 layoutTimelineRows 테스트가 있으므로 그 setup을 따른다.)

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- timelineLayout`
Expected: FAIL — `stateColor` 옵션 무시됨 (TS 에러 또는 색 불일치)

- [ ] **Step 3: 구현**

`timelineLayout.ts`:

`LayoutOptions`에 필드 추가:

```ts
export interface LayoutOptions {
  width: number // pixel width of the time axis
  laneHeight: number
  laneGap: number
  gutter?: number // left offset reserved for lane labels
  regionRowH?: number // height of one region sub-row (0/undefined => no region rows)
  topOffset?: number // reserved space above the first lane (e.g. a task track)
  stateColor?: (s: IntervalState) => string // theme-aware override (default: dark palette)
}
```

`buildLane`이 색 함수를 받도록 — 시그니처에 `colorOf: (s: IntervalState) => string` 파라미터를 추가하고 66-75행의 rect 생성에서 `color: colorOf(iv.state)`로 변경. `layoutTimelineRows`에서 `const colorOf = opts.stateColor ?? stateColor`를 만들어 `buildLane(g, scale, regionRowH, opts.laneHeight, logsByGo, y, colorOf)`로 호출한다. (다른 호출자는 없음 — buildLane은 파일 내부 함수.)

`TimelineCanvas.svelte`:

```ts
// script에 추가 (Task 7에서 prefs import 완료):
const { dict, palette } = prefs
```

- rows 반응 블록의 opts에 `stateColor: (s) => $palette.state[s]` 추가 (팔레트가 바뀌면 rows가 재계산되고 draw가 따라온다).
- `draw()` 안의 하드코딩 색 치환:
  - 배경 `'#0f1117'` → `$palette.canvasBg` (2곳: fillRect 배경, task bar 위 텍스트색)
  - `GROUP_HEADER_BG` 상수 삭제 → `$palette.headerBand`
  - 헤더/레인 라벨 `'#cdd3df'` → `$palette.text`
  - 선택 아웃라인 `'#ffffff'` → `$palette.ring`
  - 플레이헤드 `'#5b8def'` → `$palette.accent`
  - `GHOST_ALPHA` 상수 삭제 → `$palette.ghost`
- redraw 트리거에 팔레트 포함: `$: void [$playhead, lanes, headers, cssWidth, cssHeight, $selectedId, taskTrack, $palette], draw()`
- 툴팁 박스 스타일(.tip)을 변수로: `background: var(--panel); color: var(--text); border: 1px solid var(--border);`

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/timelineLayout.ts frontend/src/lib/timelineLayout.test.ts frontend/src/components/TimelineCanvas.svelte
git commit -m "feat(frontend): theme-aware timeline rendering via injected palette"
```

---

### Task 9: 그래프 캔버스 팔레트 + 노드 라벨 상시 표시

**Files:**
- Modify: `frontend/src/components/GraphCanvas.svelte`

- [ ] **Step 1: 구현** (순수 로직 없음 — 얇은 렌더러 수정, 육안 검증 대상)

script 수정:

```ts
import { effectiveLabels } from '../lib/prefs'
// Task 7에서 prefs import 완료. 구독 추가:
const { dict, palette, labels, guide } = prefs

$: showLabels = effectiveLabels($labels, $guide)
```

- import에서 `stateColor, DIM_COLOR, categoryColor` 제거하고 (`goroutineLabel, taskColor`는 유지) draw 내 색 참조를 팔레트로 치환:
  - 배경 `'#0f1117'` → `$palette.canvasBg`
  - `GHOST_ALPHA` 상수 삭제 → `$palette.ghost`
  - 엣지: `categoryColor(l.category)` → `$palette.category[l.category]`, `DIM_COLOR` → `$palette.dim`
  - 노드: `stateColor(st)` → `$palette.state[st]`, `DIM_COLOR` → `$palette.dim`, 선택/슈퍼노드 링 `'#ffffff'` → `$palette.ring`, 슈퍼노드 라벨 `'#cdd3df'` → `$palette.text`
  - 코멧 생성부(103행): `categoryColor(e.category)` → `$palette.category[e.category]`
- **개별 노드 라벨** — 노드 그리기 else 분기(개별 노드) 끝, 선택 링 다음에 추가:

```ts
        if (showLabels) {
          ctx.fillStyle = $palette.text
          ctx.font = '10px system-ui, sans-serif'
          ctx.textBaseline = 'middle'
          ctx.fillText(n.label, n.x + 12, n.y!)
        }
```

- redraw 트리거 확장 (127행): `$: void [$playhead, $selectedId, $palette, showLabels], draw()`
- **불변식 준수 확인**: `rebuild(...)` 반응 블록(53행)은 그대로 — `$palette`/`showLabels`는 rebuild에 절대 넣지 않는다 (시뮬레이션은 노드 집합 변경 시에만 재구축).
- 툴팁 .tip 스타일을 Task 8과 동일하게 변수로.

- [ ] **Step 2: 검증**

Run: `cd frontend && npm test && npm run check`
Expected: PASS (svelte-check에서 미사용 import 경고가 남지 않게 정리)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/GraphCanvas.svelte
git commit -m "feat(frontend): theme-aware graph rendering and optional always-on node labels"
```

---

### Task 10: 범례 재작성

**Files:**
- Modify: `frontend/src/components/Legend.svelte` (전체 교체)

- [ ] **Step 1: 전체 교체**

```svelte
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
```

(변경점: i18n·팔레트 구독, 목업의 그룹 라벨/포커스 힌트(inline 한정), 중복 "inferred link" 항목 제거, 투어 대상 `data-tour="legend"` 부여 — 투어는 이 요소를 하이라이트한다.)

- [ ] **Step 2: 검증**

Run: `cd frontend && npm run check && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Legend.svelte
git commit -m "feat(frontend): localized, palette-aware legend with inline-hint groups"
```

---

### Task 11: Go — `LoadSampleTrace()` 바인딩

**Files:**
- Modify: `app.go`
- Test: `app_test.go` (추가)
- Modify: `frontend/wailsjs/go/main/App.js`, `frontend/wailsjs/go/main/App.d.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`app_test.go`에 append:

```go
func TestLoadSampleTraceInvariants(t *testing.T) {
	app := NewApp()
	sum, err := app.LoadSampleTrace()
	if err != nil {
		t.Fatalf("LoadSampleTrace: %v", err)
	}
	if len(sum.Goroutines) < 5 {
		t.Fatalf("sample too small: %d goroutines", len(sum.Goroutines))
	}
	if sum.EndTime <= sum.StartTime {
		t.Fatalf("bad time range: %d..%d", sum.StartTime, sum.EndTime)
	}
	hasChannelEdge := false
	for _, e := range sum.Edges {
		if e.Category == model.CategoryChannel {
			hasChannelEdge = true
			break
		}
	}
	if !hasChannelEdge {
		t.Fatal("expected at least one channel causal edge in the sample")
	}
	hasMutexBlock := false
	for _, g := range sum.Goroutines {
		for _, iv := range g.Intervals {
			if iv.State == model.StateBlocked && strings.Contains(iv.BlockReason, "sync") {
				hasMutexBlock = true
			}
		}
	}
	if !hasMutexBlock {
		t.Fatal("expected at least one sync-blocked interval in the sample")
	}
}
```

(파일 상단 import에 `"strings"`와 `"github.com/kenshin579/goviz/internal/model"`이 이미 있는지 확인, 없으면 추가.)

- [ ] **Step 2: 실패 확인**

Run: `go test ./... -run TestLoadSampleTrace`
Expected: FAIL — `app.LoadSampleTrace undefined`

- [ ] **Step 3: 구현**

`app.go`에 append (import에 `"bytes"`, `"runtime/trace"`, `"sync"`, `"time"` 추가):

```go
// LoadSampleTrace records a small built-in concurrent workload under the tracer
// and parses it in-process, so first-time users can explore the UI without
// bringing their own trace. The workload mixes an unbuffered producer/consumer
// channel (guaranteed rendezvous blocking → channel causal edges) with three
// workers contending on one mutex (→ mutex edges).
func (a *App) LoadSampleTrace() (*model.TraceSummary, error) {
	var buf bytes.Buffer
	if err := trace.Start(&buf); err != nil {
		return nil, errors.New("Couldn't record the sample trace — please try again.")
	}
	runSampleWorkload()
	trace.Stop()
	sum, err := parse.Parse(&buf)
	if err != nil {
		return nil, errors.New(classifyOpenError(err))
	}
	return sum, nil
}

// runSampleWorkload is deliberately slow (a few ms of sleeps) so the sample
// trace has visible running/blocked spans at playback speed.
func runSampleWorkload() {
	ch := make(chan int) // unbuffered: every send/recv is a rendezvous
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(2)
	go func() { // producer
		defer wg.Done()
		for i := 0; i < 20; i++ {
			ch <- i
			time.Sleep(200 * time.Microsecond)
		}
		close(ch)
	}()
	go func() { // consumer
		defer wg.Done()
		for range ch {
			time.Sleep(300 * time.Microsecond)
		}
	}()

	wg.Add(3)
	for w := 0; w < 3; w++ {
		go func() { // worker: contend on the mutex while holding it briefly
			defer wg.Done()
			for i := 0; i < 10; i++ {
				mu.Lock()
				time.Sleep(300 * time.Microsecond)
				mu.Unlock()
				time.Sleep(100 * time.Microsecond)
			}
		}()
	}
	wg.Wait()
}
```

- [ ] **Step 4: 통과 확인**

Run: `go test ./... && go build ./...`
Expected: PASS

- [ ] **Step 5: 바인딩 수동 추가** (`wails build` 시 동일 내용으로 재생성됨 — 커밋 전 `git checkout -- frontend/dist/gitkeep frontend/wailsjs/runtime` 규칙 준수)

`frontend/wailsjs/go/main/App.d.ts`에 append:

```ts
export function LoadSampleTrace():Promise<model.TraceSummary>;
```

`frontend/wailsjs/go/main/App.js`에 append:

```js
export function LoadSampleTrace() {
  return window['go']['main']['App']['LoadSampleTrace']();
}
```

- [ ] **Step 6: Commit**

```bash
git add app.go app_test.go frontend/wailsjs/go/main/App.js frontend/wailsjs/go/main/App.d.ts
git commit -m "feat: add LoadSampleTrace binding recording a built-in sample workload"
```

---

### Task 12: 리치 빈 화면 + 샘플 로드 플로우

**Files:**
- Create: `frontend/src/components/EmptyState.svelte`
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: `EmptyState.svelte` 생성**

```svelte
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
```

- [ ] **Step 2: `App.svelte`에 샘플 로드 연결**

script 수정:

```ts
import { OpenTraceDialog, LoadSampleTrace } from '../wailsjs/go/main/App'
import EmptyState from './components/EmptyState.svelte'
```

`open()` 아래에 추가 (`onLoaded`는 Task 14에서 온보딩 트리거로 확장되며, 이 태스크에서는 빈 껍데기로 둔다):

```ts
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
```

기존 `open()`의 성공 분기도 `if (s) { traceStore.loadSummary(s); onLoaded() }`로 변경.

마크업의 빈 화면 분기를 교체:

```svelte
  {:else}
    <EmptyState on:sample={openSample} on:open={open} />
  {/if}
```

(기존 `.empty` 한 줄 섹션과 그 스타일은 삭제.)

- [ ] **Step 3: 검증**

Run: `cd frontend && npm run check && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EmptyState.svelte frontend/src/App.svelte
git commit -m "feat(frontend): rich empty state with sample-trace entry point"
```

---

### Task 13: 설정 팝업 + 헤더 버튼 + Controls i18n

**Files:**
- Create: `frontend/src/components/SettingsPopup.svelte`
- Modify: `frontend/src/components/Controls.svelte` (전체 교체)
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: `SettingsPopup.svelte` 생성**

```svelte
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
```

- [ ] **Step 2: `Controls.svelte` 전체 교체** (i18n + sys→prefs)

```svelte
<script lang="ts">
  import { traceStore } from '../stores/trace'
  import { prefs } from '../stores/prefs'

  const { playing, speed } = traceStore
  const { dict, sys } = prefs
  const SPEEDS = [0.25, 0.5, 1, 2, 4]

  function onSpeed(e: Event) {
    traceStore.setSpeed(Number((e.target as HTMLSelectElement).value))
  }
</script>

<div class="controls">
  <button class="play" on:click={() => traceStore.toggle()} title="Play/Pause (Space)">
    {$playing ? '⏸' : '▶'}
  </button>

  <label class="speed">
    {$dict.speed}
    <select on:change={onSpeed} value={$speed}>
      {#each SPEEDS as s}
        <option value={s}>{s}×</option>
      {/each}
    </select>
  </label>

  <label class="sys">
    <input type="checkbox" checked={$sys} on:change={(e) => sys.set(e.currentTarget.checked)} />
    {$dict.sys}
  </label>
</div>

<style>
  .controls { display: flex; align-items: center; gap: 14px; }
  .play { background: var(--btn2); color: var(--text); border: 0; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .speed, .sys { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .sys { cursor: pointer; }
  select { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px; }
</style>
```

(App.svelte의 `$: traceStore.setShowSystem($sys)`(Task 5)가 prefs→traceStore 방향의 유일한 동기화 지점이다.)

- [ ] **Step 3: `App.svelte` 헤더에 ⚙/? 버튼 + 팝업 마운트 + info i18n**

script에 추가:

```ts
import SettingsPopup from './components/SettingsPopup.svelte'
const { dict, guide, onboarded } = prefs // theme, sys는 Task 5에서 구독 중

let settingsOpen = false
let tourOpen = false // Task 14에서 GuideTour와 연결; 이 태스크에서는 ? 버튼이 설정만 한다
```

header 마크업을 다음으로 교체:

```svelte
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
```

`{#if error}` 위쪽(main 안 아무 곳)에 팝업 마운트:

```svelte
  {#if settingsOpen}
    <SettingsPopup on:close={() => (settingsOpen = false)} />
  {/if}
```

style에 추가:

```css
  .header-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .round { background: transparent; color: var(--muted); border: 1px solid var(--border); width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 13px; line-height: 1; }
```

- [ ] **Step 4: 검증**

Run: `cd frontend && npm run check && npm test`
Expected: PASS (`tourOpen`은 아직 미사용 — svelte-check 경고가 나면 `void tourOpen` 대신 Task 14를 바로 잇는다고 주석 처리하지 말고 이 태스크와 14를 연속 실행)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsPopup.svelte frontend/src/components/Controls.svelte frontend/src/App.svelte
git commit -m "feat(frontend): settings popup, header settings/help buttons, localized controls"
```

---

### Task 14: 온보딩 가이드 3방식 + 최초 1회 자동 표시

**Files:**
- Create: `frontend/src/lib/guide.ts`
- Test: `frontend/src/lib/guide.test.ts`
- Create: `frontend/src/components/GuideTour.svelte`
- Create: `frontend/src/components/CalloutChip.svelte`
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/lib/guide.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { placeTour, TOUR_TARGETS, POP_W, POP_H } from './guide'

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, bottom: top + height,
})

describe('TOUR_TARGETS', () => {
  it('walks timeline → header → graph → legend (mockup order)', () => {
    expect([...TOUR_TARGETS]).toEqual(['timeline', 'header', 'graph', 'legend'])
  })
})

describe('placeTour', () => {
  it('pads the spotlight 4px around the target', () => {
    const { spot } = placeTour(rect(100, 50, 300, 120), 1200, 800)
    expect(spot).toEqual({ x: 96, y: 46, w: 308, h: 128 })
  })
  it('prefers placing the popover below the target', () => {
    const { pop } = placeTour(rect(100, 50, 300, 120), 1200, 800)
    expect(pop.y).toBe(50 + 120 + 14)
    expect(pop.x).toBe(124) // left + 24
  })
  it('flips above when below would overflow the viewport', () => {
    const { pop } = placeTour(rect(100, 500, 300, 200), 1200, 800)
    expect(pop.y).toBe(500 - POP_H - 14)
  })
  it('clamps x into the viewport', () => {
    const { pop } = placeTour(rect(1150, 50, 40, 40), 1200, 800)
    expect(pop.x).toBe(1200 - POP_W - 24)
  })
  it('falls back inside the target when neither side fits', () => {
    const { pop } = placeTour(rect(0, 10, 300, 780), 1200, 800)
    expect(pop.y).toBeGreaterThanOrEqual(12)
    expect(pop.y + POP_H).toBeLessThanOrEqual(800)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npm test -- guide`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `lib/guide.ts` 구현**

```ts
// Coachmark-tour geometry, ported from the design mockup's measure() logic.
// Pure: GuideTour.svelte feeds it getBoundingClientRect + viewport numbers.

export const TOUR_TARGETS = ['timeline', 'header', 'graph', 'legend'] as const
export const POP_W = 330
export const POP_H = 210
const SPOT_PAD = 4
const GAP = 14
const MARGIN = 12

export interface TargetRect {
  left: number
  top: number
  width: number
  height: number
  bottom: number
}

export interface TourPlacement {
  spot: { x: number; y: number; w: number; h: number }
  pop: { x: number; y: number }
}

// placeTour puts the spotlight around the target and the popover below it,
// flipping above when there is no room, finally clamping into the viewport.
export function placeTour(r: TargetRect, vw: number, vh: number): TourPlacement {
  const spot = { x: r.left - SPOT_PAD, y: r.top - SPOT_PAD, w: r.width + SPOT_PAD * 2, h: r.height + SPOT_PAD * 2 }
  const px = Math.min(Math.max(r.left + 24, MARGIN), vw - POP_W - 24)
  let py = r.bottom + GAP
  if (py + POP_H > vh) {
    py = r.top - POP_H - GAP
    if (py < MARGIN) py = Math.min(Math.max(MARGIN, r.top + GAP), vh - POP_H)
  }
  return { spot, pop: { x: px, y: py } }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npm test -- guide`
Expected: PASS

- [ ] **Step 5: `GuideTour.svelte` 생성**

```svelte
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
```

- [ ] **Step 6: `CalloutChip.svelte` 생성**

```svelte
<script lang="ts">
  export let n: number
  export let title: string
  export let body: string
  export let pos: string // e.g. "top:10px; right:14px"
</script>

<div class="chip" style={pos}>
  <span class="num">{n}</span>
  <span class="chip-text"><b>{title}</b> {body}</span>
</div>

<style>
  .chip {
    position: absolute; z-index: 20; display: flex; gap: 8px; align-items: flex-start; max-width: 290px;
    background: var(--chipbg); border: 1px solid var(--chipbd); border-radius: 8px; padding: 8px 10px;
    font-size: 12px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }
  .num {
    flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #ffffff;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .chip-text { line-height: 1.45; color: var(--muted); }
  .chip-text b { color: var(--text); }
</style>
```

- [ ] **Step 7: `App.svelte` — 온보딩 오케스트레이션 + 배너/칩/힌트 스트립**

script에 추가/수정:

```ts
import GuideTour from './components/GuideTour.svelte'
import CalloutChip from './components/CalloutChip.svelte'
import { withColorWords } from './lib/i18n'
const { cb } = prefs // dict/guide/onboarded/theme/sys는 이미 구독 중

let calloutsOpen = false

// First-run onboarding: shown once per install, in the configured guide style.
// Inline hints render whenever the style is 'inline' (no flag involved).
function onLoaded() {
  if ($onboarded) return
  onboarded.set(true)
  if ($guide === 'tour') tourOpen = true
  else if ($guide === 'callouts') {
    calloutsOpen = true
    traceStore.play()
  } else traceStore.play()
}

function finishTour() {
  tourOpen = false
  traceStore.play()
}
function dismissCallouts() {
  calloutsOpen = false
  traceStore.play()
}
```

(Task 12에서 만든 빈 `onLoaded`를 위 내용으로 교체. Task 13의 `tourOpen` 선언은 유지.)

마크업 수정 — 로드된 상태 블록을 다음 구조로:

```svelte
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
    <EmptyState on:sample={openSample} on:open={open} />
  {/if}
  {#if $summary}<Legend />{/if}
  {#if tourOpen}
    <GuideTour on:done={finishTour} />
  {/if}
```

style에 추가:

```css
  .banner { display: flex; align-items: center; gap: 10px; padding: 7px 14px; background: var(--bannerbg); border-bottom: 1px solid var(--bannerbd); font-size: 12.5px; }
  .banner-first { color: var(--accent); font-weight: 600; }
  .banner-desc { color: var(--muted); }
  .banner-btn { margin-left: auto; background: var(--accent); border: 0; color: #ffffff; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
  .strip { padding: 4px 14px; background: var(--panel2); border-bottom: 1px solid var(--border); font-size: 10.5px; letter-spacing: 0.6px; color: var(--muted); }
  .strip b { color: var(--text); font-weight: 600; }
  .sticky { position: sticky; top: 0; z-index: 5; }
```

주의:
- `GraphCanvas`는 `.graph`의 flex-column 안에서 스트립 아래 남은 공간을 채워야 한다. `.graph :global(.graph-wrap) { flex: 1; min-height: 0; }`를 App 스타일에 추가해 wrap이 세로로 늘어나게 한다.
- `data-tour="legend"`는 Task 10에서 Legend 루트에 이미 있음. `data-tour="header"`는 Task 13에서 부여.

- [ ] **Step 8: 검증**

Run: `cd frontend && npm run check && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/guide.ts frontend/src/lib/guide.test.ts frontend/src/components/GuideTour.svelte frontend/src/components/CalloutChip.svelte frontend/src/App.svelte
git commit -m "feat(frontend): first-run onboarding — coachmark tour, callouts, inline hints"
```

---

### Task 15: 최종 검증 — 커버리지 체크리스트·전체 테스트·육안 매트릭스·PR

- [ ] **Step 1: 전체 자동 검증**

```bash
go build ./... && go test ./...
cd frontend && npm test && npm run check
```

Expected: 전부 PASS, svelte-check 에러 0

- [ ] **Step 2: 스펙 커버리지 체크리스트 대조**

`docs/superpowers/specs/2026-07-05-mockup-ui-onboarding-settings-design.md`의 "목업 커버리지 체크리스트" 각 항목을 구현 코드와 대조해 하나씩 체크(`- [x]`)하고, 빠진 항목은 이 시점에 구현한다. 체크 완료된 스펙 파일을 커밋에 포함한다.

- [ ] **Step 3: 육안 검증 (`wails dev`)**

`wails dev` 실행 후 확인 매트릭스:

1. 빈 화면(rich): 카드 2장·버튼 2개·코드 힌트 표시, en/ko 전환, dark/light 전환
2. "샘플 트레이스 살펴보기" → 로드 성공 + (첫 실행이면) 투어 자동 시작
3. 투어: 4단계 스포트라이트 이동, 이전/다음/건너뛰기/완료—재생, 리사이즈 시 위치 재계산
4. 설정: 언어/테마/안내 방식/토글 4개 전부 즉시 반영, 재시작 후 유지 (localStorage)
5. 콜아웃 방식: 배너 + 칩 4개 위치, 확인 시 해제 + 재생
6. 힌트 방식: 스트립 2개 + 범례 그룹 라벨 + 노드 라벨 on
7. 색약 팔레트: 타임라인/그래프/범례/빈 화면 카드 색 동시 전환
8. 반복 재생: 끝 도달 시 처음부터 이어서 재생
9. 라이트 테마에서 두 캔버스 배경/라벨/플레이헤드 색 확인
10. `?` 버튼: 투어 재실행. 시스템 고루틴 토글: 헤더/설정 어디서 바꿔도 일치
11. 기존 기능 회귀: 스크럽, Space, 포커스 체인, 그룹 접기/슈퍼노드, 태스크 헐, 툴팁

검증 후 `git status`에서 `frontend/dist/gitkeep`, `frontend/wailsjs/runtime/*` 변경이 보이면 `git checkout -- frontend/dist/gitkeep frontend/wailsjs/runtime` (CLAUDE.md 규칙).

- [ ] **Step 4: 최종 커밋 + PR**

```bash
git add docs/superpowers/specs/2026-07-05-mockup-ui-onboarding-settings-design.md
git commit -m "docs: tick mockup coverage checklist after implementation"
git push -u origin feat/ui-onboarding-settings
gh pr create --assignee kenshin579 --title "feat: 목업 기반 UI 개선 — 온보딩·설정·테마·i18n·리치 빈 화면" --body "$(cat <<'EOF'
## 배경
- docs/design 목업(GoViz Onboarding)의 6개 기능 묶음을 단일 PR로 구현
- 온보딩 가이드 3방식(투어/콜아웃/인라인 힌트, 최초 1회 자동 표시), 설정 팝업(언어·테마·안내 방식·토글 4개, localStorage 지속)
- 리치 빈 화면 + Go `LoadSampleTrace()` 내장 샘플 트레이스, en/ko i18n(로케일 자동 감지), dark/light 테마 + 색약 팔레트, 범례 정리
- 스펙: docs/superpowers/specs/2026-07-05-mockup-ui-onboarding-settings-design.md (목업 커버리지 체크리스트 포함)

## 테스트 계획
- [ ] `go test ./...` / `npm test` / `npm run check` 통과
- [ ] wails dev 육안 매트릭스: {dark,light} × {en,ko} × {투어,콜아웃,힌트} + 색약 on/off + 샘플/파일 로드
- [ ] 기존 기능 회귀 없음 (스크럽·포커스 체인·그룹 접기·슈퍼노드·툴팁)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review 결과 (계획 작성 시 수행)

- **스펙 커버리지**: 스펙 체크리스트 8개 섹션 전부 태스크에 매핑됨 — 헤더(T13), 설정(T13), 빈 화면(T12), 샘플(T11), 타임라인/그래프(T8/T9/T14), 범례(T10), 배너/투어(T14), 동작·상태(T1/T4/T6/T14). 의도적 제외 3건은 스펙대로 구현하지 않음.
- **타입 일관성**: `Lang/Theme/GuideVariant`(lib/prefs) ↔ i18n/palette/stores 참조 일치, `Dict` 구조 ↔ TooltipCopy 구조적 호환, `placeTour` 시그니처 ↔ GuideTour 호출 일치 확인.
- **주의점**: Task 13의 `tourOpen`이 Task 14 전까지 미사용 — 두 태스크를 연속 실행할 것. timelineLayout 테스트(T8)는 기존 fixture 이름에 맞춰 조정 필요.
