#!/bin/zsh
# Double-click to check the vault before you push. Prints every problem with the file and the fix.
cd "$(dirname "$0")/.." || { echo "Could not find the site folder."; read -k1 -s; exit 1; }

# Node: prefer whatever is on PATH; otherwise load nvm (Node 24 is pinned in .nvmrc).
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" && nvm use --silent >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (version 24) and try again."
  echo "Press any key to close."; read -k1 -s; exit 1
fi

[ -d node_modules ] || { echo "First run: installing…"; npm ci --no-audit --no-fund; }

echo "Checking content in $(pwd)/content …"
echo
npm run --silent content:check
status=$?
echo
if [ $status -eq 0 ]; then
  echo "All good — ready to commit and push in GitHub Desktop."
else
  echo "Fix the items above in Obsidian, then run this again."
fi
echo
echo "Press any key to close."
read -k1 -s
exit $status
