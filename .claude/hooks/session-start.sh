#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "Installing backend Python dependencies..."
pip install -r "$CLAUDE_PROJECT_DIR/backend/requirements.txt"

echo "Installing frontend npm dependencies..."
cd "$CLAUDE_PROJECT_DIR/frontend" && npm install

echo "Session setup complete."
