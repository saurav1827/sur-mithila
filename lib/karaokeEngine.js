/* ------------------------------------------------------------------ */
/* Karaoke Web Audio engine                                           */
/* Framework-free: everything the React component needs from the      */
/* browser's audio stack lives here.                                  */
/* ------------------------------------------------------------------ */

export const MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
];

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const formatTime = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};

export const pickMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
};

export const extForMime = (mime = '') =>
    mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

export const describeMicError = (err) => {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        return "Microphone access was blocked. Allow the microphone in your browser's address bar, then try again.";
    }
    if (err?.name === 'NotFoundError') return 'No microphone was found. Connect one and try again.';
    return err?.message || 'The microphone could not be started.';
};

/**
 * Raw (unprocessed) capture by default. Browser DSP (echo cancellation, noise
 * suppression, AGC) squashes loud singing and ducks the signal, so all three are
 * off unless the singer has no headphones and opts into echo cancellation.
 */
export const micConstraints = (echoCancellation = false) => ({
    audio: {
        echoCancellation,
        noiseSuppression: false,
        autoGainControl: true, // Let the browser boost quiet mics naturally
        channelCount: 1,
        latency: 0, // hint: lowest-latency capture path (Chrome)
    },
});

/** Synthetic room impulse response: exponentially decaying stereo noise. */
export function makeImpulse(ctx, seconds = 2.2, decay = 3) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return buffer;
}

/**
 * Builds the static audio graph. The mic stream and the <audio> element are
 * attached later, once they exist.
 *
 *  mic ─► micIn(trim) ─► highpass 80Hz ─► compressor ─┬─► dry ────────┐
 *                                                      └─► reverb ─► wet ┤
 *                                                                        ▼
 *                                                                    vocalBus ─┬─► master
 *                                                                              ├─► vizAnalyser
 *                                                                              └─► monitor ─► speakers (optional)
 *
 *  <audio> ─► musicGain ─┬─► speakers          (what the singer hears: no delay)
 *                        └─► syncDelay ─► master (what gets recorded: aligned to the late vocal)
 *
 *  master ─► recDest (MediaRecorder)   and   master ─► masterMeter (clip detection)
 *
 *  The recorder only ever sees `master`, so the two signals are summed
 *  digitally in one place instead of two separate inputs to the destination.
 */
function buildGraph(ctx) {
    // ----- Master mix -----
    const master = ctx.createGain();
    master.gain.value = 0.9; // a little headroom for the sum of voice + music
    const recDest = ctx.createMediaStreamDestination();
    master.connect(recDest);

    const masterMeter = ctx.createAnalyser();
    masterMeter.fftSize = 1024;
    master.connect(masterMeter);

    // ----- Vocal chain -----
    const micIn = ctx.createGain(); // input trim

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    hp.Q.value = 0.707;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; // raised from -15 so high pitch singing isn't crushed
    comp.knee.value = 30; // soft knee
    comp.ratio.value = 2; // gentle 2:1
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx);

    const vocalBus = ctx.createGain();

    const vizAnalyser = ctx.createAnalyser();
    vizAnalyser.fftSize = 256;
    vizAnalyser.smoothingTimeConstant = 0.8;

    const monitor = ctx.createGain();
    monitor.gain.value = 0; // off by default: open mic + speakers = feedback

    micIn.connect(hp);
    hp.connect(comp);
    comp.connect(dry);
    comp.connect(reverb);
    reverb.connect(wet);
    dry.connect(vocalBus);
    wet.connect(vocalBus);
    vocalBus.connect(master);
    vocalBus.connect(vizAnalyser);
    vocalBus.connect(monitor);
    monitor.connect(ctx.destination);

    // ----- Backing track -----
    const musicGain = ctx.createGain();
    const syncDelay = ctx.createDelay(1); // up to 1s; UI uses 0–500ms
    musicGain.connect(ctx.destination);
    musicGain.connect(syncDelay);
    syncDelay.connect(master);

    return {
        master, recDest, masterMeter,
        micIn, hp, comp, dry, wet, reverb, vocalBus, vizAnalyser, monitor,
        musicGain, syncDelay,
    };
}

/** Decode a recorded blob into normalised peak bars for the review waveform. */
export async function computeWaveformPeaks(ctx, blob, bars = 72) {
    try {
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        const channel = decoded.getChannelData(0);
        const block = Math.max(1, Math.floor(channel.length / bars));
        const stride = Math.max(1, Math.floor(block / 200));
        const out = [];
        for (let i = 0; i < bars; i++) {
            let max = 0;
            for (let j = i * block; j < (i + 1) * block && j < channel.length; j += stride) {
                const v = Math.abs(channel[j]);
                if (v > max) max = v;
            }
            out.push(max);
        }
        const top = Math.max(...out, 0.001);
        return { peaks: out.map((v) => Math.max(0.08, v / top)), duration: decoded.duration };
    } catch {
        return null; // cosmetic only
    }
}

export class KaraokeEngine {
    constructor() {
        this.ctx = null;
        this.nodes = null;
        this.backingSource = null;
        this.backingEl = null;
        this.micStream = null;
        this.micSource = null;
        this.micConfig = null;
        this.recorder = null;
        this.chunks = [];
        this._td = null;
    }

