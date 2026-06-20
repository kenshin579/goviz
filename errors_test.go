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
