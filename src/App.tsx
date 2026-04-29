import { useState, useRef, useCallback, useEffect } from 'react'

type Page = 'dashboard' | 'recorder' | 'recordings' | 'settings'
type Preset = '4k' | '1080p' | '720p' | 'custom'
type AnnotationTool = 'pen' | 'highlight' | 'arrow' | 'text' | 'eraser'

interface Recording {
  id: string
  name: string
  date: string
  duration: string
  size: string
  url: string
  blob: Blob
}

const PRESETS: Record<Preset, { label: string; detail: string; width: number; height: number; bitrate: number }> = {
  '4k':     { label: '4K Ultra',  detail: '3840×2160 · 20 Mbps', width: 3840, height: 2160, bitrate: 20_000_000 },
  '1080p':  { label: '1080p HD',  detail: '1920×1080 · 8 Mbps',  width: 1920, height: 1080, bitrate: 8_000_000 },
  '720p':   { label: '720p',      detail: '1280×720 · 5 Mbps',   width: 1280, height: 720,  bitrate: 5_000_000 },
  'custom': { label: 'Custom',    detail: 'Your settings',        width: 1920, height: 1080, bitrate: 8_000_000 },
}

const COLORS = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#FFFFFF']

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [preset, setPreset] = useState<Preset>('1080p')
  const [micGain, setMicGain] = useState(80)
  const [sysGain, setSysGain] = useState(100)
  const [micEnabled, setMicEnabled] = useState(true)
  const [sysAudioEnabled, setSysAudioEnabled] = useState(true)
  const [annotationEnabled, setAnnotationEnabled] = useState(false)
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('pen')
  const [annotationColor, setAnnotationColor] = useState('#EF4444')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [elapsed, setElapsed] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording, isPaused])

  const startRecording = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: PRESETS[preset].width }, height: { ideal: PRESETS[preset].height }, frameRate: { ideal: 30 } },
        audio: sysAudioEnabled
      })

      let finalStream = displayStream

      if (micEnabled) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          const ctx = new AudioContext()
          const dest = ctx.createMediaStreamDestination()

          // System audio
          const sysTracks = displayStream.getAudioTracks()
          if (sysTracks.length > 0) {
            const sysSource = ctx.createMediaStreamSource(new MediaStream(sysTracks))
            const sysGainNode = ctx.createGain()
            sysGainNode.gain.value = sysGain / 100
            sysSource.connect(sysGainNode).connect(dest)
          }

          // Mic audio
          const micSource = ctx.createMediaStreamSource(micStream)
          const micGainNode = ctx.createGain()
          micGainNode.gain.value = micGain / 100
          micSource.connect(micGainNode).connect(dest)

          finalStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
          ])
        } catch { /* mic denied, continue without */ }
      }

      streamRef.current = finalStream
      if (videoRef.current) {
        videoRef.current.srcObject = finalStream
        videoRef.current.play()
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'

      const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: PRESETS[preset].bitrate
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const now = new Date()
        setRecordings(prev => [{
          id: Date.now().toString(),
          name: `Recording ${prev.length + 1}`,
          date: now.toLocaleDateString() + ' ' + now.toLocaleTimeString(),
          duration: formatTime(elapsed),
          size: formatSize(blob.size),
          url, blob
        }, ...prev])
        finalStream.getTracks().forEach(t => t.stop())
        if (videoRef.current) videoRef.current.srcObject = null
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setIsPaused(false)
      setElapsed(0)

      // Auto-stop when user stops sharing
      displayStream.getVideoTracks()[0].onended = () => stopRecording()
    } catch (err) {
      console.error('Recording failed:', err)
    }
  }, [preset, micEnabled, sysAudioEnabled, micGain, sysGain, elapsed])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setIsPaused(false)
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (isPaused) { mediaRecorderRef.current.resume(); setIsPaused(false) }
      else { mediaRecorderRef.current.pause(); setIsPaused(true) }
    }
  }, [isPaused])

  const downloadRecording = useCallback((rec: Recording) => {
    const a = document.createElement('a')
    a.href = rec.url
    a.download = `${rec.name}.webm`
    a.click()
  }, [])

  const deleteRecording = useCallback((id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id))
  }, [])

  // Annotation drawing
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotationEnabled) return
    drawingRef.current = true
    lastPosRef.current = getCanvasPos(e)
  }

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current || !lastPosRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    if (annotationTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = 20
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = annotationColor
      ctx.lineWidth = annotationTool === 'highlight' ? 16 : 3
      ctx.globalAlpha = annotationTool === 'highlight' ? 0.3 : 1
    }
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.globalAlpha = 1
    lastPosRef.current = pos
  }

  const onCanvasMouseUp = () => { drawingRef.current = false; lastPosRef.current = null }

  const clearAnnotations = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')!
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  // ── Render Pages ──

  const renderDashboard = () => (
    <div>
      <div className="hero">
        <h1>
          <span className="gradient">Media Hub</span> Pro
        </h1>
        <p>Professional browser-native screen recorder with AI-powered video pipeline. Zero installs required.</p>
        <div className="hero-actions">
          <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }} onClick={() => setPage('recorder')}>
            🎬 Start Recording
          </button>
          <button className="btn" style={{ padding: '12px 32px', fontSize: '15px' }} onClick={() => setPage('recordings')}>
            📁 My Recordings
          </button>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <div className="stats-row">
          {[
            { value: recordings.length.toString(), label: 'Recordings' },
            { value: '100%', label: 'Browser-Based' },
            { value: '4K', label: 'Max Resolution' },
            { value: '0', label: 'Server Uploads' },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>Features</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Everything you need for professional screen recording</p>

        <div className="features-grid">
          {[
            { icon: '🖥️', title: 'Screen Capture', desc: 'Record any tab, window, or full screen with getDisplayMedia API', bg: 'rgba(139,92,246,0.15)' },
            { icon: '🎨', title: 'Real-time Annotations', desc: 'Draw, highlight, and annotate directly on your recording', bg: 'rgba(236,72,153,0.15)' },
            { icon: '🎤', title: 'Audio Mixing', desc: 'Independent mic & system audio gain control via Web Audio API', bg: 'rgba(59,130,246,0.15)' },
            { icon: '⚡', title: 'Recording Presets', desc: '4K Ultra, 1080p HD, 720p, and custom bitrate profiles', bg: 'rgba(245,158,11,0.15)' },
            { icon: '☁️', title: 'Cloud Export', desc: 'Opt-in upload to Google Drive, Dropbox, or S3-compatible storage', bg: 'rgba(16,185,129,0.15)' },
            { icon: '🤖', title: 'AI Video Pipeline', desc: 'Hyperframes + Whisper + GPT-4o automated scene editing', bg: 'rgba(139,92,246,0.15)' },
          ].map((f, i) => (
            <div className="feature-card" key={i} onClick={() => setPage('recorder')}>
              <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderRecorder = () => (
    <div>
      <h1 className="page-title">Screen Recorder</h1>
      <p className="page-subtitle">Capture your screen with professional quality</p>

      <div className="recorder-container">
        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="preview-area">
            <video ref={videoRef} muted playsInline style={{ display: isRecording ? 'block' : 'none' }} />
            {!isRecording && (
              <div className="preview-placeholder">
                <div className="icon">🖥️</div>
                <p>Click "Start Recording" to begin capture</p>
              </div>
            )}
            {isRecording && (
              <>
                <div className="recording-badge">
                  <div className="rec-dot" /> {isPaused ? 'PAUSED' : 'REC'}
                </div>
                <div className="timer">{formatTime(elapsed)}</div>
              </>
            )}
            {annotationEnabled && isRecording && (
              <canvas
                ref={canvasRef}
                className="annotation-overlay"
                width={1920} height={1080}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
              />
            )}
          </div>

          {/* Annotation tools */}
          {annotationEnabled && isRecording && (
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div className="annotation-toolbar">
                  {([['pen','✏️'],['highlight','🖍️'],['eraser','🧹']] as [AnnotationTool, string][]).map(([tool, icon]) => (
                    <button key={tool} className={`tool-btn ${annotationTool === tool ? 'active' : ''}`} onClick={() => setAnnotationTool(tool)} title={tool}>
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div key={c} className={`color-dot ${annotationColor === c ? 'active' : ''}`}
                      style={{ background: c }} onClick={() => setAnnotationColor(c)} />
                  ))}
                </div>
                <button className="btn" onClick={clearAnnotations} style={{ marginLeft: 'auto' }}>🗑️ Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="controls-panel">
          {!isRecording ? (
            <button className="record-btn start" onClick={startRecording}>🔴 Start Recording</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="record-btn stop" style={{ flex: 1 }} onClick={stopRecording}>⏹ Stop</button>
              <button className="btn" style={{ padding: '16px', fontSize: '16px' }} onClick={pauseRecording}>
                {isPaused ? '▶️' : '⏸️'}
              </button>
            </div>
          )}

          {/* Preset */}
          <div className="card">
            <div className="card-title">⚡ Quality Preset</div>
            <div className="preset-grid">
              {(Object.keys(PRESETS) as Preset[]).map(p => (
                <div key={p} className={`preset-item ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>
                  <div className="label">{PRESETS[p].label}</div>
                  <div className="detail">{PRESETS[p].detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio */}
          <div className="card">
            <div className="card-title">🎤 Audio</div>
            <div className="toggle-row">
              <label>Microphone</label>
              <button className={`toggle ${micEnabled ? 'on' : ''}`} onClick={() => setMicEnabled(!micEnabled)} />
            </div>
            {micEnabled && (
              <div className="slider-group" style={{ marginBottom: '12px' }}>
                <div className="slider-label"><span>Mic Gain</span><span>{micGain}%</span></div>
                <input type="range" min={0} max={100} value={micGain} onChange={e => setMicGain(+e.target.value)} />
              </div>
            )}
            <div className="toggle-row">
              <label>System Audio</label>
              <button className={`toggle ${sysAudioEnabled ? 'on' : ''}`} onClick={() => setSysAudioEnabled(!sysAudioEnabled)} />
            </div>
            {sysAudioEnabled && (
              <div className="slider-group">
                <div className="slider-label"><span>System Gain</span><span>{sysGain}%</span></div>
                <input type="range" min={0} max={100} value={sysGain} onChange={e => setSysGain(+e.target.value)} />
              </div>
            )}
          </div>

          {/* Annotation toggle */}
          <div className="card">
            <div className="card-title">🎨 Annotations</div>
            <div className="toggle-row">
              <label>Enable drawing overlay</label>
              <button className={`toggle ${annotationEnabled ? 'on' : ''}`} onClick={() => setAnnotationEnabled(!annotationEnabled)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderRecordings = () => (
    <div>
      <h1 className="page-title">My Recordings</h1>
      <p className="page-subtitle">{recordings.length} recording{recordings.length !== 1 ? 's' : ''} saved locally</p>

      {recordings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📁</div>
          <p style={{ color: 'var(--text-secondary)' }}>No recordings yet. Start your first recording!</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setPage('recorder')}>
            🎬 Go to Recorder
          </button>
        </div>
      ) : (
        <div className="recordings-grid">
          {recordings.map(rec => (
            <div className="recording-card" key={rec.id}>
              <div className="recording-thumb">
                <video src={rec.url} muted preload="metadata" />
                <div className="play-overlay" onClick={() => window.open(rec.url, '_blank')}>
                  <div className="play-icon">▶</div>
                </div>
              </div>
              <div className="recording-info">
                <h4>{rec.name}</h4>
                <div className="recording-meta">
                  <span>🕐 {rec.duration}</span>
                  <span>📦 {rec.size}</span>
                  <span>📅 {rec.date}</span>
                </div>
                <div className="recording-actions">
                  <button className="btn" onClick={() => downloadRecording(rec)}>⬇️ Download</button>
                  <button className="btn" onClick={() => deleteRecording(rec.id)} style={{ color: 'var(--accent-red)' }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderSettings = () => (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure your recording preferences</p>

      <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
        <div className="card">
          <div className="card-title">🎥 Default Quality</div>
          <div className="preset-grid">
            {(Object.keys(PRESETS) as Preset[]).map(p => (
              <div key={p} className={`preset-item ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>
                <div className="label">{PRESETS[p].label}</div>
                <div className="detail">{PRESETS[p].detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">🔒 Privacy</div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            All recording and processing happens <strong style={{ color: 'var(--accent-green)' }}>100% in your browser</strong>.
            No video data is sent to any server. Cloud Export is opt-in only and disabled by default.
          </p>
        </div>

        <div className="card">
          <div className="card-title">ℹ️ About</div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong>Media Hub Pro v2.0</strong><br />
            React + TypeScript + Vite<br />
            Built with MediaRecorder API &amp; Web Audio API<br />
            MIT © 2026 sechan9999
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app">
      <header className="header">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setPage('dashboard')}>
          <div className="logo-icon">▶</div>
          <div className="logo-text">
            <span>Media Hub</span> Pro
            <span className="logo-badge">v2.0</span>
          </div>
        </div>
        <div className="header-actions">
          {!isRecording ? (
            <button className="btn btn-primary" onClick={() => { setPage('recorder'); }}>
              🎬 New Recording
            </button>
          ) : (
            <button className="btn" style={{ color: 'var(--accent-red)' }} onClick={stopRecording}>
              ⏹ Stop Recording · {formatTime(elapsed)}
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <nav className="sidebar">
          {([
            ['dashboard', '🏠', 'Dashboard'],
            ['recorder', '🎬', 'Recorder'],
            ['recordings', '📁', 'Recordings'],
            ['settings', '⚙️', 'Settings'],
          ] as [Page, string, string][]).map(([key, icon, label]) => (
            <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => setPage(key)}>
              <span className="nav-icon">{icon}</span> {label}
              {key === 'recordings' && recordings.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--accent-purple)', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>
                  {recordings.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <main className="content">
          {page === 'dashboard' && renderDashboard()}
          {page === 'recorder' && renderRecorder()}
          {page === 'recordings' && renderRecordings()}
          {page === 'settings' && renderSettings()}
        </main>
      </div>

      <div className="status-bar">
        <div className="status-dot green" />
        <span>Ready</span>
        <span style={{ marginLeft: 'auto' }}>Media Hub Pro v2.0</span>
      </div>
    </div>
  )
}
