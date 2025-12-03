#!/bin/bash
# Start the backend server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Set FFmpeg library path for macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ -d "/opt/homebrew/opt/ffmpeg/lib" ]; then
        export DYLD_LIBRARY_PATH="/opt/homebrew/opt/ffmpeg/lib"
    elif [ -d "/usr/local/opt/ffmpeg/lib" ]; then
        export DYLD_LIBRARY_PATH="/usr/local/opt/ffmpeg/lib"
    fi
fi

if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Please install it first:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "Installing dependencies..."
    uv sync
fi

echo "Starting backend server on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""
cd src/backend && uv run python main.py
