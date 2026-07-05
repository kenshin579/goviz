// UI copy for en/ko, ported verbatim from the design mockup
// (docs/design/UI 사용성 개선 제안/TraceGo Onboarding.dc.html, `copy` object).
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
    'trace-go replays a standard Go execution trace: every goroutine gets a timeline lane on top, and a live graph below shows who unblocked whom — both driven by one shared playhead.',
  card1Title: '① Timeline',
  card1Desc: 'One lane per goroutine — {run} running, gray runnable, {blk} blocked. Hover a bar to see why it blocked.',
  card2Title: '② Live graph',
  card2Desc: 'Circles are goroutines at the playhead; a line lights up when one unblocks another — blue channel, orange mutex.',
  sampleBtn: '▶  Explore a sample trace',
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
  stepLabel: 'STEP {n} OF {total}',
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
    'trace-go는 표준 Go 실행 트레이스를 재생합니다. 위쪽 타임라인에는 고루틴별 레인이, 아래쪽 라이브 그래프에는 누가 누구를 깨웠는지가 표시되며, 두 뷰는 하나의 플레이헤드로 함께 움직입니다.',
  card1Title: '① 타임라인',
  card1Desc: '고루틴마다 한 줄 — {run}은 실행 중, 회색은 실행 대기, {blk}은 차단됨. 막대에 마우스를 올리면 차단 이유가 보입니다.',
  card2Title: '② 라이브 그래프',
  card2Desc: '원은 플레이헤드 시점의 고루틴이며, 한 고루틴이 다른 고루틴을 깨우면 선이 켜집니다 — 파랑은 채널, 주황은 뮤텍스.',
  sampleBtn: '▶  샘플 트레이스 살펴보기',
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
  stepLabel: '단계 {n} / {total}',
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
