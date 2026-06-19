// Package causality infers the synchronization mechanism behind a goroutine
// unblock from the block reason string reported by the trace.
package causality

import (
	"strings"

	"github.com/kenshin579/trace-go/internal/model"
)

// Classify maps a goroutine's block reason to an edge category. The matching is
// substring-based and case-insensitive because reason strings vary across Go
// versions (e.g. "chan receive", "chan send", "sync.Mutex.Lock", "semacquire").
func Classify(reason string) model.EdgeCategory {
	r := strings.ToLower(reason)
	switch {
	case strings.Contains(r, "chan"):
		return model.CategoryChannel
	case strings.Contains(r, "sync"),
		strings.Contains(r, "mutex"),
		strings.Contains(r, "sema"),
		strings.Contains(r, "waitgroup"):
		return model.CategoryMutex
	default:
		return model.CategoryOther
	}
}
