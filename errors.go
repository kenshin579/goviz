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
