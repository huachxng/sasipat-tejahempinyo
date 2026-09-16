#!/bin/zsh
# Double-click to preview the site on this Mac with drafts visible (red DRAFT ribbon). Close this window to stop.
cd "$(dirname "$0")/.." || { echo "Could not find the site folder."; read -k1 -s; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" && nvm use --silent >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (version 24) and try again."
  echo "Press any key to close."; read -k1 -s; exit 1
fi

[ -d node_modules ] || { echo "First run: installing…"; npm ci --no-audit --no-fund; }

URL="http://localhost:4321"
echo "Starting the preview at $URL (drafts visible). Close this window to stop."
echo
# Open the browser once the server answers (up to ~60 s), without blocking the server.
( for i in {1..60}; do curl -s -o /dev/null "$URL" && { open "$URL"; exit 0; }; sleep 1; done ) &
npm run dev -- --port 4321
