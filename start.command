#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

HOST="127.0.0.1"
PORT="${SERIALFLASH_PORT:-8080}"

while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://${HOST}:${PORT}/index.html"

echo "Starting SerialFlash"
echo "Project: $(pwd)"
echo "URL: ${URL}"
echo
echo "Keep this window open while using the web app."
echo "Press Control-C to stop the server."
echo

open "$URL"
python3 -m http.server "$PORT" --bind "$HOST"
