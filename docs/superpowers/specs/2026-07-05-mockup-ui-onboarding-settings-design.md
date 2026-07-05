# UI 개선: 온보딩·설정·테마·i18n·리치 빈 화면 (목업 기반)

- 날짜: 2026-07-05
- 근거 목업: `docs/design/UI 사용성 개선 제안/TraceGo Onboarding.dc.html`
- 범위: 목업의 6개 기능 묶음 전부, **단일 PR**로 구현

## 배경

`docs/design`의 인터랙티브 목업은 trace-go의 사용성 개선안(온보딩 가이드, 설정 팝업, 리치 빈
화면, i18n, 라이트 테마, 범례 정리)을 담고 있다. 이 스펙은 목업을 실제 앱으로 옮길 때
**누락되는 포인트가 없도록** 전체 요소를 체크리스트로 항목화하고, 구현 구조를 정의한다.

## 확정된 결정

| 결정 | 내용 |
|---|---|
| 범위 | 목업 6개 묶음 전부 (온보딩, 설정, 빈 화면+샘플, i18n, 테마+색약, 범례) |
| PR 전략 | 단일 PR |
| 가이드 자동 표시 | **최초 1회만** (`tracego.onboarded` localStorage 플래그), 이후 `?` 버튼으로 수동 실행 |
| 언어 기본값 | `navigator.language`가 `ko*`면 한국어, 아니면 영어 (설정에서 변경 가능) |
| 구현 접근 | 경량 자체 구현 — i18n 라이브러리 없음, 샘플 트레이스는 Go에서 런타임 생성 |
| 빈 화면 | 목업의 `rich` 변형 채택 (`minimal`은 A/B 시안이므로 제외) |

## 아키텍처

기존 원칙 유지: **뷰 결정은 순수 `lib/` 모듈(Vitest 테스트), 컴포넌트는 얇은 렌더러.**

```
stores/prefs.ts  ← localStorage 지속 설정의 단일 소스 (lang/theme/guide/loop/labels/cb/sys/onboarded)
lib/prefs.ts     ← 직렬화·기본값·로케일 감지 순수 함수
lib/i18n.ts      ← en/ko 사전 + t(lang) 조회, {run}/{blk} 색 단어 치환
lib/palette.ts   ← palette(theme, colorblind) → 상태/카테고리/DIM/RING 색 (format.ts에서 분리·확장)
lib/guide.ts     ← 투어 스텝 정의 + 스포트라이트/팝오버 위치 계산(measure) 순수 함수
components/SettingsPopup.svelte  ← 설정 팝업
components/EmptyState.svelte     ← 리치 빈 화면
components/GuideTour.svelte      ← 코치마크 투어 (스포트라이트+팝오버)
components/GuideCallouts.svelte  ← 첫 실행 배너 + 번호 칩 4개
(인라인 힌트는 Timeline/Graph/Legend에 조건부 렌더)
app.go           ← LoadSampleTrace() 바인딩 추가 (유일한 Go 작업)
```

### stores/prefs.ts

| localStorage 키 | 타입 | 기본값 |
|---|---|---|
| `tracego.lang` | `'en' \| 'ko'` | 로케일 자동 감지 |
| `tracego.theme` | `'dark' \| 'light'` | `dark` |
| `tracego.guide` | `'tour' \| 'callouts' \| 'inline'` | `tour` |
| `tracego.loop` | boolean | `false` |
| `tracego.labels` | boolean \| null | `null` (null이면 guide가 `inline`일 때만 on — 목업 `nodeLabels ?? (variant==='inline')`) |
| `tracego.cb` | boolean | `false` |
| `tracego.sys` | boolean | `false` |
| `tracego.onboarded` | boolean | `false` |

- 각 값은 Svelte writable로 노출하고, set 시 즉시 localStorage에 기록한다.
- `showSystem`은 기존 `traceStore`에 남기되 prefs(`tracego.sys`)와 양방향 동기화한다
  (양쪽 UI — 헤더 체크박스와 설정 팝업 — 어디서 바꿔도 일치).
- localStorage 접근은 try/catch로 감싼다 (목업과 동일).

### lib/i18n.ts

