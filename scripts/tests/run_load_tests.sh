#!/bin/bash
# Runs repeatable Locust load-test scenarios against the deployed Tuxy stack.
# Usage: ./scripts/tests/run_load_tests.sh [HOST]

set -e
set -o pipefail

HOST="${1:-https://tuxy.pt}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$ROOT_DIR/load-test-results/$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

echo "Tuxy load tests"
echo "Host: $HOST"
echo "Results: $RESULTS_DIR"
echo ""

echo "Checking API health..."
if ! curl -k -L -s -o /dev/null -w "%{http_code}" "$HOST/api/check/" | grep -q "200"; then
    echo "ERROR: $HOST/api/check/ is not returning HTTP 200."
    exit 1
fi
echo "API health OK."
echo ""

run_scenario() {
    local name="$1"
    local users="$2"
    local spawn_rate="$3"
    local duration="$4"

    echo "Running scenario '$name': users=$users spawn_rate=$spawn_rate duration=$duration"
    python3 -m locust \
        -f "$SCRIPT_DIR/load_tests.py" \
        --host "$HOST" \
        --headless \
        -u "$users" \
        -r "$spawn_rate" \
        -t "$duration" \
        --print-stats
    echo ""
}

run_scenario "01_50_users" 50 5 "40s"

