# trace-go Error UX (A3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw library error strings on trace-open failure with short, actionable user-facing messages, shown in a visible error banner.

**Architecture:** A pure Go classifier `classifyOpenError(err) string` (main package) maps `os.Open`/`parse.Parse` errors into friendly messages; `app.go`'s `OpenTrace` wraps both error paths through it. The frontend (`App.svelte`) shows the returned message in a full-width dismissible banner instead of a tiny header span. The happy path is untouched (classifier only runs on error).

**Tech Stack:** Go 1.26, Wails v2, Svelte 3 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-20-error-ux-design.md`.

---

## File Structure

- `errors.go` (package `main`) — **new**: `classifyOpenError(err error) string`.
- `errors_test.go` (package `main`) — **new**: table-driven unit test of every branch.
- `app.go` — **modify**: `OpenTrace` wraps `os.Open` and `parse.Parse` errors through `classifyOpenError`.
- `app_test.go` — **modify**: assert friendly message for missing file; add a not-a-trace integration test (happy-path test already exists).
- `frontend/src/App.svelte` — **modify**: full-width error banner + dismiss; remove the old header `.error` span.

---

## Task 1: Go error classifier

**Files:**
- Create: `errors.go`
- Test: `errors_test.go`

- [ ] **Step 1: Write the failing test**

Create `errors_test.go`:
```go
package main

import (
	"errors"
	"os"
	"testing"
)

func TestClassifyOpenError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"missing", os.ErrNotExist, "Can't find that file — it may have been moved or deleted."},
		{"permission", os.ErrPermission, "Can't open that file — permission denied."},
		{"notTrace", errors.New("bad file format: not a Go execution trace?"), `This file isn't a Go execution trace (or is empty). Open one produced by runtime/trace — e.g. "go test -trace=trace.out", or trace.Start/Stop in your program.`},
		{"version", errors.New("unknown or unsupported trace version go 1.17"), "This trace uses an unsupported format version. Re-capture it with Go 1.22 or newer."},
		{"corrupt", errors.New("broken trace: frontier is empty:\n[gen=1]"), "This trace looks corrupted or was cut off. Make sure trace.Stop() ran before the program exited, then re-capture."},
		{"fallback", errors.New("something unexpected"), "Couldn't read this trace — it may be corrupted or in an unexpected format."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyOpenError(tc.err); got != tc.want {
				t.Errorf("classifyOpenError(%v) =\n  %q\nwant\n  %q", tc.err, got, tc.want)
			}
		})
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
go test . -run TestClassifyOpenError
```
Expected: FAIL — `classifyOpenError` undefined (build error).

- [ ] **Step 3: Write the implementation**

Create `errors.go`:
```go
package main

import (
	"errors"
	"os"
	"strings"
)

