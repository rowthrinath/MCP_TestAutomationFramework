#!/bin/bash

# Script to run tests and automatically generate/launch LivingDoc report

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "🧪 Running tests..."
echo ""

# Run tests with LivingDoc plugin
dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=TestResults/results.trx" "$@"

echo ""
echo "✅ Tests completed. Generating LivingDoc report..."
echo ""

# Generate and launch LivingDoc
"$SCRIPT_DIR/generate-livingdoc.sh"

