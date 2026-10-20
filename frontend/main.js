// Jarvis V2 — Frontend
const orb = document.getElementById('orb');
const status = document.getElementById('status');
const transcript = document.getElementById('transcript');

let ws;
let audioQueue = [];
let isPlaying = false;
let audioUnlocked = false;
let currentAudio = null;
let currentUrl = null;
// After a pause, drop leftover replies until the user speaks again
let muted = false;

// Saying one of these while Jarvis talks cuts him off
const STOP_WORDS = /\b(pause|stop|shut up|be quiet)\b/i;

// Throw away what the mic heard while Jarvis was talking (his own voice);
// onend restarts listening with a clean slate
function discardHeard() {
    if (recognition && isListening) recognition.abort();
}

// Unlock audio on ANY user interaction
function unlockAudio() {
    if (!audioUnlocked) {
        const silent = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNIGPkAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNIGPkAAAAAAAAAAAAAAAAAAAA');
        silent.play().then(() => {
            audioUnlocked = true;
            console.log('[jarvis] Audio unlocked');
        }).catch(() => {});
    }
}
document.addEventListener('click', unlockAudio, { once: false });
document.addEventListener('touchstart', unlockAudio, { once: false });
document.addEventListener('keydown', unlockAudio, { once: false });

function connect() {
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => {
        console.log('[jarvis] WebSocket connected');
        status.textContent = 'Click anywhere once, then Jarvis will speak.';
        setOrbState('thinking');
        ws.send(JSON.stringify({ text: 'Jarvis activate' }));
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'response') {
            addTranscript('jarvis', data.text);
            if (muted) return;
            if (data.audio && data.audio.length > 0) {
                queueAudio(data.audio);
            } else {
                setOrbState('idle');
                setTimeout(startListening, 500);
            }
        } else if (data.type === 'status') {
            status.textContent = data.text;
        }
    };
    ws.onclose = () => {
        status.textContent = 'Connection lost...';
        setTimeout(connect, 3000);
    };
}

function queueAudio(base64Audio) {
    audioQueue.push(base64Audio);
    if (!isPlaying) playNext();
}

function playNext() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        discardHeard();
        setOrbState('listening');
        status.textContent = '';
        setTimeout(startListening, 500);
        return;
    }
    isPlaying = true;
    setOrbState('speaking');
    status.textContent = 'Say "pause" or press space to stop';
    // Keep the mic on while speaking so "pause" can be heard
    startListening();

    const b64 = audioQueue.shift();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;
    audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; playNext(); };
    audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; playNext(); };
    audio.play().catch(err => {
        console.warn('[jarvis] Autoplay blocked, waiting for click...');
        status.textContent = 'Click anywhere so Jarvis can speak.';
        setOrbState('idle');
        // Wait for click then retry
        document.addEventListener('click', function retry() {
            document.removeEventListener('click', retry);
            audio.play().then(() => {
                setOrbState('speaking');
                status.textContent = '';
            }).catch(() => playNext());
        });
    });
}

function stopSpeaking() {
    if (!isPlaying) return;
    muted = true;
    audioQueue = [];
    if (currentAudio) {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.pause();
        URL.revokeObjectURL(currentUrl);
        currentAudio = null;
    }
    isPlaying = false;
    discardHeard();
    setTimeout(startListening, 300);
    setOrbState('listening');
    status.textContent = 'Paused. Go ahead.';
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    // Interim results let "pause" cut in mid-word instead of after a silence
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const text = last[0].transcript.trim();
        if (!text) return;

        if (isPlaying) {
            // While Jarvis talks, only listen for stop words; anything else
            // is most likely his own voice coming back through the mic
            if (STOP_WORDS.test(text)) stopSpeaking();
            return;
        }
        if (!last.isFinal) return;

        // The tail end of a "pause" command, not a question for Jarvis
        if (text.split(/\s+/).length <= 2 && STOP_WORDS.test(text)) return;

        muted = false;
        addTranscript('user', text);
        setOrbState('thinking');
        status.textContent = 'Jarvis is thinking...';
        ws.send(JSON.stringify({ text }));
    };

    recognition.onend = () => {
        isListening = false;
        setTimeout(startListening, 300);
    };

    recognition.onerror = (event) => {
        isListening = false;
        if (event.error === 'no-speech' || event.error === 'aborted') {
            setTimeout(startListening, 300);
        } else {
            setTimeout(startListening, 1000);
        }
    };
}

function startListening() {
    if (!recognition || isListening) return;
    try {
        recognition.start();
        isListening = true;
        if (!isPlaying) {
            setOrbState('listening');
            status.textContent = '';
        }
    } catch(e) {}
}

// Space bar also stops Jarvis mid-sentence
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isPlaying) {
        e.preventDefault();
        stopSpeaking();
    }
});

orb.addEventListener('click', () => {
    if (isPlaying) { stopSpeaking(); return; }
    if (isListening) {
        recognition.stop();
        isListening = false;
        setOrbState('idle');
        status.textContent = 'Paused. Click to resume.';
    } else {
        startListening();
    }
});

function setOrbState(state) { orb.className = state; }

function addTranscript(role, text) {
    const div = document.createElement('div');
    div.className = role;
    div.textContent = role === 'user' ? `You: ${text}` : `Jarvis: ${text}`;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
}

connect();
