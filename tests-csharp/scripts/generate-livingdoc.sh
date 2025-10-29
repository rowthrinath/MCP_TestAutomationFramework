#!/bin/bash

# Script to generate and launch LivingDoc report after tests complete

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Generating LivingDoc report...${NC}"

# Paths
BIN_DIR="$PROJECT_DIR/bin/Debug/net9.0"
TEST_ASSEMBLY="$BIN_DIR/Tests.CSharp.dll"
OUTPUT_DIR="$PROJECT_DIR/TestResults"
LIVINGDOC_FILE="$OUTPUT_DIR/LivingDoc.html"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if test execution file exists
TEST_EXECUTION_JSON="$BIN_DIR/TestExecution.json"
if [ ! -f "$TEST_EXECUTION_JSON" ]; then
    echo -e "${YELLOW}⚠️  TestExecution.json not found. Running tests first...${NC}"
    dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=$OUTPUT_DIR/results.trx"
fi

# Check if LivingDoc CLI is installed
if ! command -v livingdoc &> /dev/null; then
    echo -e "${YELLOW}📦 Installing LivingDoc CLI tool...${NC}"
    dotnet tool install --global SpecFlow.Plus.LivingDoc.CLI --version 3.9.57 || {
        echo -e "${YELLOW}⚠️  Global installation failed. Trying local installation...${NC}"
        dotnet tool install SpecFlow.Plus.LivingDoc.CLI --tool-path "$PROJECT_DIR/.tools" --version 3.9.57
        export PATH="$PROJECT_DIR/.tools:$PATH"
    }
fi

# Generate LivingDoc report with screenshots support
echo -e "${BLUE}Generating LivingDoc from test assembly...${NC}"
SCREENSHOTS_DIR="$OUTPUT_DIR/Screenshots"

if command -v livingdoc &> /dev/null; then
    # Include screenshots directory if it exists
    if [ -d "$SCREENSHOTS_DIR" ]; then
        echo -e "${BLUE}Including screenshots from $SCREENSHOTS_DIR...${NC}"
        livingdoc test-assembly "$TEST_ASSEMBLY" \
            -t "$TEST_EXECUTION_JSON" \
            -o "$LIVINGDOC_FILE" \
            --attachments "$SCREENSHOTS_DIR" || {
            echo -e "${YELLOW}⚠️  LivingDoc generation with attachments failed. Trying without attachments...${NC}"
            livingdoc test-assembly "$TEST_ASSEMBLY" \
                -t "$TEST_EXECUTION_JSON" \
                -o "$LIVINGDOC_FILE" || {
                echo -e "${YELLOW}⚠️  LivingDoc generation failed. Trying alternative method...${NC}"
                livingdoc test-assembly "$TEST_ASSEMBLY" --output "$OUTPUT_DIR" || {
                    echo -e "${YELLOW}⚠️  Could not generate LivingDoc report.${NC}"
                    echo "Make sure you have SpecFlow+ LivingDoc installed or use the open-source LivingDoc CLI."
                    exit 0
                }
                LIVINGDOC_FILE="$OUTPUT_DIR/LivingDoc.html"
            }
        }
    else
        livingdoc test-assembly "$TEST_ASSEMBLY" \
            -t "$TEST_EXECUTION_JSON" \
            -o "$LIVINGDOC_FILE" || {
            echo -e "${YELLOW}⚠️  LivingDoc generation failed. Trying alternative method...${NC}"
            livingdoc test-assembly "$TEST_ASSEMBLY" --output "$OUTPUT_DIR" || {
                echo -e "${YELLOW}⚠️  Could not generate LivingDoc report.${NC}"
                echo "Make sure you have SpecFlow+ LivingDoc installed or use the open-source LivingDoc CLI."
                exit 0
            }
            LIVINGDOC_FILE="$OUTPUT_DIR/LivingDoc.html"
        }
    fi
else
    echo -e "${YELLOW}⚠️  LivingDoc CLI not found. Please install it:${NC}"
    echo "  dotnet tool install --global SpecFlow.Plus.LivingDoc.CLI"
    exit 1
fi

# Check if report was generated
if [ -f "$LIVINGDOC_FILE" ]; then
    echo -e "${GREEN}✅ LivingDoc report generated successfully!${NC}"
    echo -e "${BLUE}📄 Report location: $LIVINGDOC_FILE${NC}"
    echo ""
    
    # Open the report in default browser
    echo -e "${BLUE}🌐 Opening LivingDoc report...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "$LIVINGDOC_FILE"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        xdg-open "$LIVINGDOC_FILE" || sensible-browser "$LIVINGDOC_FILE" || firefox "$LIVINGDOC_FILE" || echo "Please open $LIVINGDOC_FILE manually"
    else
        echo "Please open $LIVINGDOC_FILE in your browser"
    fi
else
    echo -e "${YELLOW}⚠️  LivingDoc report file not found at expected location.${NC}"
    exit 1
fi

