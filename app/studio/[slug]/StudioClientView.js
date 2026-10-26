'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { usePlayer } from '../../../context/PlayerContext';
import {
  Mic, Square, Play, Pause, UploadCloud, ArrowLeft, RefreshCw, Sliders,
  CheckCircle2, Disc, Activity, Download, Headphones, AlertTriangle, AlertCircle, X, Lock,
} from 'lucide-react';
import YouTube from 'react-youtube';
import LyricsTheatre from '../../../components/LyricsTheatre';
import { useLanguage } from '../../../context/LanguageContext';
import { transliterateLyrics } from '../../../lib/slugs';
import {
  KaraokeEngine, clamp, formatTime, extForMime, describeMicError, computeWaveformPeaks,
} from '../../../lib/karaokeEngine';

/* ------------------------------------------------------------------ */
/* Constants & small helpers                                          */
/* ------------------------------------------------------------------ */

const CLOUDINARY_CLOUD = 'df6sjkg3j';
const CLOUDINARY_API_KEY = '778989885286777';
const WAVE_BARS = 72;
const SYNC_STORAGE_KEY = 'karaoke.syncOffsetMs';
const TAIL_MS = 500; // extra time after the last note so reverb/delay tails are recorded

const FX_PRESETS = [
  { id: 'studio', label: 'Clear Studio', desc: 'Crisp vocal presence & subtle room clarity', reverb: 15, vocal: 100 },
  { id: 'warm', label: 'Mithila Warmth', desc: 'Rich acoustic harmonics for traditional folk', reverb: 35, vocal: 110 },
  { id: 'concert', label: 'Concert Hall', desc: 'Atmospheric stage reverberation & echo', reverb: 65, vocal: 95 },
  { id: 'raw', label: 'Raw Acoustic', desc: 'Unfiltered authentic voice capture', reverb: 0, vocal: 100 },
];

/**
 * Which lyric line is current at time `t` (seconds)?
 *  1. If the song supplies `lyrics.line_times` (one start time per non-empty line),
 *     use it — this is exact.
 *  2. Otherwise spread the lines evenly across the backing track's duration.
 *  3. With no duration at all (voice-only take), assume ~5s per line.
 */
function lineIndexForTime(t, duration, count, lineTimes) {
  if (count <= 0) return 0;
  if (Array.isArray(lineTimes) && lineTimes.length === count) {
    let idx = 0;
    for (let i = 0; i < count; i++) {
      if (t >= lineTimes[i]) idx = i;
      else break;
    }
    return idx;
  }
  if (duration > 0 && Number.isFinite(duration)) {
    return clamp(Math.floor((t / duration) * count), 0, count - 1);
  }
  return clamp(Math.floor(t / 5), 0, count - 1);
}

