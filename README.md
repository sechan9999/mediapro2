# Media Hub Pro 🎬

> **Capture, Annotate & Share** — A professional-grade, browser-native screen recorder with AI-powered video pipeline.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What It Does

Media Hub Pro is a fully browser-based screen recording and video editing suite. No installs, no uploads to third-party servers — everything runs locally in the browser using modern Web APIs.

---

## Features

| Feature | Description |
|---|---|
| **Screen Recording** | Capture any tab, window, or full screen via `getDisplayMedia()` |
| **Annotation Tools** | Draw, highlight, and mark up your recording in real time |
| **Audio Mixing** | Independent mic and system audio gain control via Web Audio API |
| **Recording Presets** | 4K Ultra, 1080p HD, 720p, and custom bitrate profiles |
| **Cloud Export** | Opt-in upload to Google Drive, Dropbox, or S3-compatible storage |
| **Collaborative Sharing** | Generate shareable links with one click |
| **Mobile Support** | Adaptive UI for phones and tablets |
| **AI Video Pipeline** | Hyperframes + Whisper + GPT-4o automated scene editing |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Framer Motion |
| Video Processing | FFmpeg.wasm (in-browser) |
| Screen Capture | MediaRecorder API, `getDisplayMedia()` |
| Audio | Web Audio API — `AudioContext`, `GainNode` |
| TTS / Narration | Kokoro-82M (kokoro-onnx), `af_heart` voice |
| Video Composition | Hyperframes (HeyGen open-source), GSAP 3 |
| AI Pipeline | OpenAI Whisper (transcription), GPT-4o (scene planning) |

---

## Project Structure

```
mediapro-video-audio/
├── src/
│   └── App.tsx              # Main React app — all 6 features
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
│
├── mediapro-video/          # Hyperframes 3-min intro composition
│   ├── compositions/
│   │   └── mediapro-intro/
│   │       └── index.html   # 9-scene 180s Hyperframes composition
│   ├── assets/
│   │   └── narration.wav    # TTS audio (run generate-audio.ps1)
│   ├── narration.txt        # Full 180s narration script
│   ├── generate-audio.ps1   # Local TTS generator (Kokoro-82M)
│   └── hyperframes.config.json
│
└── hyperframe-demo/         # AI auto-edit pipeline
    ├── scripts/
    │   ├── auto-edit.js     # Master orchestrator
    │   ├── transcribe.js    # Whisper transcription
    │   ├── scene-plan.js    # GPT-4o scene analysis
    │   └── compose.js       # Hyperframes composition generator
    ├── package.json
    └── .env.example
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Build for production

```bash
npm run build
```

---

## AI Video Pipeline

### Generate narration audio (local TTS)

```powershell
cd mediapro-video
.\generate-audio.ps1
```

This installs `kokoro-onnx`, generates `assets/narration.wav` using the `af_heart` voice, and re-renders the final video to `renders/mediapro-intro.mp4`.

### Run the auto-edit pipeline

```bash
cd hyperframe-demo
cp .env.example .env   # add your OPENAI_API_KEY
npm install
node scripts/auto-edit.js path/to/your-video.mp4
```

Pipeline steps: transcribe → scene-plan → compose → render

---

## Environment Variables

Copy `.env.example` to `.env` in the `hyperframe-demo/` folder:

```
OPENAI_API_KEY=sk-...          # Whisper + GPT-4o
ANTHROPIC_API_KEY=sk-ant-...   # Optional Claude fallback
OUTPUT_FORMAT=mp4
OUTPUT_RESOLUTION=1920x1080
OUTPUT_FPS=30
```

---

## Privacy & Security

- All recording and processing happens **100% in your browser**
- No video data is sent to any server unless you explicitly use Cloud Export
- Cloud Export is **opt-in only** — disabled by default
- No analytics, no tracking

---

## Roadmap

- [ ] Real-time collaborative annotation (WebRTC)
- [ ] AI-powered auto-captions (Whisper in-browser)
- [ ] Chapter markers and timeline editor
- [ ] Browser extension for one-click capture

---

## License

MIT © 2026 sechan9999