- 목업의 `copy` 객체(en/ko)를 그대로 이관한다. 키 구조도 목업을 따른다
  (openBtn, speed, sys, helpTip, settingsTip, lang, theme, dark, light, guide, guideTour,
  guideCall, guideHints, loopL, labelsL, cbL, cwStd/cwCb, info(g,e,ms), emptyTitle, emptyDesc,
  card1Title/Desc, card2Title/Desc, sampleBtn, noTracePre/Post, firstTime, bannerDesc, gotIt,
  chip1~4 T/B, tlStripT/D, grStripT/D, legStateGroup, legEdgeGroup, states, notAlive, cats,
  inferred, legFocusHint, stepLabel, skip, back, next, done, tour[4]).
- `info`는 목업이 `100.0 ms`를 하드코딩했으므로 실제 duration(ms)을 파라미터로 받도록 시그니처만
  확장한다: `info(goroutines, edges, ms)`.
- `{run}`/`{blk}` 치환: 색약 여부에 따라 en은 green/red ↔ blue/orange, ko는 초록/빨강 ↔
  파랑/주황 (목업 `cwStd`/`cwCb` + `fmt`).
- 테스트: en/ko 키 패리티(재귀 비교), 치환 함수, 로케일 감지.

### lib/palette.ts

`palette(theme: 'dark'|'light', colorblind: boolean)` 순수 함수:

| 항목 | 표준 | 색약 |
|---|---|---|
| running | `#4caf50` | `#0072b2` |
| runnable | `#9aa3b2` | `#9aa3b2` |
| blocked | `#c25450` | `#d55e00` |
| channel / mutex / other | `#5b8def` / `#e0a030` / `#a78bdb` (공통) | 동일 |
| DIM (미생존/비활성) | dark `#2a2e38`, light `#d4d8e0` | 동일 |
| RING (선택 링) | dark `#ffffff`, light `#12161f` | 동일 |
| GHOST 알파 (포커스 외) | 0.15 (목업값 — 기존 앱 값과 다르면 목업값으로 통일) | 동일 |

- 기존 `format.ts`의 색 상수(`stateColor`, `DIM_COLOR`, `CATEGORY_COLORS` 등)는 palette 기반으로
  대체하고, 태스크 색상 등 나머지 `format.ts` 기능은 유지한다.
- 캔버스 컴포넌트(Timeline/Graph)와 Legend, EmptyState 미리보기 카드는 prefs에서 파생된 palette
  스토어를 구독해 다시 그린다. **GraphCanvas의 시뮬레이션 재구축 금지 불변식 유지** — 팔레트/라벨
  변경은 redraw만 유발한다.

### DOM 테마 (CSS 변수)

목업의 두 변수 세트를 그대로 도입한다 (`:root` = dark, `[data-theme="light"]` 오버라이드):
`--bg --panel --panel2 --border --text --strong --muted --faint --accent --dim --chipbg --chipbd
--bannerbg --bannerbd --btn2 --shade`. `App.svelte` 루트에 `data-theme`를 바인딩하고, 컴포넌트의
하드코딩 hex를 변수로 치환한다.

## 컴포넌트별 상세

### 헤더 (App.svelte)

- 우측에 원형 26px **⚙ 설정**, **? 도움말** 버튼 추가 (tooltip = `settingsTip`/`helpTip`).
- `?`는 트레이스 로드 상태에서만 동작하며 **항상 투어를 실행**한다 (목업 `onHelp → openTour`).
- info 텍스트를 i18n으로 (ko: `고루틴 N · 엣지 N · X ms`).
- 재생/속도/시스템 토글(Controls)은 위치·동작 유지, 문구만 i18n.

### 설정 팝업 (SettingsPopup.svelte)

- 전면 오버레이(`--shade`) + 중앙 320px 패널, 제목 + `×` 닫기.
- 세그먼트 3줄: 언어(English/한국어), 테마(다크/라이트), 안내 방식(투어/콜아웃/힌트) —
  활성 세그먼트는 accent 배경.
- 체크박스 4줄: 반복 재생, 노드 이름 항상 표시, 색약 친화 색상, 시스템 고루틴 표시.
- 닫기: `×`, 오버레이 클릭, 패널 밖 pointerdown (패널 내부는 stopPropagation — 목업과 동일).
- 모든 변경은 즉시 prefs 반영 (저장 버튼 없음).

### 리치 빈 화면 (EmptyState.svelte)