    /** Create (or resume) the single AudioContext. Call from a user gesture. */
    async init() {
        if (!this.ctx || this.ctx.state === 'closed') {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) throw new Error('This browser does not support the Web Audio API.');
            this.ctx = new Ctx({ latencyHint: 'interactive' });
            this.nodes = buildGraph(this.ctx);
            this.backingSource = null;
            this.backingEl = null;
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return this.ctx;
    }

    /**
     * An <audio> element can only ever be wrapped by ONE MediaElementSourceNode,
     * so it is cached and reused across takes. Needs crossOrigin="anonymous" on
     * the element and CORS headers on the file, or the browser outputs silence.
     */
    attachBacking(el) {
        if (!this.ctx || !this.nodes || !el) return false;
        if (this.backingEl === el && this.backingSource) return true;
        try {
            this.backingSource = this.ctx.createMediaElementSource(el);
            this.backingSource.connect(this.nodes.musicGain);
            this.backingEl = el;
            return true;
        } catch (err) {
            console.warn('Could not attach backing track to AudioContext:', err);
            return false;
        }
    }

    /** Open the microphone. Re-opens it if the echo-cancellation choice changed. */
    async startMic({ echoCancellation = false } = {}) {
        await this.init();
        if (this.micStream?.active && this.micConfig?.echoCancellation === echoCancellation) {
            return this.micStream.getAudioTracks()[0]?.getSettings?.() || {};
        }
        this.stopMic();
        const stream = await navigator.mediaDevices.getUserMedia(micConstraints(echoCancellation));
        this.micStream = stream;
        this.micConfig = { echoCancellation };
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.nodes.micIn);
        return stream.getAudioTracks()[0]?.getSettings?.() || {};
    }

    stopMic() {
        if (this.micSource) {
            try { this.micSource.disconnect(); } catch { /* already disconnected */ }
            this.micSource = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach((t) => t.stop());
            this.micStream = null;
        }
        this.micConfig = null;
    }

    get micActive() {
        return Boolean(this.micStream?.active);
    }

    /** Apply all live mix parameters with short ramps (no zipper noise). */
    applyMix({ inputTrim, vocalVolume, musicVolume, reverb, monitorVoice, syncMs }) {
        if (!this.ctx || !this.nodes) return;
        const n = this.nodes;
        const t = this.ctx.currentTime;
        const k = 0.02;
        n.micIn.gain.setTargetAtTime(inputTrim / 100, t, k);
        n.vocalBus.gain.setTargetAtTime(vocalVolume / 100, t, k);
        n.musicGain.gain.setTargetAtTime(musicVolume / 100, t, k);
        n.wet.gain.setTargetAtTime((reverb / 100) * 0.8, t, k);
        n.dry.gain.setTargetAtTime(1, t, k);
        n.monitor.gain.setTargetAtTime(monitorVoice ? 1 : 0, t, k);
        n.syncDelay.delayTime.setTargetAtTime(clamp(syncMs, 0, 1000) / 1000, t, 0.01);
    }

    /** Rough round-trip latency the browser admits to (ms), or null if unknown. */
    estimateLatencyMs() {
        if (!this.ctx) return null;
        const out = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
        const inp = this.micStream?.getAudioTracks()[0]?.getSettings?.().latency || 0;
        const ms = Math.round((out + inp) * 1000);
        return ms > 0 ? ms : null;
    }

    /** Highest absolute sample on the master bus right now (1.0 = full scale). */
    getMasterPeak() {
        const a = this.nodes?.masterMeter;
        if (!a) return 0;
        if (!this._td || this._td.length !== a.fftSize) this._td = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(this._td);
        let peak = 0;
        for (let i = 0; i < this._td.length; i++) {
            const v = Math.abs(this._td[i]);
            if (v > peak) peak = v;
        }
        return peak;
    }

    /* ---------------- Recording (captures `master` only) ---------------- */

    startRecording(timesliceMs = 250) {
        if (!this.nodes) throw new Error('Audio engine is not initialised.');
        const mimeType = pickMimeType();
        const rec = new MediaRecorder(this.nodes.recDest.stream, {
            ...(mimeType ? { mimeType } : {}),
            audioBitsPerSecond: 192000,
        });
        this.chunks = [];
        rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) this.chunks.push(e.data);
        };
        rec.start(timesliceMs);
        this.recorder = rec;
        return rec;
    }

    /** Resolves with the finished Blob (or null if nothing was recording). */
    stopRecording() {
        return new Promise((resolve) => {
            const rec = this.recorder;
            if (!rec || rec.state === 'inactive') {
                resolve(null);
                return;
            }
            let stopped = false;
            const done = () => {
                if (stopped) return;
                stopped = true;
                const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
                this.recorder = null;
                this.chunks = [];
                resolve(blob);
            };
            rec.onstop = done;
            try {
                rec.stop();
                // Fallback: if browser fails to fire onstop, resolve anyway after 500ms
                setTimeout(done, 500);
            } catch (err) {
                console.warn('Recorder stop error:', err);
                done();
            }
        });
    }

    discardRecording() {
        const rec = this.recorder;
        if (rec) {
            rec.ondataavailable = null;
            rec.onstop = null;
            if (rec.state !== 'inactive') {
                try { rec.stop(); } catch { /* ignore */ }
            }
        }
        this.recorder = null;
        this.chunks = [];
    }

    dispose() {
        this.discardRecording();
        this.stopMic();
        try { this.backingSource?.disconnect(); } catch { /* ignore */ }
        this.backingSource = null;
        this.backingEl = null;
        if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => { });
        this.ctx = null;
        this.nodes = null;
    }
}