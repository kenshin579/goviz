package causality

import (
	"testing"

	"github.com/kenshin579/trace-go/internal/model"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		reason string
		want   model.EdgeCategory
	}{
		{"chan send", model.CategoryChannel},
		{"chan receive", model.CategoryChannel},
		{"sync.Mutex.Lock", model.CategoryMutex},
		{"sync.WaitGroup.Wait", model.CategoryMutex},
		{"semacquire", model.CategoryMutex},
		{"select", model.CategoryOther},
		{"", model.CategoryOther},
		{"GC mark assist wait", model.CategoryOther},
	}
	for _, c := range cases {
		if got := Classify(c.reason); got != c.want {
			t.Errorf("Classify(%q) = %q, want %q", c.reason, got, c.want)
		}
	}
}
