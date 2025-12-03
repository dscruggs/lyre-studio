#!/bin/bash
# Start the frontend development server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/src/frontend"

if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed. Please install it first:"
    echo "  https://bun.sh/"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    bun install
fi

echo "Starting frontend development server"
echo "The app will be available at http://localhost:5173"
echo "Press Ctrl+C to stop"
echo ""
bun run dev
