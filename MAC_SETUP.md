# Jarvis on a Mac

## 1. Install Python and Chrome

- Python: download from https://www.python.org/downloads/ and run the installer.
- Chrome: https://google.com/chrome

## 2. Download Jarvis and install everything

Open the **Terminal** app and paste this, replacing `YOUR_GITHUB_NAME`:

```
git clone -b mac-support https://github.com/YOUR_GITHUB_NAME/jarvis-voice-assistant.git ~/jarvis
cd ~/jarvis
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp config.mac.example.json config.json
open -e config.json
```

If your Mac asks to install "command line developer tools", click Install, then paste the commands again.

## 3. Fill in config.json

The last command opens `config.json` in TextEdit. Replace:

- `PASTE_YOUR_ANTHROPIC_KEY_HERE`: from https://console.anthropic.com (add a little credit)
- `PASTE_YOUR_ELEVENLABS_KEY_HERE`: from https://elevenlabs.io, under your profile → API Keys
- `YOUR_FIRST_NAME` and `YOUR_CITY` (for the weather)

The voice is set to "George", a British ElevenLabs voice. To use a different one, copy its Voice ID from the ElevenLabs voice library into `elevenlabs_voice_id`.

Use `"units": "metric"` for Celsius. Save and close.

## 4. Start Jarvis

```
cd ~/jarvis
source .venv/bin/activate
python3 server.py
```

Open http://localhost:8340 in **Chrome** (Safari's voice input won't work), click once, and allow the microphone. Jarvis greets you, then just talk.

To ask about your screen, allow **Screen Recording** for Terminal: System Settings → Privacy & Security → Screen Recording.

## 5. Optional: start with a double clap

```
cd ~/jarvis
source .venv/bin/activate
python3 scripts/clap-trigger.py
```

Allow the microphone for Terminal when asked. Clap twice and Jarvis opens in Chrome. If claps aren't picked up, lower `THRESHOLD` in `scripts/clap-trigger.py` (for example to `0.08`).

## If something breaks

Copy the error from Terminal and paste it to Claude.

| Problem | Fix |
|---|---|
| Jarvis doesn't talk | Click the page once (Chrome blocks sound until you do) |
| "Connection lost" | The server stopped. Run step 4 again |
| `address already in use` | An old server is still running: `pkill -f server.py`, then step 4 |
| Search doesn't open a browser | `playwright install chromium` |
