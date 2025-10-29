#!/bin/bash

# Script to run SpecFlow tests in parallel across multiple browsers
# Similar to Playwright's project-based parallel execution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "🚀 Running tests in parallel across browsers..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests for a specific browser
run_browser_tests() {
    local browser=$1
    local browser_name=$2
    
    echo -e "${BLUE}Starting tests for ${browser_name}...${NC}"
    
    BROWSER=$browser HEADLESS=true dotnet test Tests.CSharp.csproj \
        --logger "console;verbosity=minimal" \
        --logger "trx;LogFileName=test-results-${browser}.trx" \
        -- NUnit.NumberOfTestWorkers=1 \
        > "test-output-${browser}.log" 2>&1 &
    
    echo $!
}

# Array to store PIDs
pids=()

# Run tests for each browser in parallel
echo -e "${GREEN}📱 Desktop Browsers:${NC}"
pids+=($(run_browser_tests "chromium" "Chromium"))
pids+=($(run_browser_tests "firefox" "Firefox"))
pids+=($(run_browser_tests "webkit" "WebKit"))

echo ""
echo -e "${YELLOW}⏳ Waiting for all browser tests to complete...${NC}"
echo ""

# Wait for all background processes
failed=0
for pid in "${pids[@]}"; do
    if wait $pid; then
        echo -e "${GREEN}✓ Process $pid completed successfully${NC}"
    else
        echo -e "${RED}✗ Process $pid failed${NC}"
        failed=1
    fi
done

echo ""
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All browser tests completed successfully!${NC}"
    echo ""
    echo "Test results are available in:"
    echo "  - test-results-chromium.trx"
    echo "  - test-results-firefox.trx"
    echo "  - test-results-webkit.trx"
else
    echo -e "${RED}❌ Some browser tests failed. Check logs:${NC}"
    echo "  - test-output-chromium.log"
    echo "  - test-output-firefox.log"
    echo "  - test-output-webkit.log"
    exit 1
fi

