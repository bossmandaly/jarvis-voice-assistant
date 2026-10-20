#!/usr/bin/env bash
# Double-click this file in Finder to start Jarvis and open it in Chrome.
# Keep the Terminal window it opens running; closing it turns Jarvis off.

cd "$(dirname "$0")" || exit 1

# Stop any old Jarvis server still holding the port
pkill -f "python3 server.py" 2>/dev/null
sleep 1

git pull --quiet 2>/dev/null
source .venv/bin/activate

# Open Chrome once the server answers
(
  for _ in $(seq 1 30); do
    curl -s -o /dev/null http://localhost:8340 && break
    sleep 1
  done
  open -a "Google Chrome" http://localhost:8340
) &

python3 server.py
