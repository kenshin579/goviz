package model

import (
	"encoding/json"
	"testing"
)

func TestTaskJSON(t *testing.T) {
	sum := TraceSummary{
		Tasks: []Task{{ID: 5, Parent: 1, Name: "request", Start: 10, End: 90}},
		Goroutines: []Goroutine{{ID: 1, Regions: []Region{{Name: "r", Task: 5}}}},
		Logs:       []Log{{Time: 20, GoID: 1, Category: "c", Message: "m", Task: 5}},
	}
	b, err := json.Marshal(sum)
	if err != nil {
		t.Fatal(err)
	}
	var out TraceSummary
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out.Tasks[0].Name != "request" || out.Tasks[0].Parent != 1 {
		t.Fatalf("task round trip: %+v", out.Tasks)
	}
	if out.Goroutines[0].Regions[0].Task != 5 || out.Logs[0].Task != 5 {
		t.Fatalf("task id link lost: %+v / %+v", out.Goroutines[0].Regions, out.Logs)
	}
}

func TestRegionAndLogJSON(t *testing.T) {
	sum := TraceSummary{
		Goroutines: []Goroutine{{
			ID:      1,
			Regions: []Region{{Start: 10, End: 50, Name: "db-query", Depth: 1}},
		}},
		Logs: []Log{{Time: 20, GoID: 1, Category: "cache", Message: "miss"}},
	}
	b, err := json.Marshal(sum)
	if err != nil {
		t.Fatal(err)
	}
	var out TraceSummary
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out.Goroutines[0].Regions[0].Name != "db-query" || out.Goroutines[0].Regions[0].Depth != 1 {
		t.Fatalf("region round trip lost data: %+v", out.Goroutines[0].Regions)
	}
	if out.Logs[0].Category != "cache" || out.Logs[0].Message != "miss" {
		t.Fatalf("log round trip lost data: %+v", out.Logs)
	}
}

func TestIntervalDuration(t *testing.T) {
	iv := Interval{Start: 100, End: 250, State: StateRunning}
	if got := iv.Duration(); got != 150 {
		t.Fatalf("Duration() = %d, want 150", got)
	}
}

func TestTraceSummaryJSONRoundTrip(t *testing.T) {
	in := TraceSummary{
		StartTime: 10,
		EndTime:   90,
		Goroutines: []Goroutine{{
			ID:        1,
			Name:      "main.worker",
			CreatedAt: 10,
			EndedAt:   90,
			Intervals: []Interval{{Start: 10, End: 50, State: StateBlocked, BlockReason: "chan receive"}},
		}},
		Edges: []CausalEdge{{From: 2, To: 1, Time: 50, Category: CategoryChannel}},
	}
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	var out TraceSummary
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out.Goroutines[0].Intervals[0].BlockReason != "chan receive" {
		t.Fatalf("round trip lost BlockReason: %+v", out)
	}
	if out.Edges[0].Category != CategoryChannel {
		t.Fatalf("round trip lost Category: %+v", out)
	}
}
