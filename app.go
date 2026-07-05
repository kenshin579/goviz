package main

import (
	"bytes"
	"context"
	"errors"
	"os"
	"runtime/trace"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/kenshin579/trace-go/internal/model"
	"github.com/kenshin579/trace-go/internal/parse"
)

// App is the Wails-bound application backend.
type App struct {
	ctx context.Context
	// sampleMu serializes LoadSampleTrace: the runtime tracer is process-global
	// and Wails may dispatch bindings concurrently.
	sampleMu sync.Mutex
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

// startup stores the Wails runtime context for later runtime calls (dialogs).
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

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

// OpenTraceDialog shows a native file picker and parses the chosen trace.
// It returns (nil, nil) when the user cancels the dialog.
func (a *App) OpenTraceDialog() (*model.TraceSummary, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Go execution trace",
		Filters: []runtime.FileFilter{
			{DisplayName: "Trace files (*.out, *.trace)", Pattern: "*.out;*.trace"},
			{DisplayName: "All files (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil {
		return nil, errors.New("Couldn't open the file picker — please try again.")
	}
	if path == "" {
		return nil, nil // user cancelled
	}
	return a.OpenTrace(path)
}

// LoadSampleTrace records a small built-in concurrent workload under the tracer
// and parses it in-process, so first-time users can explore the UI without
// bringing their own trace. The workload mixes an unbuffered producer/consumer
// channel (guaranteed rendezvous blocking → channel causal edges) with three
// workers contending on one mutex (→ mutex edges).
func (a *App) LoadSampleTrace() (*model.TraceSummary, error) {
	a.sampleMu.Lock()
	defer a.sampleMu.Unlock()
	var buf bytes.Buffer
	if err := trace.Start(&buf); err != nil {
		return nil, errors.New("Couldn't record the sample trace — please try again.")
	}
	func() {
		defer trace.Stop()
		runSampleWorkload()
	}()
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
