package parse_test

import (
	"bytes"
	"io"
	"runtime/trace"
	"sync"
	"testing"
)

// genTrace runs scenario while the execution tracer is active and returns a
// reader over the captured trace bytes.
func genTrace(t *testing.T, scenario func()) io.Reader {
	t.Helper()
	var buf bytes.Buffer
	if err := trace.Start(&buf); err != nil {
		t.Fatalf("trace.Start: %v", err)
	}
	scenario()
	trace.Stop()
	if buf.Len() == 0 {
		t.Fatal("captured trace is empty")
	}
	return bytes.NewReader(buf.Bytes())
}

// scenarioSendRecv: two goroutines rendezvous on an unbuffered channel. One
// side always blocks until the other arrives, guaranteeing a chan block and an
// unblock edge between the two goroutines.
func scenarioSendRecv() {
	ch := make(chan int)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); ch <- 42 }()
	go func() { defer wg.Done(); <-ch }()
	wg.Wait()
}