- 좌측 정렬 660px 컬럼: 제목(`emptyTitle`) + 설명(`emptyDesc`).
- 카드 1 — 미니 타임라인: main/producer/worker-1 3개 레인을 CSS 막대로 정적 렌더
  (색은 palette 사용, 목업의 세그먼트 비율 그대로), 제목 `① Timeline`, 설명({run}/{blk} 치환).
- 카드 2 — 미니 그래프: 정적 SVG(노드 4, 엣지 3 — 채널 파랑/뮤텍스 주황/DIM), 제목/설명.
- 버튼: **▶ 샘플 트레이스 살펴보기**(primary) + **트레이스 열기… (.out)**(secondary).
- 하단 힌트: `noTracePre` + `<code>go test -trace trace.out ./...</code>` + `noTracePost`.

### 샘플 트레이스 (app.go — 유일한 백엔드 작업)

- `LoadSampleTrace() (*model.TraceSummary, error)` 바인딩:
  producer/consumer + worker×3 + `sync.Mutex` + `sync.WaitGroup` 워크로드(목업 데이터와 같은
  구성, 이름은 `trace.Log`가 아닌 고루틴 자연 이름 — 이름이 비면 `g<id>` 폴백은 기존 규칙)를
  `runtime/trace.Start/Stop`으로 in-process 실행 → 임시 파일 → `parse.Parse` → 반환.
- `app_test.go`의 `writeSampleTrace` 패턴 재사용. 워크로드는 채널 랑데부·뮤텍스 경합을
  반드시 포함해 온보딩 화면에서 channel/mutex 엣지가 보이게 한다.
- 실패 시 기존 에러 배너로 표출.
- 테스트(불변식 기반): 고루틴 ≥ 5, Channel 엣지 ≥ 1, Mutex 관련 Blocked 인터벌 ≥ 1.

### 온보딩 가이드 (3방식, lib/guide.ts + 컴포넌트 2개 + 인라인 조건부 렌더)

공통:
- 트레이스 **최초 로드 1회** 자동 표시 (`tracego.onboarded`가 false일 때 → 표시 후 true 기록).
  샘플 로드/파일 열기 모두 트리거.
- 표시 방식은 `tracego.guide` 설정을 따른다. **최초 1회 자동 표시 경로에서만** 종료(완료/스킵/확인)
  시 자동 재생을 시작한다 (목업 동작). `?` 버튼으로 재실행한 투어는 종료 시 사용자의 재생
  상태를 건드리지 않는다 (코드 리뷰에서 확정한 편차 — 일시정지해 둔 탐사 지점 보존).

**투어 (GuideTour.svelte):**
- 대상 4개: `[data-tour="timeline"|"header"|"graph"|"legend"]` 순서는 목업의
  timeline → header → graph → legend.
- 스포트라이트: 대상 rect + 4px 패딩, `box-shadow: 0 0 0 9999px shade` 기법, 0.25s transition.
- 팝오버(330px): `STEP {n} OF 4`(ko: `단계 {n} / 4`) 라벨, 제목, 본문({run}/{blk} 치환),
  버튼 [건너뛰기] [이전(1단계에서 흐림)] [다음/완료—재생].
- 위치 계산은 `lib/guide.ts`의 순수 함수 `measure(rect, viewport)` (목업 로직 이관: 아래 우선,
  안 맞으면 위, 최종 클램프; POP_H=210). 리사이즈 시 재측정.
- 투어 열릴 때 재생 일시정지, 4단계 완료 또는 스킵 시 재생.

**콜아웃 (GuideCallouts.svelte):**
- 헤더 아래 배너: `처음이신가요?`(accent) + 설명 + [확인했어요 — 재생 시작] 버튼.
- 번호 칩 4개(타임라인 우상단 ①, 좌하단 ②, 그래프 좌상단 ③, 우하단 ④) — 칩 스타일·문구는
  목업 그대로. 확인 시 배너·칩 해제 + 재생.

**인라인 힌트 (조건부 렌더):**
- 타임라인 상단 sticky 스트립: `TIMELINE · one lane per goroutine · …` (ko 동일 구조).
- 그래프 상단 스트립: `LIVE GRAPH · …`.
- 범례에 그룹 라벨(`고루틴 상태` / `웨이크업 엣지`) + 우측 포커스 힌트 표시.
- 노드 라벨 기본 on (labels가 null일 때).
- 인라인 방식은 상시 표시이므로 `onboarded` 플래그와 무관하게 항상 렌더.

