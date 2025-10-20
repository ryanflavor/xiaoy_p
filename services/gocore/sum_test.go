package gocore

import "testing"

func TestSum(t *testing.T) {
    if got := Sum(1, 2); got != 3 {
        t.Fatalf("expected 3, got %d", got)
    }
}