function MixSlider({ label, value, onChange, display, min = 0, max = 100, step = 1, disabled = false }) {
  return (
    <div className="fx-slider-container" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span>{display ?? `${value}%`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fx-slider"
        aria-label={label}
      />
    </div>
  );
}

const badge = (bg, color, border) => ({
  fontSize: '0.72rem', padding: '3px 10px', borderRadius: '9999px',
  background: bg, color, border: `1px solid ${border}`, fontWeight: 700,
});

const ghostBtn = {
  padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
  background: 'rgba(255, 255, 255, 0.08)', color: '#FAFAFA', border: '1px solid rgba(255, 255, 255, 0.15)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function StudioClientView({ song }) {
  const { user, isLoaded, openSignIn } = useAuth();
  const { t, formatSongTitle, isEnglish, isMaithiliPlus } = useLanguage();
  const { currentTrack, closePlayer } = usePlayer();

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new KaraokeEngine();
  const engine = engineRef.current;

  // 'idle' | 'countdown' | 'recording' | 'recorded' | 'uploading' | 'success'
  const [recordingState, setRecordingState] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [isPrivateTake, setIsPrivateTake] = useState(Boolean(user?.is_private));
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [takeMixed, setTakeMixed] = useState(false);
  const [takeClipped, setTakeClipped] = useState(false);
  const [graphReady, setGraphReady] = useState(false);

  // Backing track
  const [backingFailed, setBackingFailed] = useState(false);
  const [isBackingPlaying, setIsBackingPlaying] = useState(false);

  // Mic / headphones
  const [headphonesOk, setHeadphonesOk] = useState(false);
  const [echoCancel, setEchoCancel] = useState(false);
  const [monitorVoice, setMonitorVoice] = useState(false);

  // Mix (all adjustable live while recording, except sync offset)
  const [selectedFx, setSelectedFx] = useState('studio');
  const [vocalVolume, setVocalVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(70);
  const [reverbLevel, setReverbLevel] = useState(15);
  const [inputTrim, setInputTrim] = useState(100);
  const [syncOffsetMs, setSyncOffsetMs] = useState(100);

  // Review player
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [reviewTime, setReviewTime] = useState(0);
  const [reviewDuration, setReviewDuration] = useState(0);
  const [peaks, setPeaks] = useState([]);

  // Teleprompter
  const [lineIdx, setLineIdx] = useState(0);
  const [scriptMode, setScriptMode] = useState('devanagari');

  // Source selection: a hosted file can be mixed; YouTube audio cannot be captured.
  const youtubeId = song.youtube?.video_id || song.recordings?.[0]?.youtube?.video_id;
  const backingUrl = song.audio?.hosted_audio_url || song.recordings?.[0]?.audio?.hosted_audio_url || null;
  const canMix = Boolean(backingUrl) && !backingFailed;
  const showYoutube = !canMix && Boolean(youtubeId);

  // Refs
  const backingElRef = useRef(null);
  const reviewAudioRef = useRef(null);
  const playerTargetRef = useRef(null);
  const teleprompterRef = useRef(null);
  const canvasRef = useRef(null);
  const meterBarRef = useRef(null);
  const meterTextRef = useRef(null);
  const clipBadgeRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const finishingRef = useRef(false);
  const clipUntilRef = useRef(0);
  const clippedTakeRef = useRef(false);
  const audioUrlRef = useRef(audioUrl);
  const canMixRef = useRef(canMix);
  const recordingStateRef = useRef(recordingState);
  const syncMsRef = useRef(syncOffsetMs);
  audioUrlRef.current = audioUrl;
  canMixRef.current = canMix;
  recordingStateRef.current = recordingState;
  syncMsRef.current = syncOffsetMs;

  const title = formatSongTitle ? formatSongTitle(song) : (song.title?.canonical || song.title?.devanagari || 'Maithili Geet');
  const singer = song.credits?.singer || (isEnglish ? 'Traditional' : 'पारंपरिक');
  const devanagariText = song.lyrics?.devanagari || song.lyrics?.raw_text || 'बोल उपलब्ध नहि अछि...';
  const romanText = song.lyrics?.roman || transliterateLyrics(devanagariText);
  const lineTimes = song.lyrics?.line_times; // optional: seconds, one per non-empty line

  const lyricsLines = useMemo(
    () => (scriptMode === 'devanagari' ? devanagariText : romanText).split('\n').filter((l) => l.trim().length > 0),
    [scriptMode, devanagariText, romanText]
  );

  const canStart = echoCancel || headphonesOk;

  /* ---------------- Persisted sync offset ---------------- */

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SYNC_STORAGE_KEY));
      if (Number.isFinite(v) && v >= 0 && v <= 500) setSyncOffsetMs(v);
    } catch { /* storage unavailable */ }
  }, []);

  const updateSync = (v) => {
    setSyncOffsetMs(v);
    try { localStorage.setItem(SYNC_STORAGE_KEY, String(v)); } catch { /* ignore */ }
  };

  const autoSync = () => {
    const ms = engine.estimateLatencyMs();
    if (!ms) {
      setErrorMsg('This browser does not report its latency yet. Run a Mic Check first, or adjust the offset by ear.');
      return;
    }
    updateSync(clamp(ms, 0, 500));
  };

  /* ---------------- Audio lifecycle ---------------- */

  // Creates/resumes the context and (once) wraps the <audio> element. Always
  // called from a click handler so the browser allows audio to start.
  const prepareAudio = useCallback(async () => {
    await engine.init();
    setGraphReady(true);
    let mixable = canMixRef.current;
    if (mixable && backingElRef.current) {
      mixable = engine.attachBacking(backingElRef.current);
      if (!mixable) {
        canMixRef.current = false;
        setBackingFailed(true);
      }
    }
    return mixable;
  }, [engine]);

  // Push every slider into the graph.
  useEffect(() => {
    engine.applyMix({
      inputTrim, vocalVolume, musicVolume, reverb: reverbLevel,
      monitorVoice: monitorVoice && !echoCancel, syncMs: syncOffsetMs,
    });
  }, [engine, graphReady, inputTrim, vocalVolume, musicVolume, reverbLevel, monitorVoice, echoCancel, syncOffsetMs]);

  // Reference video volume (voice-only mode)
  useEffect(() => {
    try { playerTargetRef.current?.setVolume(musicVolume); } catch { /* ignore */ }
  }, [musicVolume]);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // Reads canvas/meter refs every frame, so it survives the canvas remounting
  // between the idle (mic check) and recording screens.
  const startMeter = useCallback(() => {
    stopMeter();
    const analyser = engine.nodes?.vizAnalyser;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = Math.round((sum / data.length / 255) * 100);

      if (meterBarRef.current) {
        meterBarRef.current.style.width = `${Math.min(100, Math.max(4, avg * 2.8))}%`;
        meterBarRef.current.style.background = avg > 50 ? '#FF2E63' : avg > 12 ? '#10B981' : '#FF8C00';
      }
      if (meterTextRef.current) {
        meterTextRef.current.textContent = avg > 5 ? 'Mic receiving audio ✓' : 'Speak or sing into the mic';
        meterTextRef.current.style.color = avg > 5 ? '#10B981' : 'var(--text-muted)';
      }

      // Clip detection on the summed master bus
      const now = performance.now();
      if (engine.getMasterPeak() >= 0.98) {
        clipUntilRef.current = now + 1500;
        if (recordingStateRef.current === 'recording') clippedTakeRef.current = true;
      }
      if (clipBadgeRef.current) clipBadgeRef.current.style.opacity = now < clipUntilRef.current ? '1' : '0';

      const canvas = canvasRef.current;
      if (!canvas) return;
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, canvas.width, canvas.height);
      const bars = data.length / 2;
      const barWidth = canvas.width / bars;
      const gradient = g.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#FF8C00');
      gradient.addColorStop(0.55, '#FF2E63');
      gradient.addColorStop(1, '#A855F7');
      g.fillStyle = gradient;
      for (let i = 0; i < bars; i++) {
        const h = (data[i] / 255) * canvas.height * 0.92;
        g.fillRect(i * barWidth, canvas.height - h, barWidth - 1, h);
      }
    };
    loop();
  }, [engine, stopMeter]);

  const releaseMic = useCallback(() => {
    stopMeter();
    engine.stopMic();
  }, [engine, stopMeter]);

  const acquireMic = useCallback(async () => {
    await prepareAudio();
    await engine.startMic({ echoCancellation: echoCancel });
    startMeter();
  }, [engine, prepareAudio, startMeter, echoCancel]);

  const pauseBacking = useCallback(() => {
    try { backingElRef.current?.pause(); } catch { /* ignore */ }
    try { playerTargetRef.current?.pauseVideo(); } catch { /* ignore */ }
  }, []);

  /* ---------------- Housekeeping ---------------- */

  // The global player would bleed into the microphone, so stop it on entry.
  useEffect(() => {
    if (currentTrack) closePlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { backingElRef.current?.pause(); } catch { /* ignore */ }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      engine.dispose();
    };
  }, [engine]);

  /* ---------------- Teleprompter ---------------- */

  // Follows the backing track's currentTime while it plays (live take or preview).
  // Voice-only takes fall back to elapsed time.
  useEffect(() => {
    const active = recordingState === 'recording' || (recordingState === 'idle' && isBackingPlaying);
    if (!active || lyricsLines.length === 0) return undefined;
    let raf;
    const tick = () => {
      const a = backingElRef.current;
      const idx = canMix && a
        ? lineIndexForTime(a.currentTime, a.duration, lyricsLines.length, lineTimes)
        : lineIndexForTime((Date.now() - startedAtRef.current) / 1000, 0, lyricsLines.length, null);
      setLineIdx((p) => (p === idx ? p : idx));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [recordingState, isBackingPlaying, canMix, lyricsLines.length, lineTimes]);

  // Scroll inside the teleprompter only, never the whole page.
  useEffect(() => {
    const box = teleprompterRef.current;
    if (!box) return;
    const el = box.querySelector('.teleprompter-line.active');
    if (!el) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [lineIdx]);

  const jumpToLine = (idx) => {
    if (recordingState !== 'idle') return;
    setLineIdx(idx);
    const a = backingElRef.current;
    if (canMix && a && Number.isFinite(a.duration)) {
      const n = lyricsLines.length;
      a.currentTime = Array.isArray(lineTimes) && lineTimes.length === n ? lineTimes[idx] : (idx / n) * a.duration;
    }
  };

  /* ---------------- Mic check & backing preview (idle only) ---------------- */

  const toggleMicTest = async () => {
    if (isMicTesting) {
      releaseMic();
      setIsMicTesting(false);
      return;
    }
    setErrorMsg('');
    try {
      await acquireMic();
      setIsMicTesting(true);
    } catch (err) {
      setErrorMsg(describeMicError(err));
    }
  };

  const toggleEchoCancel = async (on) => {
    setEchoCancel(on);
    if (on) setMonitorVoice(false); // never loop the voice back to speakers
    if (isMicTesting) {
      try {
        await engine.startMic({ echoCancellation: on });
      } catch (err) {
        setErrorMsg(describeMicError(err));
        setIsMicTesting(false);
        releaseMic();
      }
    }
  };

  const toggleBackingPreview = async () => {
    const a = backingElRef.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    try {
      await prepareAudio(); // route through Web Audio so volume matches the take
      await a.play();
    } catch {
      setErrorMsg('The backing track could not be played. Check your connection and try again.');
    }
  };

  /* ---------------- Recording flow ---------------- */

  const abortTake = (message) => {
    discardRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    engine.discardRecording();
    pauseBacking();
    releaseMic();
    setErrorMsg(message);
    setRecordingState('idle');
  };

  const playReferenceVideo = () => {
    const yt = playerTargetRef.current;
    if (!yt) return;
    try {
      yt.unMute();
      yt.setVolume(musicVolume);
      yt.seekTo(0, true);
      yt.playVideo();
    } catch (e) {
      console.warn('YouTube playback error:', e);
    }
  };

  const beginTake = async () => {
    try {
      const mixed = canMixRef.current;
      discardRef.current = false;
      clippedTakeRef.current = false;

      engine.startRecording(250);
      startedAtRef.current = Date.now();
      setTakeMixed(mixed);
      setRecordingTime(0);
      setLineIdx(0);
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);

      if (mixed) {
        const a = backingElRef.current;
        a.currentTime = 0;
        await a.play();
      } else {
        playReferenceVideo();
      }

      // Register sung song into watch history immediately
      try {
        const historyItem = {
          id: song.id,
          slug: song.slug,
          title: song.title?.canonical || song.title?.devanagari || (typeof song.title === 'string' ? song.title : 'Maithili Geet'),
          singer: song.credits?.singer || song.singer || 'पारंपरिक',
          poster: song.poster?.image_url || song.poster || null,
          category: song.category || 'लोकगीत',
          youtube: song.youtube || {},
          audio: song.audio || {},
          played_at: new Date().toISOString()
        };
        const rawHist = localStorage.getItem('sur_mithila_history') || '[]';
        const parsed = JSON.parse(rawHist);
        const filtered = parsed.filter((i) => i.id !== historyItem.id);
        localStorage.setItem('sur_mithila_history', JSON.stringify([historyItem, ...filtered].slice(0, 80)));
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: historyItem })
        }).catch(() => {});
      } catch (err) {}
    } catch (err) {
      console.error('Recording start error:', err);
      abortTake(
        err?.name === 'NotAllowedError'
          ? 'The browser blocked the backing track from starting. Tap Start Recording again.'
          : 'Recording could not start. Please try again.'
      );
    }
  };

  const startRecordingSequence = async () => {
    setErrorMsg('');
    if (!canStart) {
      setErrorMsg('Confirm you are wearing headphones, or turn on echo cancellation, before recording.');
      return;
    }
    try {
      await acquireMic();
    } catch (err) {
      setErrorMsg(describeMicError(err));
      return;
    }

    // Safari only lets media start from a user gesture, and the real start happens
    // after the countdown. Touching play/pause now "unlocks" the element.
    const a = backingElRef.current;
    if (canMixRef.current && a) {
      try { await a.play(); a.pause(); a.currentTime = 0; } catch { /* handled again at start */ }
    }

    setIsMicTesting(false);
    setRecordingState('countdown');
    setCountdown(3);

    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        beginTake();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    releaseMic();
    setRecordingState('idle');
  };

  const finishTake = useCallback(async () => {
    if (finishingRef.current || recordingStateRef.current !== 'recording') return;
    finishingRef.current = true;
    setIsFinishing(true);

    // Stop the music now, but keep recording briefly: the delayed backing
    // signal and the reverb tail are still travelling through the graph.
    pauseBacking();
    await new Promise((r) => setTimeout(r, syncMsRef.current + TAIL_MS));
    if (discardRef.current) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    const blob = await engine.stopRecording();
    releaseMic();
    finishingRef.current = false;
    setIsFinishing(false);
    if (discardRef.current) return;

    if (!blob || blob.size < 1024) {
      setErrorMsg('Nothing was captured. Check your microphone and try again.');
      setRecordingState('idle');
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioBlob(blob);
    setAudioUrl(url);
    setTakeClipped(clippedTakeRef.current);
    setRecordingTime(Math.round(elapsed));
    setReviewDuration(elapsed);
    setReviewTime(0);
    setReviewPlaying(false);
    setPeaks([]);
    setRecordingState('recorded');

    if (engine.ctx) {
      const result = await computeWaveformPeaks(engine.ctx, blob, WAVE_BARS);
      if (result) {
        setPeaks(result.peaks);
        setReviewDuration(result.duration);
      }
    }
  }, [engine, pauseBacking, releaseMic]);

  const handleBackingEnded = () => {
    setIsBackingPlaying(false);
    if (recordingStateRef.current === 'recording') finishTake();
  };

  const resetTake = () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    setAudioBlob(null);
    setAudioUrl(null);
    setPeaks([]);
    setReviewPlaying(false);
    setReviewTime(0);
    setReviewDuration(0);
    setRecordingTime(0);
    setLineIdx(0);
    setCaption('');
    setErrorMsg('');
    setTakeClipped(false);
    setRecordingState('idle');
    if (backingElRef.current) backingElRef.current.currentTime = 0;
  };

  const applyPreset = (p) => {
    setSelectedFx(p.id);
    setReverbLevel(p.reverb);
    setVocalVolume(p.vocal);
  };

  /* ---------------- Review player ---------------- */

  const toggleReviewPlay = () => {
    const a = reviewAudioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => { });
    else a.pause();
  };

  const seekReview = (e) => {
    const a = reviewAudioRef.current;
    if (!a || !reviewDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = clamp((e.clientX - rect.left) / rect.width, 0, 1) * reviewDuration;
    setReviewTime(a.currentTime);
  };

  // MediaRecorder blobs have no duration header (Chrome reports Infinity).
  // Seeking far past the end forces the browser to compute it.
  const onReviewMeta = (e) => {
    const a = e.currentTarget;
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      const fix = () => {
        a.removeEventListener('timeupdate', fix);
        a.currentTime = 0;
        if (Number.isFinite(a.duration) && a.duration > 0) setReviewDuration(a.duration);
      };
      a.addEventListener('timeupdate', fix);
      a.currentTime = 1e101;
    } else if (a.duration > 0) {
      setReviewDuration(a.duration);
    }
  };

  /* ---------------- Publish ---------------- */

  const handleUpload = async () => {
    if (!audioBlob) return;
    setErrorMsg('');
    setRecordingState('uploading');
    if (reviewAudioRef.current) reviewAudioRef.current.pause();

    try {
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'sur_mithila_covers' }),
      });
      if (!signRes.ok) throw new Error('Could not authorise the upload.');
      const signData = await signRes.json();

      const formData = new FormData();
      formData.append('file', audioBlob, `cover.${extForMime(audioBlob.type)}`);
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('timestamp', signData.timestamp);
      formData.append('signature', signData.signature);
      formData.append('folder', signData.folder);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!cloudRes.ok) throw new Error('The audio upload was rejected.');
      const { secure_url: finalAudioUrl } = await cloudRes.json();
      if (!finalAudioUrl) throw new Error('The audio upload returned no URL.');

      const saveRes = await fetch('/api/recordings/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: song.id,
          songSlug: song.slug,
          title: song.title?.canonical,
          userId: user?.id || 'guest_singer',
          userName: user?.name || 'Artist',
          userAvatar: user?.avatar || null,
          audioUrl: finalAudioUrl,
          caption: caption.trim() || `${song.title?.canonical} - Folk Karaoke Cover`,
          duration: Math.round(reviewDuration || recordingTime),
          isMixed: takeMixed,
          isPrivate: isPrivateTake,
        }),
      });
      if (!saveRes.ok) throw new Error('Saving to the community feed failed.');
      const saveData = await saveRes.json().catch(() => ({}));
      const pubRec = saveData?.recording;
      const recId = pubRec?.recording_id || pubRec?.id || `rec_${Date.now()}`;

      // Register newly published cover in user's watch history
      try {
        const coverHistoryItem = {
          id: `cover-${recId}`,
          slug: song.slug,
          title: `${song.title?.canonical || song.title || 'Maithili Geet'} (Cover)`,
          singer: `${user?.fullName || user?.name || 'Artist'} (Cover)`,
          poster: song.poster?.image_url || song.poster || null,
          category: song.category || 'लोकगीत',
          youtube: {},
          audio: { hosted_audio_url: finalAudioUrl },
          played_at: new Date().toISOString()
        };
        const rawHist = localStorage.getItem('sur_mithila_history') || '[]';
        const parsed = JSON.parse(rawHist);
        const filtered = parsed.filter((i) => i.id !== coverHistoryItem.id);
        localStorage.setItem('sur_mithila_history', JSON.stringify([coverHistoryItem, ...filtered].slice(0, 80)));
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: coverHistoryItem })
        }).catch(() => {});
      } catch (err) {
        console.warn('Failed to record published cover in history:', err);
      }

      setRecordingState('success');
    } catch (e) {
      console.error('Publish error:', e);
      setErrorMsg(`Upload failed: ${e.message} Your recording is still here, so you can try again.`);
      setRecordingState('recorded');
    }
  };

  /* ---------------- Render ---------------- */

  if (!isLoaded) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#FAFAFA' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="ambient-hero-container" style={{ padding: '60px 24px', textAlign: 'center', marginTop: '30px' }}>
        <div className="ambient-glow-halo" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '560px', margin: '0 auto' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF8C00, #FF2E63)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 8px 30px rgba(255, 140, 0, 0.5)',
          }}>
            <Mic size={32} color="#fff" />
          </div>
          <h2 className="font-traditional" style={{ fontSize: '2rem', color: '#F8FAFC', marginBottom: '12px' }}>
            {t('गाउ-मिथिला स्टुडियो मे अहाँक स्वागत अछि', 'Welcome to Gaau-Mithila Karaoke Studio')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {t(
              'अपन स्वर मे मैथिली लोकगीत रिकॉर्ड करू, वोकल FX लगाउ आ सुर-मिथिला समुदाय संग साझा करू। कृपया स्टुडियो मे प्रवेश लेल साइन इन करू।',
              'Record Maithili folk songs in your own voice, apply studio vocal effects, and publish to the community. Please log in to enter the booth.'
            )}
          </p>
          <button onClick={() => openSignIn()} className="pill-btn-play" style={{ padding: '14px 36px', fontSize: '1rem' }}>
            {t('स्टुडियो मे प्रवेश करू (Sign In)', 'Enter Studio (Sign In)')}
          </button>
        </div>
      </div>
    );
  }

  const boothVisible = recordingState === 'idle' || recordingState === 'recording';
  const inReview = recordingState === 'recorded' || recordingState === 'uploading';
  const isRecording = recordingState === 'recording';
  const reviewProgress = reviewDuration > 0 ? clamp(reviewTime / reviewDuration, 0, 1) : 0;
  const waveform = peaks.length ? peaks : Array(WAVE_BARS).fill(0.14);

  return (
    <div className="studio-container">
      {/* Persistent backing element: must stay mounted on every screen, because
          a MediaElementSource is bound to one element for good. crossOrigin is
          required, otherwise Web Audio receives silence from a cross-origin file. */}
      {backingUrl && (
        <audio
          ref={backingElRef}
          src={backingUrl}
          crossOrigin="anonymous"
          preload="auto"
          onPlay={() => setIsBackingPlaying(true)}
          onPause={() => setIsBackingPlaying(false)}
          onEnded={handleBackingEnded}
          onError={() => setBackingFailed(true)}
          style={{ display: 'none' }}
        />
      )}

      <div>
        <Link
          href={`/songs/${song.slug}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          <ArrowLeft size={16} /> <span>पाछू जाउ / Back to {title}</span>
        </Link>
      </div>

      <div className={`studio-booth-card ${isRecording ? 'recording-active' : ''}`}>
        <div className="ambient-glow-halo" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="gold-badge">🎙️ STARMAKER KARAOKE BOOTH</span>
                <span className="vermilion-badge">{song.category}</span>
                {canMix ? (
                  <span style={badge('rgba(16, 185, 129, 0.2)', '#6EE7B7', 'rgba(16, 185, 129, 0.4)')}>
                    🎚️ Mixed recording: voice + backing
                  </span>
                ) : (
                  <span style={badge('rgba(251, 191, 36, 0.15)', '#FDE047', 'rgba(251, 191, 36, 0.4)')}>
                    🎤 Voice-only recording
                  </span>
                )}
              </div>
              <h1 className="font-traditional" style={{ fontSize: '2.2rem', color: '#F8FAFC', margin: 0 }}>{title}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                {t('गायक / Singer:', 'Singer:', 'गायक:')} {singer} • {t('रचयिता / Poet:', 'Lyricist:', 'रचयिता:')} {song.credits?.writer?.name || (isEnglish ? 'Traditional' : 'पारंपरिक')}
              </p>
            </div>

            <div className="lyrics-tabs-pill">
              <button onClick={() => setScriptMode('devanagari')} className={`lyrics-tab-btn ${scriptMode === 'devanagari' ? 'active' : ''}`}>
                {t('देवनागरी (Maithili)', 'Devanagari', 'देवनागरी')}
              </button>
              <button onClick={() => setScriptMode('roman')} className={`lyrics-tab-btn ${scriptMode === 'roman' ? 'active' : ''}`}>
                {t('रोमन (Roman)', 'Roman', 'रोमन')}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div role="alert" style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '18px',
              padding: '12px 14px', borderRadius: '12px',
              background: 'rgba(255, 46, 99, 0.12)', border: '1px solid rgba(255, 46, 99, 0.4)', color: '#FDA4AF', fontSize: '0.86rem',
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1 }}>{errorMsg}</span>
              <button onClick={() => setErrorMsg('')} aria-label="Dismiss" style={{ color: 'inherit', cursor: 'pointer', background: 'none', border: 'none' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Headphones requirement */}
          {!canMix && recordingState === 'idle' && (
            <div style={{
              marginBottom: '18px', padding: '14px 16px', borderRadius: '14px', fontSize: '0.9rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#F8FAFC',
              fontWeight: 500,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', marginBottom: '8px', fontWeight: 700 }}>
                <AlertCircle size={18} />
                Voice-Only Mode
              </div>
              You are singing along to a YouTube video. Browser security prevents us from recording YouTube audio.
              <strong> Your final recording will ONLY contain your voice.</strong>
            </div>
          )}

          {recordingState === 'idle' && (
            <div style={{
              marginBottom: '18px', padding: '14px 16px', borderRadius: '14px', fontSize: '0.84rem',
              background: echoCancel || headphonesOk ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 140, 0, 0.12)',
              border: `1px solid ${echoCancel || headphonesOk ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 140, 0, 0.5)'}`,
              color: 'var(--text-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#F8FAFC', marginBottom: '6px' }}>
                <Headphones size={16} color="var(--neon-saffron)" />
                Headphones are required
              </div>
              <p style={{ margin: '0 0 10px', lineHeight: 1.5 }}>
                {canMix
                  ? 'Your voice is recorded raw (no browser noise filtering) and blended with the backing track. Without headphones the music leaks into your mic and the recording will echo.'
                  : backingFailed && backingUrl
                    ? 'The hosted backing track could not be loaded for mixing (network or CORS), so this take will contain your voice only. Headphones keep the music out of your mic.'
                    : showYoutube
                      ? 'YouTube audio cannot be captured by the browser, so this take will contain your voice only. Headphones keep the music out of your mic.'
                      : 'This song has no backing track, so this take will contain your voice only.'}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: echoCancel ? 'not-allowed' : 'pointer', opacity: echoCancel ? 0.5 : 1, marginBottom: '6px' }}>
                <input type="checkbox" checked={headphonesOk} disabled={echoCancel} onChange={(e) => setHeadphonesOk(e.target.checked)} />
                <span style={{ color: '#F8FAFC' }}>I am wearing headphones</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={echoCancel} onChange={(e) => toggleEchoCancel(e.target.checked)} style={{ marginTop: '3px' }} />
                <span>
                  <span style={{ color: '#F8FAFC' }}>No headphones: turn on echo cancellation.</span>{' '}
                  The browser will filter the music out of your mic, but it also thins and ducks your voice, so audio quality drops.
                </span>
              </label>
            </div>
          )}

          {/* Countdown */}
          {recordingState === 'countdown' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '5.5rem', fontWeight: 900, color: 'var(--neon-saffron)', animation: 'pulse 0.8s infinite' }}>
                {countdown}
              </div>
              <p style={{ color: '#F8FAFC', fontSize: '1.25rem', fontWeight: 600, marginTop: '14px' }}>
                {t('स्वर साधू, गायन एवं संगीत शुरू भऽ रहल अछि... (Get ready!)', 'Get ready! Backing track and recording starting...', 'स्वर साधू, गायन एवं संगीत शुरू भऽ रहल अछि...')}
              </p>
              <button onClick={cancelCountdown} style={{ ...ghostBtn, marginTop: '20px', padding: '8px 20px', borderRadius: '9999px' }}>
                {t('रद्द करू (Cancel)', 'Cancel', 'रद्द करू')}
              </button>
            </div>
          )}

          {/* ============ BOOTH: idle + recording ============ */}
          <div style={{
            display: boothVisible ? 'grid' : 'none',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            alignItems: 'start',
          }}>
            {/* Left: teleprompter + backing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {t('📜 Live Teleprompter (लाइव बोल)', '📜 Live Teleprompter', '📜 सजीव बोल')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Line {lineIdx + 1} of {lyricsLines.length}
                </span>
              </div>

              <div ref={teleprompterRef} className="studio-teleprompter" style={{ position: 'relative' }}>
                {lyricsLines.map((line, idx) => (
                  <div
                    key={idx}
                    onClick={() => jumpToLine(idx)}
                    className={`teleprompter-line ${idx === lineIdx ? 'active' : ''}`}
                    style={{ cursor: recordingState === 'idle' ? 'pointer' : 'default' }}
                  >
                    {line}
                  </div>
                ))}
              </div>

              {canMix ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px',
                  background: 'radial-gradient(circle at 20% 20%, rgba(255, 140, 0, 0.15) 0%, #080A10 80%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <Disc size={40} color="var(--neon-saffron)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F8FAFC' }}>Backing track</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {isRecording ? 'Playing live into your recording' : 'Preview it, or tap a lyric line to jump'}
                    </div>
                  </div>
                  {recordingState === 'idle' && (
                    <button
                      onClick={toggleBackingPreview}
                      aria-label={isBackingPlaying ? 'Pause preview' : 'Play preview'}
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255, 140, 0, 0.18)', border: '1px solid rgba(255, 140, 0, 0.4)', color: '#FDE047',
                      }}
                    >
                      {isBackingPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                    </button>
                  )}
                </div>
              ) : showYoutube ? (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', background: '#000', aspectRatio: '16/9', position: 'relative' }}>
                  <YouTube
                    videoId={youtubeId}
                    opts={{ width: '100%', height: '100%', playerVars: { controls: 1, modestbranding: 1, fs: 1, rel: 0, enablejsapi: 1 } }}
                    onReady={(e) => {
                      playerTargetRef.current = e.target;
                      e.target.setVolume(musicVolume);
                    }}
                    style={{ width: '100%', height: '100%' }}
                    iframeClassName="youtube-iframe"
                  />
                </div>
              ) : (
                <div style={{
                  aspectRatio: '16/9', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', background: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                }}>
                  Acoustic Voice Booth
                </div>
              )}
            </div>

            {/* Center: controls + visualizer */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '30px', background: 'rgba(8, 10, 16, 0.75)', borderRadius: '20px', minHeight: '340px',
              border: isRecording ? '2px solid #FF2E63' : '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              {recordingState === 'idle' && (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <button
                    onClick={startRecordingSequence}
                    aria-label="Start recording"
                    aria-disabled={!canStart}
                    style={{
                      width: '94px', height: '94px', borderRadius: '50%', color: '#fff', border: 'none',
                      cursor: canStart ? 'pointer' : 'not-allowed', opacity: canStart ? 1 : 0.45,
                      background: 'linear-gradient(135deg, #FF8C00 0%, #FF2E63 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 10px 32px rgba(255, 46, 99, 0.5)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)', margin: '0 auto 20px',
                    }}
                    onMouseEnter={(e) => { if (canStart) e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <Mic size={42} />
                  </button>
                  <h3 style={{ fontSize: '1.25rem', color: '#F8FAFC', marginBottom: '6px' }}>
                    {t('गायन शुरू करू (Start Recording)', 'Start Recording', 'गायन शुरू करू')}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto 16px' }}>
                    {canStart
                      ? t('माइक ऑन करू, संगीत स्वतः आरंभ होयत आ अहाँक गायन रिकॉर्ड होयत।', 'Turn on your mic; backing track will start and record your voice.', 'माइक ऑन करू, संगीत स्वतः आरंभ होयत आ अहाँक गायन रिकॉर्ड होयत।')
                      : t('रिकॉर्डिंग शुरू करबा लेल पहिने हेडफ़ोन निश्चित करू।', 'Confirm headphones (or turn on echo cancellation) above to unlock recording.', 'प्रस्तुति शुरू करबा लेल पहिने हेडफ़ोन निश्चित करू।')}
                  </p>

                  <button
                    onClick={toggleMicTest}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9999px',
                      background: isMicTesting ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: isMicTesting ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.12)',
                      color: isMicTesting ? '#6EE7B7' : 'var(--text-secondary)',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Activity size={14} color={isMicTesting ? '#10B981' : 'var(--neon-saffron)'} />
                    <span>{isMicTesting ? t('माइक जाँच रोकू', 'Stop mic check', 'माइक जाँच रोकू') : t('🎤 माइक जाँच (Mic check)', '🎤 Mic check', '🎤 माइक जाँच')}</span>
                  </button>

                  {isMicTesting && (
                    <div style={{ marginTop: '16px' }}>
                      <canvas ref={canvasRef} className="studio-meter-canvas" width={300} height={70} style={{ marginBottom: '8px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '140px', height: '6px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div ref={meterBarRef} style={{ width: '0%', height: '100%', background: '#10B981', transition: 'width 0.05s ease' }} />
                        </div>
                        <span ref={meterTextRef} style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Listening…</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isRecording && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '9999px',
                    background: 'rgba(255, 46, 99, 0.2)', border: '1px solid rgba(255, 46, 99, 0.5)',
                    color: '#FF2E63', fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px',
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF2E63', animation: 'pulse 1s infinite' }} />
                    ON AIR • RECORDING LIVE
                  </div>

                  <div style={{ fontSize: '3rem', fontWeight: 800, color: '#F8FAFC', fontFamily: 'monospace', marginBottom: '16px' }}>
                    {formatTime(recordingTime)}
                  </div>

                  <canvas ref={canvasRef} className="studio-meter-canvas" width={320} height={90} style={{ marginBottom: '12px' }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Activity size={14} color="var(--neon-saffron)" />
                    <div style={{ width: '160px', height: '6px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div ref={meterBarRef} style={{ width: '0%', height: '100%', background: '#10B981', transition: 'width 0.05s ease' }} />
                    </div>
                    <span ref={meterTextRef} style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Mic receiving audio ✓</span>
                  </div>

                  <div ref={clipBadgeRef} style={{ opacity: 0, transition: 'opacity 0.2s', fontSize: '0.74rem', fontWeight: 700, color: '#FF2E63', marginBottom: '10px' }}>
                    ⚠ Clipping: lower Vocal Volume or Mic Input
                  </div>

                  <button
                    onClick={finishTake}
                    disabled={isFinishing}
                    aria-label="Stop recording"
                    style={{
                      width: '64px', height: '64px', borderRadius: '50%', cursor: isFinishing ? 'wait' : 'pointer',
                      background: 'rgba(255, 46, 99, 0.2)', color: '#FF2E63', border: '2px solid #FF2E63',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                      boxShadow: '0 0 24px rgba(255, 46, 99, 0.4)',
                    }}
                  >
                    <Square size={24} fill="#FF2E63" />
                  </button>
                  <p style={{ marginTop: '12px', fontSize: '0.8rem', color: '#FF2E63', fontWeight: 600 }}>
                    {isFinishing ? t('समाप्त भऽ रहल...', 'Finishing take...', 'समाप्त भऽ रहल...') : t('रिकाॅर्डिंग समाप्त करू (Finish & preview)', 'Finish & Preview', 'रिकाॅर्डिंग समाप्त करू')}
                  </p>
                </div>
              )}
            </div>

            {/* Right: mix & vocal chain */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px',
              background: 'rgba(8, 10, 16, 0.65)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--neon-saffron)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {t('मिक्सर एवं वोकल FX (Mixer & Vocal FX)', 'Mixer & Vocal FX', 'ध्वनि संमिश्रक एवं स्वर प्रभाव')}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {FX_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '12px 10px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.18s ease',
                      background: selectedFx === preset.id ? 'rgba(255, 140, 0, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      border: selectedFx === preset.id ? '1px solid var(--neon-saffron)' : '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: selectedFx === preset.id ? '#FDE047' : '#F8FAFC' }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>{preset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Live sliders: adjustable while recording */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <MixSlider label="Vocal Volume" value={vocalVolume} onChange={(v) => { setVocalVolume(v); setSelectedFx(''); }} max={150} />
                <MixSlider label="Music Volume" value={musicVolume} onChange={setMusicVolume} />
                <MixSlider label="Reverb" value={reverbLevel} onChange={(v) => { setReverbLevel(v); setSelectedFx(''); }} />
                <MixSlider label="Mic Input Trim" value={inputTrim} onChange={setInputTrim} min={25} max={200} />
              </div>

              {/* Sync (locked while recording: changing a delay mid-take warbles the music) */}
              {canMix && (
                <div style={{ paddingTop: '4px' }}>
                  <MixSlider
                    label="Vocal Sync Offset"
                    value={syncOffsetMs}
                    onChange={updateSync}
                    min={0}
                    max={500}
                    step={5}
                    display={`${syncOffsetMs} ms`}
                    disabled={isRecording}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                      Delays the backing track in the recording only, so it lines up with your voice. If your voice sounds early or late in the review, adjust and re-record. Bluetooth usually needs 200–300 ms.
                    </p>
                    {!isRecording && (
                      <button
                        onClick={autoSync}
                        style={{ ...ghostBtn, padding: '6px 12px', fontSize: '0.72rem', borderRadius: '9999px', flexShrink: 0 }}
                      >
                        Estimate
                      </button>
                    )}
                  </div>
                </div>
              )}

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '0.8rem',
                color: 'var(--text-secondary)', cursor: echoCancel ? 'not-allowed' : 'pointer', opacity: echoCancel ? 0.5 : 1,
              }}>
                <span>
                  <Headphones size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
                  Hear my voice (headphones only)
                </span>
                <input type="checkbox" checked={monitorVoice && !echoCancel} disabled={echoCancel} onChange={(e) => setMonitorVoice(e.target.checked)} />
              </label>
            </div>
          </div>

          {/* ============ REVIEW SCREEN ============ */}
          {inReview && audioUrl && (
            <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <h2 className="font-traditional" style={{ fontSize: '1.6rem', color: '#F8FAFC', margin: 0 }}>
                  {t('🎧 अहाँक रिकॉर्डिंग (Review your take)', '🎧 Review Your Take', '🎧 अहाँक प्रस्तुति')}
                </h2>
                <span style={takeMixed
                  ? badge('rgba(16, 185, 129, 0.2)', '#6EE7B7', 'rgba(16, 185, 129, 0.4)')
                  : badge('rgba(251, 191, 36, 0.15)', '#FDE047', 'rgba(251, 191, 36, 0.4)')}>
                  {takeMixed ? t('वोकल + संगीत मिश्रित (Mixed)', 'Voice + Backing (Mixed)', 'स्वर + संगीत मिश्रित') : t('मात्र वोकल (Voice only)', 'Voice only', 'मात्र स्वर')}
                </span>
              </div>

              {takeClipped && (
                <div style={{ fontSize: '0.82rem', color: '#FDA4AF', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255, 46, 99, 0.1)', border: '1px solid rgba(255, 46, 99, 0.35)' }}>
                  The mix hit full scale at least once, so it may sound distorted. Lower Vocal Volume or Mic Input and re-record.
                </div>
              )}

              {/* Mixed-result player */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '20px',
                background: 'rgba(8, 10, 16, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <button
                  onClick={toggleReviewPlay}
                  aria-label={reviewPlaying ? 'Pause' : 'Play'}
                  style={{
                    width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', color: '#fff',
                    background: 'linear-gradient(135deg, #FF8C00, #FF2E63)', boxShadow: '0 6px 22px rgba(255, 140, 0, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {reviewPlaying ? <Pause size={26} fill="#fff" /> : <Play size={26} fill="#fff" style={{ marginLeft: '3px' }} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={seekReview} style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '64px', cursor: 'pointer' }}>
                    {waveform.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: `${Math.max(8, p * 100)}%`, borderRadius: '2px',
                          background: i / WAVE_BARS <= reviewProgress ? 'linear-gradient(180deg, #FF8C00, #FF2E63)' : 'rgba(255, 255, 255, 0.18)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    <span>{formatTime(reviewTime)}</span>
                    <span>{formatTime(reviewDuration || recordingTime)}</span>
                  </div>
                </div>

                <audio
                  ref={reviewAudioRef}
                  src={audioUrl}
                  preload="metadata"
                  onLoadedMetadata={onReviewMeta}
                  onTimeUpdate={(e) => setReviewTime(e.currentTarget.currentTime)}
                  onPlay={() => setReviewPlaying(true)}
                  onPause={() => setReviewPlaying(false)}
                  onEnded={() => { setReviewPlaying(false); setReviewTime(0); }}
                  style={{ display: 'none' }}
                />
              </div>

              <div>
                <input
                  type="text"
                  value={caption}
                  maxLength={140}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={recordingState === 'uploading'}
                  placeholder={t('प्रस्तुतिक वर्णन / Add a cover caption or dedication…', 'Add a cover caption or dedication…', 'प्रस्तुतिक वर्णन / समर्पण लिखू…')}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px', outline: 'none',
                    background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#F8FAFC', fontSize: '0.9rem',
                  }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>{caption.length}/140</div>
              </div>

              {user?.canManagePrivacy && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(234, 179, 8, 0.05)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={isPrivateTake}
                    onChange={(e) => setIsPrivateTake(e.target.checked)}
                    disabled={recordingState === 'uploading'}
                    style={{ width: '18px', height: '18px', accentColor: '#EAB308', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} color="#EAB308" />
                      {t('व्यक्तिगत रूपेँ प्रकाशित करू (Private)', 'Publish as Private Recording', 'व्यक्तिगत रूपेँ प्रकाशित करू')}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {t('मात्र अहाँ आ व्यवस्थापक एहि रिकॉर्डिंग केँ देखि वा सुनि सकब।', 'Only you and platform administrators will be able to see or listen to this recording.', 'मात्र अहाँ आ व्यवस्थापक एहि प्रस्तुति केँ देखि वा सुनि सकब।')}
                    </div>
                  </div>
                </label>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <button onClick={resetTake} disabled={recordingState === 'uploading'} style={{ ...ghostBtn, flex: '1 1 140px' }}>
                  <RefreshCw size={16} /> {t('पुनः रिकॉर्ड करू (Re-record)', 'Re-record', 'पुनः रिकॉर्ड करू')}
                </button>
                <a
                  href={audioUrl}
                  download={`${song.slug}-cover.${extForMime(audioBlob?.type)}`}
                  style={{ ...ghostBtn, flex: '1 1 140px', textDecoration: 'none' }}
                >
                  <Download size={16} /> {t('डाउनलोड (Download)', 'Download', 'डाउनलोड')}
                </a>
                <button
                  onClick={handleUpload}
                  disabled={recordingState === 'uploading'}
                  style={{
                    flex: '2 1 220px', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem', color: '#fff',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <UploadCloud size={18} /> {t('समुदाय मे साझा करू (Publish to Community)', 'Publish to Community', 'समुदाय मे साझा करू')}
                </button>
              </div>

              {recordingState === 'uploading' && (
                <div style={{
                  position: 'absolute', inset: '-12px', borderRadius: '20px', zIndex: 2,
                  background: 'rgba(8, 10, 16, 0.88)', backdropFilter: 'blur(6px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#10B981',
                }}>
                  <UploadCloud size={54} style={{ animation: 'bounce 1.5s infinite', marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.3rem', color: '#F8FAFC', marginBottom: '6px' }}>
                    {t('समुदाय मे प्रकाशित भऽ रहल अछि...', 'Publishing to community...', 'समुदाय मे प्रकाशित भऽ रहल अछि...')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('अहाँक प्रस्तुति अपलोड भऽ रहल अछि। कृपया ई टैब खुजल राखू।', 'Uploading your cover. Keep this tab open.', 'अहाँक प्रस्तुति अपलोड भऽ रहल अछि। कृपया ई पत्र खुजल राखू।')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============ SUCCESS ============ */}
          {recordingState === 'success' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 size={36} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '1.5rem', color: '#F8FAFC', marginBottom: '8px' }}>
                {t('बधाई! (Cover published)', 'Congratulations! Cover published', 'बधाई! प्रस्तुति प्रकाशित भेल')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {t('अहाँक गायन सुर-मिथिला समुदाय फीड पर प्रकाशित भऽ गेल।', 'Your cover has been published to the Sur-Mithila community feed.', 'अहाँक गायन सुर-मिथिला समुदाय मंच पर प्रकाशित भऽ गेल।')}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                <Link href="/community" className="pill-btn-play" style={{ textDecoration: 'none' }}>
                  <span>{t('फीड मे देखू (View in Community Feed)', 'View in Community Feed', 'मंच पर देखू')}</span>
                </Link>
                <button onClick={resetTake} style={{ ...ghostBtn, padding: '10px 22px', borderRadius: '9999px' }}>
                  {t('आन रिकॉर्डिंग करू (Record another take)', 'Record another take', 'आन प्रस्तुति करू')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LyricsTheatre
        lyrics={song.lyrics}
        canonicalTitle={song.title?.canonical}
        writer={song.credits?.writer}
        traditionalRaga={song.traditional_raga}
        song={song}
      />
    </div>
  );
}