#!/bin/bash

# Smart Playwright Report Script
# Automatically handles port conflicts and cleanup

PORT=9323
ALT_PORT=9324

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "Killing process $pid on port $port..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Function to check if port is available
check_port() {
    local port=$1
    ! lsof -ti:$port >/dev/null 2>&1
}

# Main logic
echo "Starting Playwright HTML Report..."

# Try primary port first
if check_port $PORT; then
    echo "Using port $PORT"
    playwright show-report --port $PORT
else
    echo "Port $PORT is busy, trying to kill existing process..."
    kill_port $PORT
    
    if check_port $PORT; then
        echo "Port $PORT is now available"
        playwright show-report --port $PORT
    else
        echo "Port $PORT still busy, using alternative port $ALT_PORT"
        kill_port $ALT_PORT
        playwright show-report --port $ALT_PORT
    fi
fi
