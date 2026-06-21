# Timeline Goroutine Grouping — Design (B6 Stage 1)

## 1. 개요 & 범위

타임라인에서 **같은 시작 함수에서 뜬 goroutine들**(워커풀의 동일 워커 N개)을 접을 수 있는 그룹으로 묶어, 긴 레인 목록의 노이즈를 줄인다. 워커가 수십~수백인 trace에서 "동일 워커 200줄"을 헤더 한 줄로 접을 수 있게 한다.

이것은 **B6 Stage 1 (타임라인 전용)**. 접힘 상태를 store에 두어, 후속 **Stage 2 (그래프 슈퍼노드)** 가 동일 상태를 재사용하도록 토대를 깐다. Stage 2는 별도 spec/plan/PR (force 시뮬레이션·클러스터 hull·엣지 재배선이 얽혀 위험이 커서 분리).

### Carried-over 결정 (브레인스토밍에서 확정)
- **접힌 행 표현 = A(헤더만)**: 접힌 그룹은 `▸ 이름 ×N` 헤더 한 줄, 타임라인 내용 없음. 새 시각 문법 0개 — 가장 읽기 쉬움.
- **그룹 키 = 시작 함수 이름, 멤버 ≥2일 때만 그룹**: `goroutine.name`이 같고 2개 이상이면 그룹. 1개거나 빈 이름(`""`, 예: main)은 단독 레인(안 묶임). 멤버는 헤더 아래 연달아 배치.
- **기본 펼침**: 처음 열면 그룹 헤더 줄 + 멤버 레인 모두 보임(첫 화면은 그룹마다 헤더 한 줄만 추가, 디테일 0 숨김). 접기는 사용자가 헤더 클릭 시.
- **타임라인 전용**: 그룹핑/접힘은 타임라인에만. 그래프는 불변(Stage 2에서 슈퍼노드).

### 범위 밖 (YAGNI / 후속)
- **그래프 슈퍼노드 (Stage 2)** — 토대만 깔아둠(store 접힘 상태 공유).
- 기본 접힘·그룹 임계값(N개 이상만) — 배제.
- 헤더 hover 툴팁, 그룹 정렬/검색, 그룹 단위 선택.
- 인과 포커스 시 **비사슬 그룹 헤더 dim** — 헤더는 구조 요소라 풀 불투명 유지(원하면 후속).

---

## 2. 순수 그룹핑 로직 (`frontend/src/lib/grouping.ts`)

```ts
import type { Goroutine } from './types'

export interface GoroutineGroup {
  key: string          // 그룹 식별자 = 시작 함수 이름 (빈 이름은 자신의 단독 키)
  name: string         // 표시 이름
  members: Goroutine[] // 1개면 단독(헤더 없음), 2개+면 그룹(헤더 있음)
}

// groupGoroutines: 같은 비어있지-않은 name을 가진 goroutine이 2개 이상이면 한
// 그룹으로 묶고 멤버를 연달아 배치한다. name이 ""이거나 그 이름이 유일하면 단독
// 그룹(members.length === 1). 각 그룹은 그 이름의 첫 등장 순서로 정렬(안정적).
export function groupGoroutines(goroutines: Goroutine[]): GoroutineGroup[]
```

- 그룹 여부 = `members.length >= 2` (소비 측 판정; 단독은 헤더 없이 일반 레인).
- 빈 이름(`""`) goroutine은 서로 묶지 않는다 — 각자 단독 그룹. (키는 고유해야 하므로 빈 이름 단독은 `g<id>` 등 고유 키를 쓴다.)
- 첫 등장 순서 보존: 입력에서 그 그룹의 첫 멤버가 나타난 위치 순으로 그룹을 정렬 → 안정적·예측 가능.

---

## 3. 그룹 인지 레이아웃 (`frontend/src/lib/timelineLayout.ts`)

레이아웃 산출물을 `Lane[]`에서 **행 유니온 `TimelineRow[]`** 로 진화시킨다. 입력에 `groups`(§2)와 `collapsedKeys: Set<string>`를 받아 순서 있는 행 목록을 단일 패스로 산출:

```ts
export type TimelineRow =
  | ({ kind: 'lane' } & Lane)
  | { kind: 'header'; key: string; name: string; count: number; collapsed: boolean; y: number; height: number }
```

- `members.length >= 2` 그룹 → **헤더 행** 1개(고정 높이 `GROUP_HEADER_H`). 펼침이면 그 아래 멤버 **레인 행**들; 접힘이면 헤더만.
- 단독(members===1) → 기존과 동일한 **레인 행**(`kind:'lane'`, 현재 Lane 필드 그대로).
- `y`는 헤더(고정 높이)와 레인(가변 높이)을 한 번의 패스로 누적 배정.
- 헤더 행은 시간 축 콘텐츠가 없다(라벨·디스클로저만).

**트레이드오프:** 산출물 형태 변경(`Lane[]` → `TimelineRow[]`)으로 기존 `timelineLayout` 테스트를 새 형태에 맞게 갱신한다(우리 테스트 모듈이라 정상). 단일 패스가 헤더를 레인 사이에 끼워 y를 일관되게 매기는 가장 깔끔한 방법.