// classifyOpenError maps a raw os/parse error from opening a trace into a short,
// user-facing message. os checks (most specific) come first, then substring
// matches on the trace reader's error vocabulary, then a generic fallback so a
// raw library string is never shown to the user.
func classifyOpenError(err error) string {
	switch {
	case errors.Is(err, os.ErrNotExist):
		return "Can't find that file — it may have been moved or deleted."
	case errors.Is(err, os.ErrPermission):
		return "Can't open that file — permission denied."
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "bad file format"):
		return `This file isn't a Go execution trace (or is empty). Open one produced by runtime/trace — e.g. "go test -trace=trace.out", or trace.Start/Stop in your program.`
	case strings.Contains(msg, "unknown or unsupported"):
		return "This trace uses an unsupported format version. Re-capture it with Go 1.22 or newer."
	case strings.Contains(msg, "broken trace"):
		return "This trace looks corrupted or was cut off. Make sure trace.Stop() ran before the program exited, then re-capture."
	default:
		return "Couldn't read this trace — it may be corrupted or in an unexpected format."
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
go test . -run TestClassifyOpenError -v
```
Expected: PASS (all six subtests).

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add errors.go errors_test.go
git commit -m "feat(app): classify trace-open errors into friendly messages"
```

---

## Task 2: Wire classifier into OpenTrace

**Files:**
- Modify: `app.go`
- Modify: `app_test.go`

- [ ] **Step 1: Write the failing tests**

In `app_test.go`, replace the existing `TestOpenTraceMissingFileErrors` function with:
```go
func TestOpenTraceMissingFileErrors(t *testing.T) {
	app := NewApp()
	_, err := app.OpenTrace("/no/such/trace.out")
	if err == nil {
		t.Fatal("expected an error opening a missing file")
	}
	if got := err.Error(); got != "Can't find that file — it may have been moved or deleted." {
		t.Fatalf("unfriendly missing-file error: %q", got)
	}
}

func TestOpenTraceNotATraceErrors(t *testing.T) {
	app := NewApp()
	path := filepath.Join(t.TempDir(), "garbage.out")
	if err := os.WriteFile(path, []byte("not a trace"), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	_, err := app.OpenTrace(path)
	if err == nil {
		t.Fatal("expected an error opening a non-trace file")
	}
	if !strings.Contains(err.Error(), "isn't a Go execution trace") {
		t.Fatalf("unfriendly not-a-trace error: %q", err.Error())
	}
}
```
Add `"strings"` to the `app_test.go` import block (it already imports `os`, `path/filepath`, `testing`, etc.).

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
go test . -run 'TestOpenTraceMissingFileErrors|TestOpenTraceNotATraceErrors'
```
Expected: FAIL — `OpenTrace` currently returns the raw `*PathError` / `bad file format` strings, not the friendly messages.

- [ ] **Step 3: Wire the classifier into OpenTrace**

In `app.go`, add `"errors"` to the import block (it currently imports `"context"`, `"os"`, the wails runtime, and the model/parse packages). Then replace the `OpenTrace` method with:
```go
// OpenTrace parses the execution trace at path into a rendering-ready summary.
// Open/parse failures are mapped to short, user-facing messages.
func (a *App) OpenTrace(path string) (*model.TraceSummary, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, errors.New(classifyOpenError(err))
	}
	defer f.Close()
	sum, err := parse.Parse(f)
	if err != nil {
		return nil, errors.New(classifyOpenError(err))
	}
	return sum, nil
}
```
(`OpenTraceDialog` calls `OpenTrace`, so it inherits the friendly messages; its cancel behavior returning `(nil, nil)` is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/user/GolandProjects/trace-go
go test . -run 'TestOpenTrace' -v
go test ./...
```
Expected: `TestOpenTraceReturnsSummary` (happy path) still passes; the two error tests now pass; full suite green.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add app.go app_test.go
git commit -m "feat(app): return friendly messages from OpenTrace"
```

---

## Task 3: Frontend error banner (manual-verified)

Replaces the tiny header error span with a full-width dismissible banner that works whether or not a trace is already loaded.

**Files:**
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: Remove the header error span**

In `frontend/src/App.svelte`, delete this line from inside `<header>`:
```svelte
    {#if error}<span class="error">{error}</span>{/if}
```

- [ ] **Step 2: Add the banner below the header**

Immediately after the closing `</header>` tag (and before the `{#if $summary}` timeline/graph block), insert:
```svelte
  {#if error}
    <div class="error-banner" role="alert">
      <span class="error-text">{error}</span>
      <button class="dismiss" on:click={() => (error = '')} aria-label="Dismiss error">×</button>
    </div>
  {/if}
```

- [ ] **Step 3: Replace the old `.error` style with banner styles**

In the `<style>` block, remove the now-unused rule:
```svelte
  .error { color: #c25450; font-size: 13px; }
```
and add:
```svelte
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
```

- [ ] **Step 4: Type-check, test, build**

Run:
```bash
cd /Users/user/GolandProjects/trace-go/frontend
npm run check && npm test
cd /Users/user/GolandProjects/trace-go
wails build
```
Expected: 0 check errors; all unit suites pass; `wails build` succeeds.

After `wails build`, revert spurious generated files: `git checkout -- frontend/dist/gitkeep frontend/wailsjs/runtime/` (do NOT commit those). `frontend/wailsjs/go/models.ts` should be unchanged by this edit.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/GolandProjects/trace-go
git add frontend/src/App.svelte
git commit -m "feat(frontend): show trace-open errors in a dismissible banner"
```

- [ ] **Step 6: Manual visual verification (human)**

Prepare a garbage file and (re)use a valid trace, then open them. Run:
```bash
printf 'not a go trace' > ~/Desktop/not-a-trace.out && echo "ready: ~/Desktop/not-a-trace.out"
ls ~/Desktop/trace-tasks.out >/dev/null 2>&1 && echo "valid trace present: ~/Desktop/trace-tasks.out" || echo "no valid trace on Desktop — generate one if needed"
```
Then run the app (`open build/bin/trace-go.app`) and confirm:
1. **Not-a-trace** — Open `~/Desktop/not-a-trace.out`: a red banner appears under the header reading "This file isn't a Go execution trace (or is empty)…", and the center still shows the "Open a Go execution trace" prompt (no crash, no raw error string).
2. **Dismiss** — Click the `×`: the banner disappears.
3. **Valid trace** — Open a real trace (e.g. `~/Desktop/trace-tasks.out`): it loads normally, no banner.
4. **Error while loaded** — With a trace loaded, open `~/Desktop/not-a-trace.out` again: the banner appears above the still-loaded timeline (the error is not hidden), and the previous trace stays visible.

Report observations. If the app can't launch, report DONE_WITH_CONCERNS noting build + type-check + Go tests passed and only the live check remains.

---

## Self-Review Notes

- **Spec coverage:** classifier + 4 categories + fallback (spec §2) → Task 1; OpenTrace wiring + integration tests (spec §2, §4) → Task 2; banner + header-span removal (spec §3) → Task 3; testing (spec §4) → Tasks 1-3; file boundaries (spec §5) → all tasks.
- **Placeholder scan:** none — every message string and test is concrete.
- **Type/string consistency:** the six message strings in `classifyOpenError` (Task 1) are byte-for-byte the same as the `want` values in `errors_test.go` (Task 1) and the substrings asserted in `app_test.go` (Task 2: "Can't find that file …" and "isn't a Go execution trace"). The em-dash `—` and curly checks are consistent across all three.
- **Invariant preserved:** `classifyOpenError` runs only on the error path; `TestOpenTraceReturnsSummary` guards the happy path. Frontend change is confined to `App.svelte`.
- **Scope:** old-format "degraded" warning, raw-error display, i18n, and the CLAUDE.md doc correction are explicitly out (spec §1), and no task touches them.