### 재생·그래프 소소 개선

- **반복 재생**: `lib/playback.ts`의 `nextPlayhead`에 `loop` 옵션 — 끝 도달 시 시작점으로 wrap
  (목업 `p - 100` 방식으로 초과분 이월). `advance`가 prefs.loop을 읽는다. 테스트 추가.
- **노드 이름 항상 표시**: GraphCanvas가 labels 설정 on이면 모든 노드 옆에 이름
  (`goroutineLabel` 폴백 규칙 유지). 라벨 토글은 redraw만.

### 범례 (Legend.svelte)

- 문구 i18n, palette 구독.
- 엣지 항목 라벨은 `channel (inferred)` / ko `채널 (추정)` 형식 (목업).
- 기존 중복 항목 "inferred link" 제거.
- 인라인 힌트 방식일 때만: 그룹 라벨 2개 + 우측 정렬 포커스 힌트.

## 목업 커버리지 체크리스트

구현·리뷰 시 아래 표의 모든 행을 대조한다. (목업 줄 번호는 `TraceGo Onboarding.dc.html` 기준)

### 헤더 (목업 L20-46)
- [x] 트레이스 열기 버튼 (accent, i18n) — App.svelte
- [x] info 텍스트 `고루틴 N · 엣지 N · X ms` (i18n) — App.svelte
- [x] 재생/일시정지 버튼 + `Play/Pause (Space)` tooltip — Controls.svelte
- [x] 속도 select 0.25/0.5/1/2/4× — Controls.svelte (기존)
- [x] 시스템 고루틴 체크박스 (i18n + 지속화) — Controls.svelte
- [x] ⚙ 설정 버튼 (원형, tooltip) — App.svelte
- [x] ? 도움말 버튼 (원형, tooltip, 로드 시 투어 실행) — App.svelte

### 설정 팝업 (목업 L48-88, L600-618)
- [x] 오버레이 + 320px 패널 + 제목 + × — SettingsPopup.svelte
- [x] 언어 세그먼트 English/한국어 — SettingsPopup.svelte
- [x] 테마 세그먼트 다크/라이트 — SettingsPopup.svelte
- [x] 안내 방식 세그먼트 투어/콜아웃/힌트 — SettingsPopup.svelte
- [x] 토글: 반복 재생 / 노드 이름 항상 표시 / 색약 친화 색상 / 시스템 고루틴 — SettingsPopup.svelte
- [x] 바깥 클릭·×로 닫힘, 패널 내부 클릭 유지 — SettingsPopup.svelte
- [x] 모든 설정 localStorage 지속 + 재시작 후 복원 — stores/prefs.ts

### 빈 화면 rich (목업 L99-153)
- [x] 제목 + 설명 (i18n) — EmptyState.svelte
- [x] 카드1: 미니 타임라인 3레인 (palette 색, 목업 비율) + 제목/설명({run}/{blk} 치환) — EmptyState.svelte
- [x] 카드2: 미니 그래프 SVG (노드4/엣지3) + 제목/설명 — EmptyState.svelte
- [x] ▶ 샘플 트레이스 버튼 (primary) — EmptyState.svelte → LoadSampleTrace
- [x] 트레이스 열기… (.out) 버튼 (secondary) — EmptyState.svelte
- [x] `go test -trace` 코드 힌트 (i18n 전/후 문구) — EmptyState.svelte

### 타임라인/그래프 영역 (목업 L167-230)
- [x] 타임라인 인라인 힌트 스트립 (sticky, inline 방식일 때) — TimelineCanvas.svelte (App.svelte에 구현)
- [x] 그래프 인라인 힌트 스트립 (inline 방식일 때) — GraphCanvas.svelte (App.svelte에 구현)
- [x] 콜아웃 칩 ①(타임라인 우상단)·②(타임라인 좌하단)·③(그래프 좌상단)·④(그래프 우하단) — GuideCallouts.svelte (App.svelte + CalloutChip.svelte에 구현)
- [x] 노드 라벨 토글 반영 (labels ?? inline 기본) — GraphCanvas.svelte
- [x] 팔레트(테마·색약) 반영해 캔버스 재렌더 — Timeline/GraphCanvas
- [x] 스크럽·포커스 체인·엣지 플래시 기존 동작 회귀 없음 — (기존 기능)