---

## 4. Store (`frontend/src/stores/trace.ts`)

접힘 상태를 store에 둔다(Stage 2 그래프가 재사용):
```ts
collapsedGroups: Writable<Set<string>>   // 접힌 그룹 키 집합. 초기 빈 Set(기본 펼침).
toggleGroup(key: string): void           // 키를 새 Set으로 교체하며 토글(Svelte 반응성).
```
- `loadSummary(s)`에서 `collapsedGroups`를 **빈 Set으로 리셋**(이전 trace 키 잔재 방지).
- `toggleGroup`은 항상 **새 Set 인스턴스**를 set 한다(같은 Set 변형은 Svelte가 감지 못함).

**Stage 2 연결:** 그룹 키 = 시작 함수 이름이라는 계약을 store + `lib/grouping.ts`가 공유. 그래프는 나중에 동일한 `groupGoroutines` + `collapsedGroups`를 읽어 "타임라인에서 접힌 그룹 = 그래프 슈퍼노드"를 재작업 없이 구현. 지금 Stage 2 코드는 0줄이지만 인터페이스는 준비됨.

---

## 5. 렌더링 + 인터랙션 (`frontend/src/components/TimelineCanvas.svelte`)

컴포넌트가 행(row) 목록을 순회:
- **헤더 행**: 디스클로저 삼각형(`▸` 접힘 / `▾` 펼침) + `name ×count`를 거터/트랙 영역에 옅은 배경으로 그림.
- **레인 행**: 기존 그대로(상태 바·region·log·라벨). 현재의 per-lane 루프는 `kind === 'lane'` 행만 순회.
- **playhead·선택 외곽선·TASKS 트랙·인과 포커스(레인 dim)**: 불변. 헤더는 풀 불투명 유지(인과 포커스 시에도).
- **cssHeight**: 모든 행(헤더+레인) 높이 합.

**인터랙션:**
- `onPointerDown`: 포인터가 헤더 행 y-범위면 `toggleGroup(key)` 호출 후 **return**(playhead 스크럽 안 함). 그 외는 기존 스크럽.
- 헤더 행 hit 판정은 순수 함수로 추출(`hitGroupHeader(rows, y)` 류)해 테스트 가능하게.
- 커서: 헤더 위 `pointer`, 레인 위 기존 `ew-resize`.

---

## 6. 파일 경계 & 테스트

### 파일
- `frontend/src/lib/grouping.ts` (+ `.test.ts`) — **신규**: `groupGoroutines`.
- `frontend/src/lib/timelineLayout.ts` (+ 기존 `.test.ts` 갱신) — **수정**: 그룹 인지 `TimelineRow[]` 산출 + 헤더 hit 판정.
- `frontend/src/stores/trace.ts` (+ `.test.ts`) — **수정**: `collapsedGroups`/`toggleGroup`/loadSummary 리셋.
- `frontend/src/components/TimelineCanvas.svelte` — **수정**: 행 분기 렌더 + 헤더 클릭 토글.

### 테스트 (불변식 기반)
- `grouping.test.ts`: 같은 이름 6개 → 1그룹(members=6); 혼합 → 그룹+단독; 빈 이름들 → 각자 단독; 같은 이름 1개 → 단독; 첫 등장 순서 보존.
- `timelineLayout.test.ts`(갱신): 접힌 그룹 → 헤더만; 펼친 그룹 → 헤더 + 멤버 레인; 단독 → 레인; y 누적 정확. 헤더 hit 판정(헤더 y → 키, 레인/빈 → null).
- `trace.test.ts`: `toggleGroup` 추가/제거, `loadSummary`가 `collapsedGroups` 리셋.
- 컴포넌트: 헤더 렌더·클릭 접힘·커서는 시각 확인(Canvas 픽셀 수동, 프로젝트 관례).

### 불변식 / 호환
- 기본 펼침 + 접힘 빈 Set → 첫 화면은 **그룹 헤더 한 줄씩만 추가**, 디테일 0 숨김.
- playhead·선택·TASKS·인과 포커스·그래프 모두 불변.
- 접힘 상태는 store에 있어 Stage 2(그래프 슈퍼노드)가 재사용.

---

## 7. 리스크 & 완화

- **레이아웃 산출물 형태 변경(`Lane[]`→`TimelineRow[]`)이 컴포넌트/테스트에 파급** → 단일 PR 안에서 레이아웃·컴포넌트·테스트를 함께 갱신(우리 코드 한정, 외부 계약 아님). (완화)
- **헤더 클릭 vs 스크럽 충돌** → onPointerDown에서 헤더 y-범위면 토글 후 early-return. (완화)
- **value: 작은 trace에선 효과 미미** → 기본 펼침이라 작은 trace는 헤더 한 줄만 추가(무해); 큰 trace에서 진가. Stage 1을 써보고 가치 확인 후 Stage 2 결정. (수용)
- **빈 이름 키 충돌** → 빈 이름 단독은 `g<id>` 등 고유 키 부여(서로 안 묶임). (완화)
