#!/usr/bin/env bash
# Jarvis — Launch Session (macOS)

DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$DIR/config.json"

cfg() { python3 -c "import json,sys; v=json.load(open(sys.argv[1])).get(sys.argv[2],''); print('\n'.join(v) if isinstance(v,list) else v)" "$CONFIG" "$1"; }

SPOTIFY_URI="$(cfg spotify_track)"
BROWSER_URL="$(cfg browser_url)"

# 1. Start the server in a new Terminal window
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR' && source .venv/bin/activate 2>/dev/null; python3 server.py\""

# 2. Optional Spotify song and extra apps (leave blank in config.json to skip)
[ -n "$SPOTIFY_URI" ] && open "$SPOTIFY_URI"
while IFS= read -r app; do
  [ -n "$app" ] && open "$app"
done <<< "$(cfg apps)"

# 3. Chrome with Jarvis (give the server a moment to start)
sleep 3
open -na "Google Chrome" --args --autoplay-policy=no-user-gesture-required http://localhost:8340 $BROWSER_URL