### 범례 (목업 L232-250)
- [x] 상태 4항목 + 엣지 3항목 `(inferred/추정)` (i18n, palette) — Legend.svelte
- [x] 중복 "inferred link" 항목 제거 — Legend.svelte
- [x] inline 방식: 그룹 라벨 2개 + 우측 포커스 힌트 — Legend.svelte

### 첫 실행 배너 (목업 L90-97)
- [x] `처음이신가요?` 배너 + [확인 — 재생 시작] (콜아웃 방식일 때) — GuideCallouts.svelte (App.svelte에 구현)

### 투어 (목업 L253-266, L458-490)
- [x] 스포트라이트 (rect+4px, 9999px shadow, 0.25s transition) — GuideTour.svelte
- [x] 팝오버: STEP 라벨/제목/본문/건너뛰기/이전(1단계 흐림)/다음/완료—재생 — GuideTour.svelte
- [x] 4단계 내용 (타임라인→재생→그래프→범례&포커스, en/ko) — lib/i18n.ts
- [x] 위치 계산 (아래→위→클램프, POP_H 210) 순수 함수 + 테스트 — lib/guide.ts
- [x] 리사이즈 시 재측정 — GuideTour.svelte
- [x] 투어 중 재생 일시정지, 종료 시 재생 — GuideTour.svelte (종료 시 재생은 최초 온보딩 투어만 — `?` 재실행 종료 시에는 재생하지 않음, App.svelte 의도적 처리)

### 동작·상태 (목업 스크립트)
- [x] Space 재생/정지 + 폼 요소 가드 — App.svelte (기존)
- [x] 반복 재생 (끝→시작 wrap, 초과분 이월) — lib/playback.ts
- [x] 색 단어 치환 {run}/{blk} (표준/색약 × en/ko) — lib/i18n.ts
- [x] 언어 로케일 자동 감지 (최초 실행) — lib/prefs.ts
- [x] 가이드 최초 1회 자동 표시 (`tracego.onboarded`) — App.svelte
- [x] 색약 팔레트 (#0072b2/#d55e00) — lib/palette.ts
- [x] 테마별 DIM/RING 색 — lib/palette.ts
- [x] CSS 변수 dark/light 두 세트 — style.css / App.svelte

### 의도적 제외 (3건)
1. `minimal` 빈 화면 변형 — rich 채택 (목업의 A/B 시안).
2. 디자인툴용 props (`guideVariant`, `autoShowGuide`, `emptyVariant`, `language`, `theme` 기본값
   에디터) — 실제 앱은 설정 팝업 + prefs가 대체.
3. 목업의 "열기 버튼 = 샘플 로드" 데모 동작 — 실제 앱은 파일 다이얼로그 유지, 샘플은 빈 화면
   버튼으로만.

## 에러 처리

- `LoadSampleTrace` 실패 → 기존 에러 배너 재사용.
- localStorage 접근 불가(예외) → 메모리 기본값으로 동작, 앱은 정상.
- i18n 키 누락 → en 폴백 (테스트로 패리티를 보장하므로 방어적 처리만).

## 테스트 전략

- **Vitest (순수 lib/)**: i18n en/ko 키 패리티·치환·info 포맷, palette 조합(2테마×2색약),
  prefs 직렬화/기본값/로케일 감지, guide measure(아래 배치/위 배치/클램프 케이스),
  playback loop wrap.
- **Go**: `TestLoadSampleTrace` — 불변식 기반(고루틴 수, Channel 엣지 존재, Mutex Blocked 존재).
- **컴포넌트**: 기존 전략대로 유닛 테스트 없이 `wails dev` 육안 검증 —
  매트릭스: {dark, light} × {en, ko} × {투어, 콜아웃, 힌트} + 색약 on/off + 샘플/파일 로드.
- 완료 기준: `npm test`, `npm run check`, `go test ./...` 전부 통과 + 육안 매트릭스 확인.

## 불변식 (기존 유지)

- GraphCanvas d3 시뮬레이션은 노드 집합 변경 시에만 재구축 — 테마/라벨/색약 변경은 redraw만.
- `name` 빈 문자열 → `g<id>` 폴백, `endedAt === 0` 센티널, 시스템 고루틴 기본 숨김.
- 엣지는 추정(inferred) — 문구에 "(inferred/추정)" 유지.
