// ================================================================
// REHAB.AI — app.js  v4.0 · Phase 1.2.7 Heel Anchor
// Matches image blueprint exactly.
// Kalman · Confidence gate · Ankle integrity · ROM safety
// Phase-locked registry · Velocity target band · Clinical summary
// ================================================================
'use strict';

// ── DEV MODE ─────────────────────────────────────────────────────
// Set to true to bypass signal-lost blocking and populate HUD with
// mock data so you can iterate on the UI without being in front of
// the camera. Flip back to false for clinical use.
const DEV_MODE = false;

// Mock data ticker — runs only when DEV_MODE is true
function startMockTicker() {
    let tick = 0;
    setInterval(() => {
        tick++;
        // Oscillate velocity marker between 10 and 80 deg/s
        const vel = 10 + Math.abs(Math.sin(tick * 0.04) * 70);
        updateVelBand(vel);
        // Alternate form state every ~4 seconds for visual testing
        if (Math.floor(tick / 80) % 3 === 0) setFormStable();
        else if (Math.floor(tick / 80) % 3 === 1) setFormWarning('HIP HIKE');
        else setFormWarning('EXT LAG');
        // Cycle hold timer display
        const holdSec = ((tick % 60) / 10).toFixed(1);
        if (holdDisplay) holdDisplay.textContent = holdSec + 's';
        // Mock rep/set progress
        const mockRep = Math.floor(tick / 120) % 11;
        const mockSet = Math.floor(tick / 1200) % 4;
        if (repsDisplay) repsDisplay.textContent = mockRep + '/10';
        if (setsDisplay) setsDisplay.textContent = mockSet + '/3';
        if (exCardReps) exCardReps.textContent = mockRep + '/10';
        if (exCardSets) exCardSets.textContent = mockSet + '/3';
        if (progressBar) progressBar.style.width = Math.round(((mockSet * 10 + mockRep) / 30) * 100) + '%';
    }, 16); // ~60fps tick
}

// ── DOM ──────────────────────────────────────────────────────────
const videoEl       = document.getElementById('webcam');
const canvasEl      = document.getElementById('output-canvas');
const ctx           = canvasEl.getContext('2d');

// Top bar
const statusText    = document.getElementById('status-text');
const statusDot     = document.getElementById('status-dot');
const progressBar   = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const trackingQualityEl = document.getElementById('tracking-quality');
const trackingQualityText = document.getElementById('tracking-quality-text');
const legLeftBtn = document.getElementById('leg-left');
const legRightBtn = document.getElementById('leg-right');

// Phase 1.2 source/test-video/debug harness
const sourceCameraBtn = document.getElementById('source-camera');
const sourceTestVideoBtn = document.getElementById('source-test-video');
const testVideoFileInput = document.getElementById('test-video-file');
const videoPlayBtn = document.getElementById('video-play');
const videoPauseBtn = document.getElementById('video-pause');
const videoRestartBtn = document.getElementById('video-restart');
const videoStepBtn = document.getElementById('video-step');
const videoSpeedSelect = document.getElementById('video-speed');
const sourceNote = document.getElementById('source-note');
const debugToggleBtn = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const dbgSource = document.getElementById('dbg-source');
const dbgPoseFps = document.getElementById('dbg-pose-fps');
const dbgInferenceAge = document.getElementById('dbg-inference-age');
const dbgRawAngle = document.getElementById('dbg-raw-angle');
const dbgSmoothAngle = document.getElementById('dbg-smooth-angle');
const dbgFrames = document.getElementById('dbg-frames');
const dbgReason = document.getElementById('dbg-reason');
const dbgVideoTime = document.getElementById('dbg-video-time');

// Form status card
const formIcon      = document.getElementById('form-icon');
const formLabel     = document.getElementById('form-label');
const repsDisplay   = document.getElementById('reps-display');
const setsDisplay   = document.getElementById('sets-display');
const holdDisplay   = document.getElementById('hold-display');

// Velocity band
const velMarker     = document.getElementById('vel-marker');
const inpVelLow     = document.getElementById('inp-vel-low');
const inpVelHigh    = document.getElementById('inp-vel-high');
const liveRomDisplay = document.getElementById('live-rom');
const romTargetDisplay = document.getElementById('rom-target');
const romFill = document.getElementById('rom-fill');
const romCaption = document.getElementById('rom-caption');
const historyRom = document.getElementById('history-rom');
const historyWarnings = document.getElementById('history-warnings');

// Exercise card
const exThumb       = document.getElementById('ex-thumb');
const exCardName    = document.getElementById('ex-card-name');
const exCardReps    = document.getElementById('ex-card-reps');
const exCardSets    = document.getElementById('ex-card-sets');
const exCardDesc    = document.getElementById('ex-card-desc');

// Dropdowns
const phaseDropdown = document.getElementById('phase-dropdown');
const exDropdown    = document.getElementById('ex-dropdown');

// ROM
const inpMaxRom     = document.getElementById('inp-max-rom');
const inpMinRom     = document.getElementById('inp-min-rom');
const romToggle     = document.getElementById('rom-toggle');
const romStatus     = document.getElementById('rom-status');

// Tempo
const inpSets       = document.getElementById('inp-sets');
const inpRest       = document.getElementById('inp-rest');
const inpRest2      = document.getElementById('inp-rest2');
const inpToPeak     = document.getElementById('inp-topeak');
const inpHold       = document.getElementById('inp-hold');
const inpReturn     = document.getElementById('inp-return');

// Buttons
const btnCal        = document.getElementById('btn-calibrate');
const btnApply      = document.getElementById('btn-apply');

// Overlays
const signalOverlay = document.getElementById('signal-overlay');
const romOverlay    = document.getElementById('rom-overlay');
const summaryOverlay= document.getElementById('summary-overlay');
const btnSumDismiss = document.getElementById('btn-sum-dismiss');
const btnSumRestart = document.getElementById('btn-sum-restart');

// Summary fields
const sumPerf       = document.getElementById('sum-perf');
const sumRom        = document.getElementById('sum-rom');
const sumNotes      = document.getElementById('sum-notes-text');
const sumUserNotes  = document.getElementById('sum-user-notes');

canvasEl.width  = 640;
canvasEl.height = 480;

// ================================================================
// PHASE-LOCKED EXERCISE REGISTRY
// ================================================================
const PHASE_META = {
    1: { label: 'Phase 1', weeks: 'Weeks 1–4', desc: 'ROM Restoration · Swelling Control · Quad Activation' },
};

// Heel-slide-only build for now. Keep the same UI shell, but constrain the protocol
// to one phase and one exercise so the perception stack can become reliable first.
const REGISTRY = {
    1: [
        { key:'heel_slide',   name:'Supine Heel Slide',
          desc:'Supine. Slide heel toward glutes and back. Camera side-view. Rehab AI tracks hip → knee → ankle ROM.',
          thumb:'🛝',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:160,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Leg extended. Rest.', toPeak:'Slide heel toward glutes.', hold:'Hold — knee fully bent.', ret:'Slide slowly back.', lag:'Extensor lag — lock out fully at rest.', comp:'Hip hiking detected — keep pelvis flat.' } },
    ],
};

// ================================================================
// TRACKING TRUST LAYER
// Working-leg lock · One Euro smoothing · quality gate · outlier rejection
// ================================================================
class LowPassFilter {
    constructor(){ this.initialized = false; this.y = 0; }
    filter(value, alpha){
        if(!this.initialized){ this.initialized = true; this.y = value; return value; }
        this.y = alpha * value + (1 - alpha) * this.y;
        return this.y;
    }
    reset(){ this.initialized = false; this.y = 0; }
}

class OneEuroFilter {
    constructor(freq = 30, minCutoff = 0.7, beta = 0.018, dCutoff = 1.0){
        this.freq = freq;
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xFilter = new LowPassFilter();
        this.dxFilter = new LowPassFilter();
        this.lastRaw = null;
        this.lastTime = null;
    }
    alpha(cutoff){
        const te = 1.0 / this.freq;
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / te);
    }
    filter(value, timestamp = performance.now()){
        if(this.lastTime !== null){
            const dt = Math.max(0.001, (timestamp - this.lastTime) / 1000);
            this.freq = 1 / dt;
        }
        const dx = this.lastRaw === null ? 0 : (value - this.lastRaw) * this.freq;
        const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff));
        const cutoff = this.minCutoff + this.beta * Math.abs(edx);
        const result = this.xFilter.filter(value, this.alpha(cutoff));
        this.lastRaw = value;
        this.lastTime = timestamp;
        return result;
    }
    setTuning(minCutoff = this.minCutoff, beta = this.beta, dCutoff = this.dCutoff){
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
    }
    reset(){
        this.xFilter.reset();
        this.dxFilter.reset();
        this.lastRaw = null;
        this.lastTime = null;
    }
}


// Constant-velocity Kalman filter for trusted 2D target landmarks.
// This predicts where the knee/ankle should be and soft-rejects sudden opposite-leg teleports.
class Kalman2D {
    constructor(processNoise = 0.018, measurementNoise = 0.035, gate = 0.20) {
        this.q = processNoise;
        this.r = measurementNoise;
        this.gate = gate;
        this.initialized = false;
        this.x = [0, 0, 0, 0]; // px, py, vx, vy in normalized coords/sec
        this.P = [
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ];
        this.lastTime = null;
        this.rejected = 0;
    }

    reset() {
        this.initialized = false;
        this.x = [0, 0, 0, 0];
        this.P = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
        this.lastTime = null;
        this.rejected = 0;
    }

    predict(now = performance.now()) {
        if (!this.initialized) return { x: this.x[0], y: this.x[1] };
        const dt = this.lastTime === null ? 1/30 : Math.max(0.001, Math.min(0.12, (now - this.lastTime) / 1000));
        const F = [
            [1,0,dt,0],
            [0,1,0,dt],
            [0,0,1,0],
            [0,0,0,1]
        ];
        const nx = [
            this.x[0] + dt * this.x[2],
            this.x[1] + dt * this.x[3],
            this.x[2],
            this.x[3]
        ];
        const FP = matMul(F, this.P);
        const Ft = transpose(F);
        this.P = matAdd(matMul(FP, Ft), [
            [this.q,0,0,0],
            [0,this.q,0,0],
            [0,0,this.q*4,0],
            [0,0,0,this.q*4]
        ]);
        this.x = nx;
        this.lastTime = now;
        return { x: this.x[0], y: this.x[1] };
    }

    update(point, now = performance.now(), measurementTrust = 1) {
        const meas = { x: point.x, y: point.y };
        if (!this.initialized) {
            this.initialized = true;
            this.x = [meas.x, meas.y, 0, 0];
            this.lastTime = now;
            return { ...point, x: meas.x, y: meas.y, kalmanRejected: false };
        }

        const pred = this.predict(now);
        const residual = Math.hypot(meas.x - pred.x, meas.y - pred.y);
        const trust = Math.max(0.15, Math.min(1, measurementTrust));
        const dynamicGate = this.gate + (1 - trust) * 0.08;

        // If MediaPipe suddenly jumps to the other leg, keep the prediction instead of corrupting ROM.
        if (residual > dynamicGate) {
            this.rejected++;
            return { ...point, x: pred.x, y: pred.y, visibility: Math.min(point.visibility ?? 1, 0.45), kalmanRejected: true };
        }

        this.rejected = Math.max(0, this.rejected - 1);
        const R = this.r / trust;
        const Sx = this.P[0][0] + R;
        const Sy = this.P[1][1] + R;
        const kx = [this.P[0][0]/Sx, this.P[1][0]/Sx, this.P[2][0]/Sx, this.P[3][0]/Sx];
        const ky = [this.P[0][1]/Sy, this.P[1][1]/Sy, this.P[2][1]/Sy, this.P[3][1]/Sy];
        const rx = meas.x - this.x[0];
        const ry = meas.y - this.x[1];

        for (let i=0; i<4; i++) this.x[i] += kx[i] * rx + ky[i] * ry;

        // Lightweight covariance update for H=[1,0,0,0] and H=[0,1,0,0]
        this.P[0][0] *= (1 - kx[0]);
        this.P[1][1] *= (1 - ky[1]);
        this.P[2][2] = Math.max(0.0001, this.P[2][2] * 0.98);
        this.P[3][3] = Math.max(0.0001, this.P[3][3] * 0.98);

        return { ...point, x: this.x[0], y: this.x[1], kalmanRejected: false };
    }
}

function matMul(A, B) {
    const rows = A.length, cols = B[0].length, inner = B.length;
    const out = Array.from({length: rows}, () => Array(cols).fill(0));
    for (let i=0; i<rows; i++) for (let j=0; j<cols; j++) for (let k=0; k<inner; k++) out[i][j] += A[i][k] * B[k][j];
    return out;
}
function transpose(A) { return A[0].map((_, i) => A.map(row => row[i])); }
function matAdd(A, B) { return A.map((row, i) => row.map((v, j) => v + B[i][j])); }

const LEG_IDX = {
    left:  { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, foot: 31 },
    right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, foot: 32 }
};

let workingLeg = localStorage.getItem('rehabWorkingLeg') || 'left';
let lockedLeg = workingLeg;
let pendingPhysicalLeg = null;
let pendingPhysicalLegFrames = 0;
let pendingPhysicalLegStart = null;
let targetLimbProfile = null;
let targetProfileSamples = [];
let targetProfileReady = false;
let trackingUncertain = false;
let lastUncertainReason = '—';

// Phase 1.2.7: heel-anchor + ankle-offset integrity state machine.
// Heel is the motion/contact anchor for heel slides; ankle is the clinical ROM point.
const HEEL_SCORE_TRUSTED = 70;
let lastHeelIntegrityScore = 0;
let lastHeelIntegrityReason = 'initializing';
let lastHeelTrusted = false;

// Phase 1.2.7: ankle integrity state machine.
// Visual ankle prediction can continue during bad frames, but clinical ROM/reps only update on trusted ankle frames.
const ANKLE_SCORE_TRUSTED = 80;
const ANKLE_SCORE_QUESTIONABLE = 55;
const ANKLE_RECOVERY_FRAMES = 3;
const ANKLE_FAST_RECOVERY_FRAMES = 2;
const ANKLE_FAST_RECOVERY_SCORE = 90;
let ankleIntegrityState = 'trusted'; // trusted | questionable | rejected
let ankleGoodFrames = 0;
let ankleBadFrames = 0;
let ankleQuestionableFrames = 0;
let lastAnkleIntegrityScore = 0;
let lastAnkleIntegrityReason = 'initializing';

const TARGET_PROFILE_MIN_SAMPLES = 10;
const TARGET_PROFILE_MAX_SAMPLES = 55;
const SWITCH_HOLD_MS = 550;
const SWITCH_MARGIN = 18;
const HARD_SWITCH_MARGIN = 34;

// Phase 1.2.4: motion-based working-leg lock.
// The app identifies the limb performing the prescribed exercise instead of trusting MediaPipe left/right labels.
const MOTION_OBSERVE_MS = 2800;
const MOTION_OBSERVE_MIN_SAMPLES = 18;
const MOTION_LOCK_MARGIN = 12;
const MOTION_LOCK_MIN_SCORE = 18;
let motionLockState = null;
let motionLockSource = 'manual';
let motionLockScores = { left: 0, right: 0 };
let motionLockReason = 'manual';

let lastKneeToAnkleVec = null;
let ankleVectorHoldFrames = 0;
let lastFrameAccepted = false;
let lastGoodSegmentLengths = null;
let velocityAngleLast = null;
let velocityTimeLast = null;
let velocityDebugLast = 0;
let lastTrackingScore = 0;
let lastTrackingReason = 'Checking…';
let lastGoodPts = null;
let lastGoodAngle = null;
let badTrackingFrames = 0;
let goodTrackingFrames = 0;
let lastQualityUIUpdate = 0;

// Phase 1.2 input source + debug metrics state
let activeSourceMode = 'camera';
document.body.dataset.sourceMode = 'camera';
let cameraController = null;
let testVideoObjectURL = null;
let testVideoRAF = null;
let inferenceBusy = false;
let lastTestPoseSend = 0;
let lastPoseSendAt = 0;
let lastPoseResultAt = 0;
let poseFpsEMA = 0;
let lastPoseResultDelta = 0;
let debugAcceptedFrames = 0;
let debugRejectedFrames = 0;
let debugRawAngle = null;
let debugSmoothAngle = null;
let debugLastDecision = '—';
const TEST_VIDEO_FPS = 30;
const TEST_VIDEO_INFERENCE_MS = 50; // ~20 FPS, enough for repeatable rehab tests.

// Phase 1.1 false-positive rejection thresholds.
// The calibration button can still be clicked at any time, but frames below
// these thresholds are not drawn or used for calibration/exercise logic.
const DRAW_QUALITY_MIN = 55;
const ACCEPT_QUALITY_MIN = 62;
const CALIBRATION_QUALITY_MIN = 68;
const STALE_POSE_CLEAR_FRAMES = 6;

const landmarkFilters = {};
['hip','knee','ankle','heel','shoulder','foot'].forEach(name => {
    landmarkFilters[name] = {
        x: new OneEuroFilter(30, 0.72, 0.018, 1.0),
        y: new OneEuroFilter(30, 0.72, 0.018, 1.0),
    };
});
const angleFilter = new OneEuroFilter(30, 0.9, 0.018, 1.0);
const velocityFilter = new OneEuroFilter(30, 1.2, 0.02, 1.0);
const trustedKalman = {
    hip: new Kalman2D(0.012, 0.03, 0.18),
    knee: new Kalman2D(0.014, 0.028, 0.14),
    ankle: new Kalman2D(0.018, 0.032, 0.16),
    heel: new Kalman2D(0.016, 0.028, 0.14),
    foot: new Kalman2D(0.02, 0.04, 0.20),
};

function rawLM(raw, name, leg = lockedLeg) {
    const idx = LEG_IDX[leg]?.[name] ?? LEG_IDX.left[name];
    const r = raw[idx] || { x: 0.5, y: 0.5, z: 0, visibility: 0 };
    return { x: r.x, y: r.y, z: r.z || 0, visibility: r.visibility ?? 1 };
}

function fLM(raw, name, leg = lockedLeg) {
    const r = rawLM(raw, name, leg);
    const filters = landmarkFilters[name];
    if (!filters) return r;
    const now = performance.now();
    return {
        x: filters.x.filter(r.x, now),
        y: filters.y.filter(r.y, now),
        z: r.z || 0,
        visibility: r.visibility ?? 1,
    };
}

function getLegPoints(raw, leg, smoothed = false) {
    const getter = smoothed ? (r, n) => fLM(r, n, leg) : (r, n) => rawLM(r, n, leg);
    return {
        shoulder: getter(raw, 'shoulder'),
        hip: getter(raw, 'hip'),
        knee: getter(raw, 'knee'),
        ankle: getter(raw, 'ankle'),
        heel: getter(raw, 'heel'),
        foot: getter(raw, 'foot')
    };
}

function getWorkingLegPoints(raw, smoothed = true) {
    return getLegPoints(raw, lockedLeg, smoothed);
}

function dist2(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function safeSegmentRatio(hk, ka) {
    return hk / Math.max(0.001, ka);
}

function vectorBetween(a, b) {
    return { x: b.x - a.x, y: b.y - a.y };
}

function vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalizedDot(a, b) {
    const la = vectorLength(a);
    const lb = vectorLength(b);
    if (la < 0.001 || lb < 0.001) return 0;
    return (a.x * b.x + a.y * b.y) / (la * lb);
}

function mean(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeVector(v, fallback = { x: 1, y: 0 }) {
    const len = vectorLength(v);
    if (len < 0.001) return { ...fallback };
    return { x: v.x / len, y: v.y / len };
}

function angleBetweenVectorsDeg(a, b) {
    const dot = clamp(normalizedDot(a, b), -1, 1);
    return Math.acos(dot) * 180 / Math.PI;
}

function resetTargetLimbProfile(reason = 'reset') {
    targetLimbProfile = null;
    targetProfileSamples = [];
    targetProfileReady = false;
    motionLockState = null;
    motionLockSource = 'manual';
    motionLockScores = { left: 0, right: 0 };
    motionLockReason = reason;
    pendingPhysicalLeg = null;
    pendingPhysicalLegFrames = 0;
    pendingPhysicalLegStart = null;
    trackingUncertain = false;
    lastUncertainReason = reason;
}


function createMotionLockState() {
    const now = performance.now();
    return {
        start: now,
        lastUpdate: now,
        samples: { left: [], right: [] },
        decided: false
    };
}

function makeMotionSample(raw, leg, now = performance.now()) {
    const pts = getLegPoints(raw, leg, false);
    const hk = dist2(pts.hip, pts.knee);
    const ka = dist2(pts.knee, pts.ankle);
    const kh = dist2(pts.knee, pts.heel);
    const avgVis = ((pts.hip.visibility ?? 0) + (pts.knee.visibility ?? 0) + (pts.ankle.visibility ?? 0) + (pts.heel.visibility ?? 0)) / 4;
    const angle = (avgVis > 0.25 && hk > 0.02 && ka > 0.02) ? angle3(pts.hip, pts.knee, pts.ankle) : null;
    return { t: now, pts, hk, ka, kh, avgVis, angle };
}

function rangeOf(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return 0;
    return Math.max(...finite) - Math.min(...finite);
}

function cumulativeTravel(samples, pointName) {
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
        total += dist2(samples[i - 1].pts[pointName], samples[i].pts[pointName]);
    }
    return total;
}

function stableSegmentBonus(samples) {
    if (samples.length < 4) return 0;
    const hkRange = rangeOf(samples.map(s => s.hk));
    const kaRange = rangeOf(samples.map(s => s.ka));
    const hkAvg = mean(samples.map(s => s.hk));
    const kaAvg = mean(samples.map(s => s.ka));
    const hkRel = hkRange / Math.max(0.001, hkAvg);
    const kaRel = kaRange / Math.max(0.001, kaAvg);
    return Math.max(0, 18 - (hkRel + kaRel) * 22);
}

function getMovementPattern(key) {
    if (MOVEMENT_PATTERNS[key]) return MOVEMENT_PATTERNS[key];
    return MOVEMENT_PATTERNS.default;
}

const MOVEMENT_PATTERNS = {
    heel_slide: {
        label: 'heel slide',
        score(samples) {
            const good = samples.filter(s => s.avgVis > 0.42 && Number.isFinite(s.angle));
            if (good.length < 4) return 0;
            const angleRange = rangeOf(good.map(s => s.angle));
            const heelTravel = cumulativeTravel(good, 'heel');
            const ankleTravel = cumulativeTravel(good, 'ankle');
            const kneeTravel = cumulativeTravel(good, 'knee');
            const hipTravel = cumulativeTravel(good, 'hip');
            const vis = mean(good.map(s => s.avgVis));
            // Heel slide signature: knee angle changes and the heel/contact point slides while hip stays stable.
            return (angleRange * 1.35) + (heelTravel * 285) + (ankleTravel * 110) + (kneeTravel * 70) - (hipTravel * 120) + stableSegmentBonus(good) + (vis * 8);
        }
    },
    slr: {
        label: 'straight leg raise',
        score(samples) {
            const good = samples.filter(s => s.avgVis > 0.42 && Number.isFinite(s.angle));
            if (good.length < 4) return 0;
            const ankleTravel = cumulativeTravel(good, 'ankle');
            const kneeTravel = cumulativeTravel(good, 'knee');
            const hipTravel = cumulativeTravel(good, 'hip');
            const kneeAngleStability = Math.max(0, 18 - rangeOf(good.map(s => s.angle)) * 0.5);
            // SLR signature: knee+ankle move together while knee angle stays fairly straight.
            return (ankleTravel * 250) + (kneeTravel * 180) - (hipTravel * 90) + kneeAngleStability + stableSegmentBonus(good);
        }
    },
    ankle_pumps: {
        label: 'ankle pumps',
        score(samples) {
            const good = samples.filter(s => s.avgVis > 0.42 && Number.isFinite(s.angle));
            if (good.length < 4) return 0;
            const ankleTravel = cumulativeTravel(good, 'ankle');
            const kneeTravel = cumulativeTravel(good, 'knee');
            return (ankleTravel * 260) - (kneeTravel * 120) + stableSegmentBonus(good);
        }
    },
    default: {
        label: 'generic rehab movement',
        score(samples) {
            const good = samples.filter(s => s.avgVis > 0.42 && Number.isFinite(s.angle));
            if (good.length < 4) return 0;
            const angleRange = rangeOf(good.map(s => s.angle));
            const ankleTravel = cumulativeTravel(good, 'ankle');
            const kneeTravel = cumulativeTravel(good, 'knee');
            const hipTravel = cumulativeTravel(good, 'hip');
            return (angleRange * 0.95) + (ankleTravel * 180) + (kneeTravel * 120) - (hipTravel * 80) + stableSegmentBonus(good);
        }
    }
};

function collectMotionLockFrame(raw) {
    if (!motionLockState) motionLockState = createMotionLockState();
    const now = performance.now();
    motionLockState.lastUpdate = now;
    ['left', 'right'].forEach(leg => {
        const sample = makeMotionSample(raw, leg, now);
        motionLockState.samples[leg].push(sample);
        if (motionLockState.samples[leg].length > 90) motionLockState.samples[leg].shift();
    });

    const pattern = getMovementPattern(currentEx?.key || 'default');
    motionLockScores = {
        left: Math.max(0, pattern.score(motionLockState.samples.left)),
        right: Math.max(0, pattern.score(motionLockState.samples.right))
    };

    const sampleCount = Math.min(motionLockState.samples.left.length, motionLockState.samples.right.length);
    const elapsed = now - motionLockState.start;
    const leftWins = motionLockScores.left > motionLockScores.right + MOTION_LOCK_MARGIN;
    const rightWins = motionLockScores.right > motionLockScores.left + MOTION_LOCK_MARGIN;
    const winner = leftWins ? 'left' : rightWins ? 'right' : null;
    const winningScore = winner ? motionLockScores[winner] : Math.max(motionLockScores.left, motionLockScores.right);
    const enoughSamples = sampleCount >= MOTION_OBSERVE_MIN_SAMPLES;
    const enoughTime = elapsed >= MOTION_OBSERVE_MS;

    if ((winner && enoughSamples && winningScore >= MOTION_LOCK_MIN_SCORE && elapsed >= 900) || (winner && enoughTime)) {
        return finalizeMotionLock(winner, pattern.label);
    }

    if (enoughTime && enoughSamples) {
        // Ambiguous motion. Fall back to selected leg, but explicitly mark that this was not a strong motion lock.
        return finalizeMotionLock(workingLeg, pattern.label, 'ambiguous motion fallback');
    }

    motionLockReason = `${pattern.label}: L ${Math.round(motionLockScores.left)} / R ${Math.round(motionLockScores.right)}`;
    return null;
}

function finalizeMotionLock(leg, patternLabel = 'movement', reason = 'motion signature') {
    if (!motionLockState) return null;
    lockedLeg = leg === 'right' ? 'right' : 'left';
    motionLockSource = reason === 'motion signature' ? 'motion' : 'manual-fallback';
    motionLockReason = `${reason}: ${lockedLeg} · ${patternLabel} · L ${Math.round(motionLockScores.left)} / R ${Math.round(motionLockScores.right)}`;

    targetProfileSamples = [];
    const sourceSamples = motionLockState.samples[lockedLeg] || [];
    sourceSamples.slice(-TARGET_PROFILE_MAX_SAMPLES).forEach(sample => {
        if (sample.avgVis < 0.38 || sample.hk < 0.04 || sample.ka < 0.04) return;
        targetProfileSamples.push({
            leg: lockedLeg,
            hk: sample.hk,
            ka: sample.ka,
            kh: sample.kh || dist2(sample.pts.knee, sample.pts.heel),
            ah: dist2(sample.pts.ankle, sample.pts.heel),
            ratio: safeSegmentRatio(sample.hk, sample.ka),
            kneeX: sample.pts.knee.x,
            kneeY: sample.pts.knee.y,
            ankleX: sample.pts.ankle.x,
            ankleY: sample.pts.ankle.y,
            heelX: sample.pts.heel.x,
            heelY: sample.pts.heel.y,
            hipX: sample.pts.hip.x,
            hipY: sample.pts.hip.y,
            kaVec: vectorBetween(sample.pts.knee, sample.pts.ankle),
            khVec: vectorBetween(sample.pts.knee, sample.pts.heel),
            ankleHeelVec: vectorBetween(sample.pts.ankle, sample.pts.heel),
        });
    });
    finalizeTargetLimbProfile();
    motionLockState.decided = true;
    return lockedLeg;
}

function beginMotionObservation() {
    resetTargetLimbProfile('motion observation started');
    motionLockState = createMotionLockState();
    motionLockSource = 'observing';
    motionLockScores = { left: 0, right: 0 };
    motionLockReason = 'watching for working-leg movement';
    updateTrackingQualityUI(0, 'identify working leg');
}

function collectTargetLimbSample(pts, leg = lockedLeg) {
    if (!pts) return;
    const hk = dist2(pts.hip, pts.knee);
    const ka = dist2(pts.knee, pts.ankle);
    const kh = pts.heel ? dist2(pts.knee, pts.heel) : ka;
    const ah = pts.heel ? dist2(pts.ankle, pts.heel) : 0;
    if (hk < 0.04 || ka < 0.04 || kh < 0.04 || hk > 0.65 || ka > 0.65 || kh > 0.75) return;

    targetProfileSamples.push({
        leg,
        hk,
        ka,
        kh,
        ah,
        ratio: safeSegmentRatio(hk, ka),
        kneeX: pts.knee.x,
        kneeY: pts.knee.y,
        ankleX: pts.ankle.x,
        ankleY: pts.ankle.y,
        heelX: pts.heel?.x ?? pts.ankle.x,
        heelY: pts.heel?.y ?? pts.ankle.y,
        hipX: pts.hip.x,
        hipY: pts.hip.y,
        kaVec: vectorBetween(pts.knee, pts.ankle),
        khVec: vectorBetween(pts.knee, pts.heel || pts.ankle),
        ankleHeelVec: pts.heel ? vectorBetween(pts.ankle, pts.heel) : { x: 0, y: 0 },
    });

    if (targetProfileSamples.length > TARGET_PROFILE_MAX_SAMPLES) {
        targetProfileSamples.shift();
    }
}

function finalizeTargetLimbProfile() {
    if (targetProfileSamples.length < TARGET_PROFILE_MIN_SAMPLES) return null;

    const profile = {
        createdAt: performance.now(),
        samples: targetProfileSamples.length,
        leg: lockedLeg,
        hk: mean(targetProfileSamples.map(s => s.hk)),
        ka: mean(targetProfileSamples.map(s => s.ka)),
        kh: mean(targetProfileSamples.map(s => s.kh || s.ka)),
        ah: mean(targetProfileSamples.map(s => s.ah || 0)),
        ratio: mean(targetProfileSamples.map(s => s.ratio)),
        knee: {
            x: mean(targetProfileSamples.map(s => s.kneeX)),
            y: mean(targetProfileSamples.map(s => s.kneeY)),
        },
        ankle: {
            x: mean(targetProfileSamples.map(s => s.ankleX)),
            y: mean(targetProfileSamples.map(s => s.ankleY)),
        },
        heel: {
            x: mean(targetProfileSamples.map(s => s.heelX ?? s.ankleX)),
            y: mean(targetProfileSamples.map(s => s.heelY ?? s.ankleY)),
        },
        hip: {
            x: mean(targetProfileSamples.map(s => s.hipX)),
            y: mean(targetProfileSamples.map(s => s.hipY)),
        },
        kaVec: {
            x: mean(targetProfileSamples.map(s => s.kaVec.x)),
            y: mean(targetProfileSamples.map(s => s.kaVec.y)),
        },
        khVec: {
            x: mean(targetProfileSamples.map(s => (s.khVec || s.kaVec).x)),
            y: mean(targetProfileSamples.map(s => (s.khVec || s.kaVec).y)),
        },
        ankleHeelVec: {
            x: mean(targetProfileSamples.map(s => (s.ankleHeelVec || {x:0,y:0}).x)),
            y: mean(targetProfileSamples.map(s => (s.ankleHeelVec || {x:0,y:0}).y)),
        }
    };

    targetLimbProfile = profile;
    targetProfileReady = true;
    pendingPhysicalLeg = null;
    pendingPhysicalLegFrames = 0;
    pendingPhysicalLegStart = null;
    return profile;
}

function targetProfilePenalty(pts, hk, ka) {
    if (!targetLimbProfile) return { penalty: 0, reason: null, match: 100 };

    let penalty = 0;
    let reason = null;
    const ratio = safeSegmentRatio(hk, ka);
    const ratioErr = Math.abs(ratio - targetLimbProfile.ratio) / Math.max(0.001, targetLimbProfile.ratio);
    const hkErr = Math.abs(hk - targetLimbProfile.hk) / Math.max(0.001, targetLimbProfile.hk);
    const kaErr = Math.abs(ka - targetLimbProfile.ka) / Math.max(0.001, targetLimbProfile.ka);

    if (ratioErr > 0.36 || hkErr > 0.42 || kaErr > 0.46) {
        penalty += 42;
        reason = 'target limb mismatch';
    } else if (ratioErr > 0.22 || hkErr > 0.28 || kaErr > 0.32) {
        penalty += 24;
        reason = 'target profile drift';
    }

    // Vertical band is a soft clue, not a hard rule. During heel slides the knee moves,
    // but it should not suddenly jump to the resting leg's whole screen band.
    const kneeBand = Math.abs(pts.knee.y - targetLimbProfile.knee.y);
    const ankleBand = Math.abs(pts.ankle.y - targetLimbProfile.ankle.y);
    if (kneeBand > 0.30 || ankleBand > 0.35) {
        penalty += 18;
        reason = reason || 'outside target limb region';
    }

    const currentVec = vectorBetween(pts.knee, pts.ankle);
    const dot = normalizedDot(currentVec, targetLimbProfile.kaVec);
    if (dot < -0.15) {
        penalty += 32;
        reason = reason || 'limb direction flipped';
    } else if (dot < 0.15) {
        penalty += 12;
        reason = reason || 'limb direction uncertain';
    }

    const match = Math.max(0, Math.min(100, 100 - penalty));
    return { penalty, reason, match };
}

function scoreLegCandidate(raw, leg) {
    const pts = getLegPoints(raw, leg, false);
    const required = [pts.hip, pts.knee, pts.ankle];
    const avgVis = required.reduce((sum, p) => sum + (p.visibility ?? 0), 0) / required.length;
    let score = Math.round(avgVis * 100);
    const reasons = [];

    if (avgVis < 0.45) reasons.push('show hip, knee, ankle');

    const sh = pts.shoulder;
    const torso = dist2(sh, pts.hip);
    if ((sh.visibility ?? 0) > 0.35 && (pts.hip.visibility ?? 0) > 0.35) {
        if (torso < 0.035) { score -= 18; reasons.push('torso collapsed'); }
        if (torso > 0.48) { score -= 30; reasons.push('leg disconnected from body'); }
        if (pts.hip.y < sh.y - 0.14) { score -= 22; reasons.push('body geometry invalid'); }
    } else {
        score -= 6;
    }

    if (required.some(p => p.x < -0.04 || p.x > 1.04 || p.y < -0.04 || p.y > 1.04)) {
        score -= 18;
        reasons.push('body partly out of frame');
    }

    const hk = dist2(pts.hip, pts.knee);
    const ka = dist2(pts.knee, pts.ankle);
    if (hk < 0.04 || ka < 0.04) { score -= 25; reasons.push('leg landmarks collapsed'); }
    if (hk > 0.65 || ka > 0.65) { score -= 15; reasons.push('camera too close / distorted'); }

    // Same-limb chain validation: a real femur/tibia chain should not change length suddenly.
    // This catches frames where MediaPipe mixes hip/knee from one leg with ankle from the other.
    if (lastGoodSegmentLengths) {
        const hkRatio = hk / Math.max(0.001, lastGoodSegmentLengths.hk);
        const kaRatio = ka / Math.max(0.001, lastGoodSegmentLengths.ka);
        const hkBad = hkRatio < 0.62 || hkRatio > 1.55;
        const kaBad = kaRatio < 0.58 || kaRatio > 1.65;
        if (hkBad || kaBad) {
            score -= hkBad && kaBad ? 42 : 26;
            reasons.push(hkBad && kaBad ? 'segment length mismatch' : (hkBad ? 'hip-knee mismatch' : 'knee-ankle mismatch'));
        }
    }

    // Heel slides are knee anchored. If the knee stays near the old knee but ankle jumps,
    // it is usually the opposite leg/foot being selected. Penalize that heavily.
    if (lastGoodPts && currentEx?.key === 'heel_slide') {
        const kneeJump = dist2(pts.knee, lastGoodPts.knee);
        const ankleJump = dist2(pts.ankle, lastGoodPts.ankle);
        if (kneeJump < 0.10 && ankleJump > 0.16) {
            score -= 38;
            reasons.push('ankle switched leg');
        }
    }

    let rawAngle = null;
    if (avgVis > 0.25 && hk > 0.02 && ka > 0.02) {
        rawAngle = angle3(pts.hip, pts.knee, pts.ankle);
        if (rawAngle < 5 || rawAngle > 178) score -= 6;
        if (lastGoodAngle !== null) {
            const jump = Math.abs(rawAngle - lastGoodAngle);
            if (jump > 45) { score -= 35; reasons.push('angle jumped'); }
            else if (jump > 28) { score -= 18; reasons.push('angle unstable'); }
        }
    } else {
        score -= 20;
        reasons.push('angle unavailable');
    }

    // Physical limb continuity: once a limb is being tracked, choose the candidate
    // closest to the last good hip/knee/ankle rather than blindly trusting MediaPipe's left/right labels.
    let anchorDist = null;
    if (lastGoodPts) {
        const kneeJump = dist2(pts.knee, lastGoodPts.knee);
        const ankleJump = dist2(pts.ankle, lastGoodPts.ankle);
        const hipJump = dist2(pts.hip, lastGoodPts.hip);
        anchorDist = kneeJump * 1.65 + ankleJump * 1.15 + hipJump * 0.75;

        score -= Math.min(65, Math.round(anchorDist * 160));
        if (anchorDist > 0.24 || kneeJump > 0.15 || ankleJump > 0.20 || hipJump > 0.14) {
            score -= 25;
            reasons.push('wrong physical limb');
        }
    } else if (leg !== workingLeg) {
        // Before physical lock exists, prefer the user-selected leg unless the other leg is clearly better.
        score -= 12;
    }

    const profileCheck = targetProfilePenalty(pts, hk, ka);
    if (profileCheck.penalty > 0) {
        score -= profileCheck.penalty;
        if (profileCheck.reason) reasons.push(profileCheck.reason);
    }

    score = Math.max(0, Math.min(100, score));
    return {
        leg,
        score,
        ok: score >= ACCEPT_QUALITY_MIN,
        rawAngle,
        pts,
        anchorDist,
        targetMatch: profileCheck.match,
        reason: reasons.length ? reasons[0] : 'good tracking'
    };
}

function evaluateTrackingQuality(raw) {
    const candidates = [scoreLegCandidate(raw, 'left'), scoreLegCandidate(raw, 'right')];
    const current = candidates.find(c => c.leg === lockedLeg) || candidates[0];
    const best = candidates.slice().sort((a, b) => b.score - a.score)[0];
    const now = performance.now();

    let chosen = current;
    trackingUncertain = false;
    lastUncertainReason = '—';

    if (!lastGoodPts && !targetLimbProfile) {
        // Before the target identity exists, honor the user's starting selection unless the other leg is clearly better.
        const selected = candidates.find(c => c.leg === workingLeg) || current;
        chosen = best.score > selected.score + 24 ? best : selected;
        lockedLeg = chosen.leg;
        return chosen;
    }

    // Motion-locked mode: do not chase the other leg during overlap.
    // If the target limb becomes uncertain, pause/hold ROM rather than switching to a plausible wrong limb.
    if (targetProfileReady && motionLockSource === 'motion') {
        if (current.score >= ACCEPT_QUALITY_MIN - 6 && current.targetMatch >= 54) {
            return current;
        }
        if (best.leg !== lockedLeg && best.score > current.score + HARD_SWITCH_MARGIN && best.targetMatch >= 86) {
            if (pendingPhysicalLeg === best.leg && pendingPhysicalLegStart !== null) {
                pendingPhysicalLegFrames++;
            } else {
                pendingPhysicalLeg = best.leg;
                pendingPhysicalLegFrames = 1;
                pendingPhysicalLegStart = now;
            }
            if ((now - pendingPhysicalLegStart) >= 1200 && pendingPhysicalLegFrames >= 6) {
                lockedLeg = best.leg;
                pendingPhysicalLeg = null;
                pendingPhysicalLegFrames = 0;
                pendingPhysicalLegStart = null;
                return best;
            }
        }
        trackingUncertain = true;
        lastUncertainReason = current.reason || 'target limb uncertain';
        return { ...current, ok: false, reason: current.reason === 'good tracking' ? 'target limb uncertain' : current.reason };
    }

    if (best.leg !== lockedLeg && best.score > current.score + SWITCH_MARGIN) {
        const passesTargetGate = !targetLimbProfile || best.targetMatch >= 70;
        const veryStrongWin = best.score > current.score + HARD_SWITCH_MARGIN && passesTargetGate;

        if (passesTargetGate) {
            if (pendingPhysicalLeg === best.leg && pendingPhysicalLegStart !== null) {
                pendingPhysicalLegFrames++;
            } else {
                pendingPhysicalLeg = best.leg;
                pendingPhysicalLegFrames = 1;
                pendingPhysicalLegStart = now;
            }

            const heldLongEnough = (now - pendingPhysicalLegStart) >= SWITCH_HOLD_MS;
            const enoughFrames = pendingPhysicalLegFrames >= 4;

            if ((heldLongEnough && enoughFrames) || veryStrongWin) {
                lockedLeg = best.leg;
                chosen = best;
                pendingPhysicalLeg = null;
                pendingPhysicalLegFrames = 0;
                pendingPhysicalLegStart = null;
            } else {
                trackingUncertain = true;
                lastUncertainReason = `holding target limb · candidate ${best.leg}`;
                chosen = {
                    ...current,
                    score: Math.max(0, Math.min(current.score, best.score - 10)),
                    ok: current.score >= ACCEPT_QUALITY_MIN,
                    reason: 'holding target limb lock'
                };
            }
        } else {
            trackingUncertain = true;
            lastUncertainReason = `other limb rejected · ${best.reason}`;
            pendingPhysicalLeg = null;
            pendingPhysicalLegFrames = 0;
            pendingPhysicalLegStart = null;
            chosen = { ...current, reason: current.reason === 'good tracking' ? 'other limb rejected' : current.reason };
        }
    } else {
        pendingPhysicalLeg = null;
        pendingPhysicalLegFrames = 0;
        pendingPhysicalLegStart = null;

        // If current limb is still plausible, stay locked even if the other limb is only slightly better.
        if (current.score >= Math.max(ACCEPT_QUALITY_MIN - 8, best.score - 14)) {
            chosen = current;
        } else {
            chosen = best;
            if (chosen.score >= ACCEPT_QUALITY_MIN && (!targetLimbProfile || chosen.targetMatch >= 70)) {
                lockedLeg = chosen.leg;
            }
        }
    }

    if (targetLimbProfile && chosen.targetMatch < 58) {
        trackingUncertain = true;
        lastUncertainReason = chosen.reason || 'target limb lost';
        chosen = { ...chosen, ok: false, reason: chosen.reason || 'target limb lost' };
    }

    return chosen;
}

function tuneFiltersForMotion(rawVelDegPerSec = 0) {
    const calibrating = calState === 'waiting_pos1' || calState === 'waiting_pos2';
    const holding = phase === 'hold' || phase === 'straight';

    let landmarkMin = 0.72, landmarkBeta = 0.018;
    let angleMin = 0.9, angleBeta = 0.018;

    if (calibrating || holding) {
        // Stronger smoothing when the user should be still.
        landmarkMin = 0.62; landmarkBeta = 0.012;
        angleMin = 0.75; angleBeta = 0.012;
    } else if (rawVelDegPerSec > 90) {
        // Open the filter during fast motion to reduce lag, then the app can cue “slow down.”
        landmarkMin = 1.35; landmarkBeta = 0.055;
        angleMin = 1.9; angleBeta = 0.075;
    } else if (rawVelDegPerSec > 35) {
        landmarkMin = 1.05; landmarkBeta = 0.038;
        angleMin = 1.35; angleBeta = 0.05;
    }

    Object.values(landmarkFilters).forEach(f => {
        f.x.setTuning(landmarkMin, landmarkBeta, 1.0);
        f.y.setTuning(landmarkMin, landmarkBeta, 1.0);
    });
    angleFilter.setTuning(angleMin, angleBeta, 1.0);
}


function getShinLengthRef(knee, rawAnkle) {
    if (targetLimbProfile?.ka && targetLimbProfile.ka > 0.03) return targetLimbProfile.ka;
    if (lastGoodSegmentLengths?.ka && lastGoodSegmentLengths.ka > 0.03) return lastGoodSegmentLengths.ka;
    if (lastGoodPts?.knee && lastGoodPts?.ankle) return dist2(lastGoodPts.knee, lastGoodPts.ankle);
    return Math.max(0.04, dist2(knee, rawAnkle));
}

function getHeelLengthRef(knee, rawHeel) {
    if (targetLimbProfile?.kh && targetLimbProfile.kh > 0.03) return targetLimbProfile.kh;
    if (lastGoodPts?.knee && lastGoodPts?.heel) return dist2(lastGoodPts.knee, lastGoodPts.heel);
    return Math.max(0.04, dist2(knee, rawHeel));
}

function getAnkleHeelOffsetRef() {
    if (targetLimbProfile?.ankleHeelVec && vectorLength(targetLimbProfile.ankleHeelVec) > 0.004) {
        return targetLimbProfile.ankleHeelVec;
    }
    if (lastGoodPts?.ankle && lastGoodPts?.heel) {
        return vectorBetween(lastGoodPts.ankle, lastGoodPts.heel);
    }
    return null;
}

function makeVirtualAnkle(knee, rawAnkle, predictedAnkle, shinLengthRef) {
    let dir = null;
    if (predictedAnkle && Number.isFinite(predictedAnkle.x) && Number.isFinite(predictedAnkle.y) && dist2(knee, predictedAnkle) > 0.015) {
        dir = normalizeVector(vectorBetween(knee, predictedAnkle));
    } else if (lastKneeToAnkleVec && vectorLength(lastKneeToAnkleVec) > 0.015) {
        dir = normalizeVector(lastKneeToAnkleVec);
    } else if (rawAnkle && dist2(knee, rawAnkle) > 0.015) {
        dir = normalizeVector(vectorBetween(knee, rawAnkle));
    } else {
        dir = { x: -1, y: 0.05 };
    }
    return {
        x: knee.x + dir.x * shinLengthRef,
        y: knee.y + dir.y * shinLengthRef,
        visibility: 0.35,
        virtualAnkle: true
    };
}

function makeHeelDerivedAnkle(knee, heel, predictedAnkle, shinLengthRef) {
    const offset = getAnkleHeelOffsetRef();
    let candidate = null;
    if (heel && offset && vectorLength(offset) > 0.004) {
        // offset is ankle→heel, so ankle = heel - offset.
        candidate = { x: heel.x - offset.x, y: heel.y - offset.y, visibility: heel.visibility ?? 0.55, heelDerived: true };
    } else if (predictedAnkle) {
        candidate = predictedAnkle;
    } else if (lastGoodPts?.ankle) {
        candidate = lastGoodPts.ankle;
    }

    if (!candidate) return makeVirtualAnkle(knee, heel, predictedAnkle, shinLengthRef);
    const dir = normalizeVector(vectorBetween(knee, candidate), lastKneeToAnkleVec ? normalizeVector(lastKneeToAnkleVec) : { x: -1, y: 0.05 });
    return {
        x: knee.x + dir.x * shinLengthRef,
        y: knee.y + dir.y * shinLengthRef,
        visibility: Math.max(0.35, heel?.visibility ?? 0.45),
        virtualAnkle: true,
        heelDerived: true
    };
}

function blendPoints(a, b, weightA = 0.7) {
    const wa = clamp(weightA, 0, 1);
    const wb = 1 - wa;
    return {
        ...b,
        x: a.x * wa + b.x * wb,
        y: a.y * wa + b.y * wb,
        visibility: Math.min(a.visibility ?? 0.45, b.visibility ?? 1),
        virtualAnkle: true
    };
}

function scoreHeelIntegrity(knee, rawHeel, rawPts, predictedHeel) {
    const heelLengthRef = getHeelLengthRef(knee, rawHeel);
    const currentLen = dist2(knee, rawHeel);
    const ratio = currentLen / Math.max(0.001, heelLengthRef);
    const reasons = [];
    let score = 0;

    if (ratio >= 0.72 && ratio <= 1.32) score += 25;
    else if (ratio >= 0.62 && ratio <= 1.45) { score += 12; reasons.push('heel length soft'); }
    else reasons.push('heel length invalid');

    const heelJump = lastGoodPts?.heel ? dist2(rawHeel, lastGoodPts.heel) : 0;
    const kneeJump = lastGoodPts?.knee ? dist2(knee, lastGoodPts.knee) : 0;
    if (!lastGoodPts?.heel) score += 20;
    else if (kneeJump < 0.08 && heelJump > 0.16) reasons.push('heel teleport');
    else if (heelJump > 0.24) { score += 6; reasons.push('heel jump soft'); }
    else score += 20;

    const kalmanReady = trustedKalman.heel?.initialized;
    const corridorError = kalmanReady && predictedHeel ? dist2(rawHeel, predictedHeel) : 0;
    if (!kalmanReady) score += 25;
    else if (corridorError <= 0.09) score += 25;
    else if (corridorError <= 0.16) { score += 13; reasons.push('heel corridor soft'); }
    else reasons.push('heel outside corridor');

    const heelConf = rawPts?.heel?.visibility ?? rawHeel.visibility ?? 1;
    if (heelConf >= 0.68) score += 20;
    else if (heelConf >= 0.45) { score += 10; reasons.push('heel confidence soft'); }
    else reasons.push('heel confidence low');

    if (targetLimbProfile?.heel) {
        const band = Math.abs(rawHeel.y - targetLimbProfile.heel.y);
        if (band <= 0.18) score += 10;
        else if (band <= 0.30) { score += 4; reasons.push('heel band soft'); }
        else reasons.push('heel outside path');
    } else {
        score += 10;
    }

    if (ratio < 0.62 || ratio > 1.45) score = Math.min(score, 45);
    if (lastGoodPts?.heel && kneeJump < 0.08 && heelJump > 0.16) score = Math.min(score, 50);
    if (kalmanReady && corridorError > 0.16) score = Math.min(score, 54);

    score = Math.round(clamp(score, 0, 100));
    return { score, heelLengthRef, ratio, corridorError, heelJump, kneeJump, reason: reasons[0] || 'heel trusted' };
}

function resolveHeelAnchor(pts, rawPts, quality) {
    const now = performance.now();
    const knee = pts.knee;
    const rawHeel = pts.heel || rawPts?.heel || pts.ankle;
    const predictedHeel = trustedKalman.heel?.initialized ? trustedKalman.heel.predict(now) : null;
    const integrity = scoreHeelIntegrity(knee, rawHeel, rawPts, predictedHeel);
    const trusted = integrity.score >= HEEL_SCORE_TRUSTED;
    const trust = Math.max(0.2, Math.min(1, (quality?.score ?? 70) / 100));
    const rawVis = rawPts?.heel?.visibility ?? rawHeel.visibility ?? 1;
    const measurementTrust = Math.min(trust, Math.max(0.2, rawVis));

    let heel = rawHeel;
    if (trusted) {
        const updated = trustedKalman.heel.update(rawHeel, now, measurementTrust);
        heel = updated.kalmanRejected ? (predictedHeel || lastGoodPts?.heel || rawHeel) : updated;
    } else if (predictedHeel) {
        heel = { ...predictedHeel, visibility: 0.35, virtualHeel: true };
    } else if (lastGoodPts?.heel) {
        heel = { ...lastGoodPts.heel, visibility: 0.35, virtualHeel: true };
    }

    lastHeelIntegrityScore = integrity.score;
    lastHeelIntegrityReason = integrity.reason;
    lastHeelTrusted = trusted;
    return { heel, trusted, score: integrity.score, reason: integrity.reason, details: integrity };
}

function scoreAnkleIntegrity(knee, rawAnkle, rawPts, predictedAnkle, heelAnchor) {
    const shinLengthRef = getShinLengthRef(knee, rawAnkle);
    const currentLen = dist2(knee, rawAnkle);
    const ratio = currentLen / Math.max(0.001, shinLengthRef);
    const reasons = [];
    let score = 0;

    if (ratio >= 0.78 && ratio <= 1.22) score += 25;
    else if (ratio >= 0.68 && ratio <= 1.35) { score += 12; reasons.push('shin length soft'); }
    else reasons.push('shin length invalid');

    const ankleJump = lastGoodPts ? dist2(rawAnkle, lastGoodPts.ankle) : 0;
    const kneeJump = lastGoodPts ? dist2(knee, lastGoodPts.knee) : 0;
    if (!lastGoodPts) score += 16;
    else if (kneeJump < 0.08 && ankleJump > 0.14) reasons.push('ankle teleport');
    else if (ankleJump > 0.22) { score += 4; reasons.push('ankle jump soft'); }
    else score += 16;

    const kalmanReady = trustedKalman.ankle?.initialized;
    const corridorError = kalmanReady && predictedAnkle ? dist2(rawAnkle, predictedAnkle) : 0;
    if (!kalmanReady) score += 18;
    else if (corridorError <= 0.08) score += 18;
    else if (corridorError <= 0.14) { score += 9; reasons.push('ankle corridor soft'); }
    else reasons.push('ankle outside corridor');

    const currentVec = vectorBetween(knee, rawAnkle);
    let vectorAngle = 0;
    if (!lastKneeToAnkleVec || vectorLength(lastKneeToAnkleVec) < 0.015) score += 12;
    else {
        vectorAngle = angleBetweenVectorsDeg(currentVec, lastKneeToAnkleVec);
        if (vectorAngle <= 30) score += 12;
        else if (vectorAngle <= 45) { score += 6; reasons.push('shin vector soft'); }
        else reasons.push('shin vector flipped');
    }

    // Heel-ankle relationship: if raw ankle drifts toward the forefoot/top-foot, reject it.
    let heelDerivedError = 0;
    let heelRelationScore = 0;
    if (heelAnchor) {
        const heelDerived = makeHeelDerivedAnkle(knee, heelAnchor, predictedAnkle, shinLengthRef);
        heelDerivedError = dist2(rawAnkle, heelDerived);
        if (heelDerivedError <= 0.055) { score += 20; heelRelationScore = 20; }
        else if (heelDerivedError <= 0.105) { score += 10; heelRelationScore = 10; reasons.push('ankle heel-offset soft'); }
        else reasons.push('ankle drifting from heel');

        const refAH = targetLimbProfile?.ah || (lastGoodPts?.heel ? dist2(lastGoodPts.ankle, lastGoodPts.heel) : null);
        if (refAH && refAH > 0.004) {
            const ah = dist2(rawAnkle, heelAnchor);
            const ahRatio = ah / Math.max(0.001, refAH);
            if (ahRatio < 0.45 || ahRatio > 1.85) {
                reasons.push('ankle-heel offset invalid');
                score = Math.min(score, 58);
            }
        }
    } else {
        reasons.push('heel anchor unavailable');
    }

    const toe = rawPts?.foot;
    const rawHeel = rawPts?.heel || heelAnchor;
    if (toe && rawHeel && (toe.visibility ?? 0) > 0.35 && (rawHeel.visibility ?? 0) > 0.35) {
        const dToe = dist2(rawAnkle, toe);
        const dHeel = dist2(rawAnkle, rawHeel);
        if (dToe < dHeel * 0.78) {
            reasons.push('ankle drifting toward forefoot');
            score = Math.min(score, 60);
        }
    }

    const ankleConf = rawPts?.ankle?.visibility ?? rawAnkle.visibility ?? 1;
    if (ankleConf >= 0.70) score += 9;
    else if (ankleConf >= 0.45) { score += 4; reasons.push('ankle confidence soft'); }
    else reasons.push('ankle confidence low');

    if (ratio < 0.68 || ratio > 1.35) score = Math.min(score, 45);
    if (lastGoodPts && kneeJump < 0.08 && ankleJump > 0.14) score = Math.min(score, 50);
    if (kalmanReady && corridorError > 0.14) score = Math.min(score, 54);
    if (lastKneeToAnkleVec && vectorAngle > 45) score = Math.min(score, 54);
    if (heelAnchor && heelDerivedError > 0.105) score = Math.min(score, 58);

    score = Math.round(clamp(score, 0, 100));
    return { score, shinLengthRef, ratio, corridorError, ankleJump, kneeJump, heelDerivedError, heelRelationScore, reason: reasons[0] || 'ankle trusted' };
}

function updateAnkleIntegrityState(score, reason) {
    lastAnkleIntegrityScore = score;
    lastAnkleIntegrityReason = reason;
    if (score >= ANKLE_SCORE_TRUSTED) {
        ankleGoodFrames++;
        ankleBadFrames = 0;
        ankleQuestionableFrames = 0;
        const recovered = ankleGoodFrames >= ANKLE_RECOVERY_FRAMES || (score >= ANKLE_FAST_RECOVERY_SCORE && ankleGoodFrames >= ANKLE_FAST_RECOVERY_FRAMES);
        if (ankleIntegrityState === 'trusted' || recovered) ankleIntegrityState = 'trusted';
        else ankleIntegrityState = 'questionable';
    } else if (score >= ANKLE_SCORE_QUESTIONABLE) {
        ankleGoodFrames = 0;
        ankleBadFrames = 0;
        ankleQuestionableFrames++;
        ankleIntegrityState = 'questionable';
    } else {
        ankleGoodFrames = 0;
        ankleQuestionableFrames = 0;
        ankleBadFrames++;
        ankleIntegrityState = 'rejected';
    }
    return ankleIntegrityState;
}

function resolveAnkleIntegrity(pts, rawPts, quality) {
    const now = performance.now();
    const knee = pts.knee;
    const rawAnkle = pts.ankle;
    const predictedAnkle = trustedKalman.ankle?.initialized ? trustedKalman.ankle.predict(now) : null;
    const heelResult = resolveHeelAnchor(pts, rawPts, quality);
    const integrity = scoreAnkleIntegrity(knee, rawAnkle, rawPts, predictedAnkle, heelResult.heel);
    const state = updateAnkleIntegrityState(integrity.score, integrity.reason);
    const heelDerivedAnkle = makeHeelDerivedAnkle(knee, heelResult.heel, predictedAnkle, integrity.shinLengthRef);
    const virtualAnkle = heelResult.trusted
        ? heelDerivedAnkle
        : makeVirtualAnkle(knee, rawAnkle, predictedAnkle, integrity.shinLengthRef);
    const trust = Math.max(0.2, Math.min(1, (quality?.score ?? 70) / 100));
    const rawVis = rawPts?.ankle?.visibility ?? rawAnkle.visibility ?? 1;
    const measurementTrust = Math.min(trust, Math.max(0.2, rawVis));

    let ankle = virtualAnkle;
    let clinicalTrusted = false;
    if (state === 'trusted' && heelResult.trusted) {
        const updated = trustedKalman.ankle.update(rawAnkle, now, measurementTrust);
        if (updated.kalmanRejected) {
            ankleIntegrityState = 'questionable';
            ankleGoodFrames = 0;
            ankleQuestionableFrames++;
            ankle = heelDerivedAnkle;
            integrity.reason = 'kalman rejected ankle';
        } else {
            ankle = updated;
            clinicalTrusted = true;
        }
    } else if (state === 'questionable') {
        ankle = heelResult.trusted ? blendPoints(heelDerivedAnkle, rawAnkle, 0.75) : blendPoints(virtualAnkle, rawAnkle, 0.80);
    }

    const displayDistal = heelResult.heel || ankle;
    return {
        ankle: { ...ankle, integrityScore: integrity.score, integrityState: ankleIntegrityState },
        heel: { ...displayDistal, heelScore: heelResult.score, heelTrusted: heelResult.trusted },
        foot: { ...displayDistal, integrityScore: integrity.score, integrityState: ankleIntegrityState },
        displayDistal,
        clinicalTrusted,
        score: integrity.score,
        state: ankleIntegrityState,
        reason: heelResult.trusted ? integrity.reason : `heel ${heelResult.reason}`,
        heel: heelResult,
        details: integrity
    };
}

function stabilizeAnkleVector(pts, rawPts) {
    if (!pts) return pts;

    const ankleConf = rawPts?.ankle?.visibility ?? pts.ankle.visibility ?? 1;
    const ankleJump = lastGoodPts ? dist2(pts.ankle, lastGoodPts.ankle) : 0;
    const kneeJump = lastGoodPts ? dist2(pts.knee, lastGoodPts.knee) : 0;
    const heelSlideAnkleSwitch = currentEx?.key === 'heel_slide' && kneeJump < 0.10 && ankleJump > 0.14;
    const shouldHoldVector = lastGoodPts && lastKneeToAnkleVec && (ankleConf < 0.55 || ankleJump > 0.18 || heelSlideAnkleSwitch);

    if (shouldHoldVector && ankleVectorHoldFrames < 10) {
        ankleVectorHoldFrames++;
        const heldAnkle = {
            ...pts.ankle,
            x: pts.knee.x + lastKneeToAnkleVec.x,
            y: pts.knee.y + lastKneeToAnkleVec.y,
            visibility: Math.max(0.35, ankleConf)
        };
        return {
            ...pts,
            ankle: heldAnkle,
            foot: heldAnkle
        };
    }

    ankleVectorHoldFrames = 0;
    lastKneeToAnkleVec = {
        x: pts.ankle.x - pts.knee.x,
        y: pts.ankle.y - pts.knee.y
    };
    return pts;
}

function updateTrackingQualityUI(score = lastTrackingScore, reason = lastTrackingReason) {
    const now = performance.now();
    if (now - lastQualityUIUpdate < 120) return;
    lastQualityUIUpdate = now;

    lastTrackingScore = score;
    lastTrackingReason = reason;

    if (!trackingQualityEl || !trackingQualityText) return;

    trackingQualityEl.classList.remove('good', 'warn', 'bad');
    if (score >= 75) trackingQualityEl.classList.add('good');
    else if (score >= 55) trackingQualityEl.classList.add('warn');
    else trackingQualityEl.classList.add('bad');

    trackingQualityText.textContent = `${score}% · ${reason}`;
}



function applyTrustedKalman(pts, rawPts, quality) {
    if (!pts) return pts;
    const now = performance.now();
    const trust = Math.max(0.2, Math.min(1, (quality?.score ?? 70) / 100));
    const out = { ...pts };

    ['hip', 'knee'].forEach(name => {
        const src = pts[name];
        if (!src || !trustedKalman[name]) return;
        const rawVis = rawPts?.[name]?.visibility ?? src.visibility ?? 1;
        const measurementTrust = Math.min(trust, Math.max(0.2, rawVis));
        out[name] = trustedKalman[name].update(src, now, measurementTrust);
    });

    const ankleResult = resolveAnkleIntegrity({ ...pts, hip: out.hip, knee: out.knee }, rawPts, quality);
    out.ankle = ankleResult.ankle;
    out.heel = ankleResult.heel;
    out.foot = ankleResult.foot;
    out.displayDistal = ankleResult.displayDistal;
    out.ankleIntegrity = ankleResult;
    out.clinicalTrusted = ankleResult.clinicalTrusted;

    trackingUncertain = !ankleResult.clinicalTrusted;
    lastUncertainReason = ankleResult.clinicalTrusted ? 'trusted' : `${ankleResult.state}: ${ankleResult.reason}`;

    if (!ankleResult.clinicalTrusted) {
        debugLastDecision = `ankle ${ankleResult.state} · ${ankleResult.score}% · ${ankleResult.reason}`;
    }

    return out;
}


function drawSmoothedWorkingLeg(pts) {
    if (!pts) return;
    const state = pts.ankleIntegrity?.state || (pts.clinicalTrusted === false ? 'questionable' : 'trusted');
    const alpha = state === 'trusted' ? 0.95 : (state === 'questionable' ? 0.55 : 0.34);
    const lineWidth = state === 'trusted' ? 5 : 4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = state === 'trusted' ? 'rgba(45, 212, 191, 0.95)' : 'rgba(255, 183, 77, 0.90)';
    ctx.fillStyle = state === 'trusted' ? '#38BDF8' : '#FFB74D';
    ctx.shadowColor = state === 'trusted' ? 'rgba(56,189,248,0.55)' : 'rgba(255,183,77,0.35)';
    ctx.shadowBlur = 8;

    const chain = [pts.hip, pts.knee, pts.displayDistal || pts.heel || pts.ankle];
    if (state !== 'trusted') ctx.setLineDash([10, 8]);

    ctx.beginPath();
    chain.forEach((p, i) => {
        const x = p.x * canvasEl.width;
        const y = p.y * canvasEl.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    chain.forEach((p, i) => {
        const x = p.x * canvasEl.width;
        const y = p.y * canvasEl.height;
        ctx.beginPath();
        ctx.arc(x, y, i === 2 && state !== 'trusted' ? 6 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#061D24';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    ctx.restore();
}

function resetKF(){
    Object.values(landmarkFilters).forEach(f => { f.x.reset(); f.y.reset(); });
    angleFilter.reset();
    velocityFilter.reset();
    Object.values(trustedKalman).forEach(k => k.reset());
    lastGoodPts = null;
    lastGoodAngle = null;
    lastKneeToAnkleVec = null;
    lastGoodSegmentLengths = null;
    velocityAngleLast = null;
    velocityTimeLast = null;
    velocityDebugLast = 0;
    velHist = [];
    lastVelT = performance.now();
    ankleVectorHoldFrames = 0;
    pendingPhysicalLeg = null;
    pendingPhysicalLegFrames = 0;
    pendingPhysicalLegStart = null;
    trackingUncertain = false;
    lastUncertainReason = 'reset';
    ankleIntegrityState = 'trusted';
    ankleGoodFrames = 0;
    ankleBadFrames = 0;
    ankleQuestionableFrames = 0;
    lastAnkleIntegrityScore = 0;
    lastAnkleIntegrityReason = 'reset';
    lastHeelIntegrityScore = 0;
    lastHeelIntegrityReason = 'reset';
    lastHeelTrusted = false;
    badTrackingFrames = 0;
    goodTrackingFrames = 0;
}

function setWorkingLeg(leg) {
    workingLeg = leg === 'right' ? 'right' : 'left';
    lockedLeg = workingLeg;
    localStorage.setItem('rehabWorkingLeg', workingLeg);
    legLeftBtn?.classList.toggle('active', workingLeg === 'left');
    legRightBtn?.classList.toggle('active', workingLeg === 'right');
    resetTargetLimbProfile('working leg changed');
    resetKF();
    updateTrackingQualityUI(0, `${workingLeg} leg selected`);
}

legLeftBtn?.addEventListener('click', () => setWorkingLeg('left'));
legRightBtn?.addEventListener('click', () => setWorkingLeg('right'));
// setWorkingLeg(workingLeg) is called after engine state is declared during window load.
// ================================================================
// ENGINE STATE
// ================================================================
let currentPhase    = 1;
let currentEx       = null;
let calState        = 'idle';
let calStep         = 0;
let calBuf          = [];
let calStillStart   = null;
let calLastSec      = -1;
let calMin          = 70, calMax = 170;
let initHipX        = null, initHipY = null;
let phase           = 'straight';
let phaseStart      = null;
let lastPhaseSpoken = '';
let targetReps      = 10, targetSets = 3;
let T_STR=2000,T_PEAK=3000,T_HOLD=2000,T_RET=3000;
let maxRom=180,minRom=0,romActive=true,romFrozen=false;
let repCount=0,setCount=0;
let lastAngle=165,lastVelT=performance.now();
let velHist=[],lagCnt=0,lastSpoken='',frameCnt=0,sigLostFr=0;
// Session accumulators
let sxPeakRom=0,sxMinRom=999,sxCompLog={hipHike:0,trunkLean:0,limbInst:0};
let sxTotalFr=0,sxRepLog=[],sxCompTags=[];
const CAL_MS=2500,CAL_WIN=18,CAL_THR=10,CAL_THR_LR=16;
const CONF=0.52,SIG_FR=12,SKIP=2;

// ================================================================
// SIGNAL TOAST (non-blocking)
// ================================================================
function showSignalToast(show) {
    if (!signalOverlay) return;
    signalOverlay.classList.toggle('hidden', !show);
}

// ================================================================
// SPEECH
// ================================================================
function speak(msg,force=false){
    if(!force&&msg===lastSpoken)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(msg);
    u.rate=1.05;
    window.speechSynthesis.speak(u);
    lastSpoken=msg;
}

// ================================================================
// GEOMETRY
// ================================================================
function angle3(a,b,c){
    const r1=Math.atan2(c.y-b.y,c.x-b.x),r2=Math.atan2(a.y-b.y,a.x-b.x);
    let v=Math.abs((r1-r2)*180/Math.PI);
    return Math.round(v>180?360-v:v);
}

// ================================================================
// LIMB SWAP GUARD
// ================================================================
function limbSwapped(hip,knee,ankle,sh){
    if((hip.y-knee.y)>0.45)return true;
    if(sh&&Math.abs(knee.x-sh.x)>0.55)return true;
    return false;
}

// ================================================================
// VELOCITY TARGET BAND
// ================================================================
// Band maps 0–200°/s to 0–100% position on the bar
// Target zone: 20–60°/s (slow, controlled rehab movement)
let TARGET_LOW=20, TARGET_HIGH=60; const VEL_MAX=200;
function updateVelBand(vel){
    const pct=Math.min(100,Math.max(0,(vel/VEL_MAX)*100));
    if(velMarker) velMarker.style.left=pct+'%';
    // Color marker by zone
    const inTarget=vel>=TARGET_LOW&&vel<=TARGET_HIGH;
    if(velMarker) velMarker.style.background=inTarget?'#1B5E20':vel<TARGET_LOW?'#1565C0':'#B71C1C';

    recordTelemetry('velocity', { velocity: vel, inTarget, timestamp: Date.now() });

    if (vel > TARGET_HIGH * 1.35) {
        forceModuleVisible('velocity', 'Velocity safety override');
        recordTelemetry('safety_event', {
            type: 'excessive_velocity',
            velocity: vel,
            threshold: TARGET_HIGH,
            timestamp: Date.now()
        });
    }
}

function updateVelocityZone(){
    const zone = document.querySelector('.vel-target-zone');
    if(!zone)return;

    const left = Math.min(100, Math.max(0, (TARGET_LOW / VEL_MAX) * 100));
    const right = Math.min(100, Math.max(left + 1, (TARGET_HIGH / VEL_MAX) * 100));

    zone.style.left = left + '%';
    zone.style.width = (right - left) + '%';
}

// Shared velocity update used by both live camera and uploaded test videos.
// It intentionally uses performance.now() in both modes so Test Video Mode behaves like a live camera stream.
function updateVelocityFromAngle(angle) {
    if (!Number.isFinite(angle)) return;

    const now = performance.now();
    if (velocityAngleLast === null || velocityTimeLast === null) {
        velocityAngleLast = angle;
        velocityTimeLast = now;
        lastVelT = now;
        return;
    }

    const dt = Math.max(0.001, (now - velocityTimeLast) / 1000);
    // Avoid bogus spikes after pauses, tab switches, or frame stepping delays.
    if (dt > 0.75) {
        velocityAngleLast = angle;
        velocityTimeLast = now;
        lastVelT = now;
        return;
    }

    const instantVel = Math.abs(angle - velocityAngleLast) / dt;
    velocityDebugLast = instantVel;
    const filteredVel = velocityFilter.filter(instantVel, now);

    velHist.push(filteredVel);
    if (velHist.length > 6) velHist.shift();
    const avg = velHist.reduce((a, b) => a + b, 0) / velHist.length;
    updateVelBand(avg);

    velocityAngleLast = angle;
    velocityTimeLast = now;
    lastVelT = now;
}

// ================================================================
// FORM STATUS CARD
// ================================================================
function setFormStable(){
    formIcon.innerHTML='<svg viewBox="0 0 40 40" class="form-svg stable"><circle cx="20" cy="20" r="18" fill="#1B5E20"/><polyline points="11,20 17,27 29,13" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    formLabel.textContent='STABLE';
    formLabel.className='form-label stable';
}
function setFormWarning(msg){
    formIcon.innerHTML='<svg viewBox="0 0 40 40" class="form-svg warn"><circle cx="20" cy="20" r="18" fill="#E65100"/><text x="20" y="27" text-anchor="middle" fill="white" font-size="22" font-weight="bold">!</text></svg>';
    formLabel.textContent=msg||'FORM BREAK';
    formLabel.className='form-label warn';
}

// ================================================================
// PHASE + EXERCISE INIT
// ================================================================
phaseDropdown.addEventListener('change',()=>{
    const p=parseInt(phaseDropdown.value);
    loadPhase(p);
});
exDropdown.addEventListener('change',()=>{
    const key=exDropdown.value;
    const ex=REGISTRY[currentPhase].find(e=>e.key===key);
    if(ex)loadExercise(ex);
});

function loadPhase(p){
    // Heel-slide-only build: keep UI shape, but constrain the protocol to Phase 1.
    currentPhase = 1;
    const meta = PHASE_META[1];
    if (phaseDropdown) {
        phaseDropdown.innerHTML = '';
        const phaseOpt = document.createElement('option');
        phaseOpt.value = '1';
        phaseOpt.textContent = 'Phase 1';
        phaseDropdown.appendChild(phaseOpt);
        phaseDropdown.value = '1';
    }
    progressLabel.textContent = `Post-Meniscus · ${meta.label}: ${meta.weeks} · ${meta.desc}`;

    exDropdown.innerHTML = '';
    REGISTRY[1].forEach(ex => {
        const o = document.createElement('option');
        o.value = ex.key;
        o.textContent = ex.name;
        exDropdown.appendChild(o);
    });
    exDropdown.value = 'heel_slide';
    loadExercise(REGISTRY[1][0]);
}

function loadExercise(ex){
    // Heel-slide-only build: any request resolves to Supine Heel Slide.
    currentPhase = 1;
    currentEx = REGISTRY[1][0];
    ex = currentEx;
    if (exDropdown) exDropdown.value = 'heel_slide';
    // Update exercise card
    exCardName.textContent = ex.name;
    exCardDesc.textContent = ex.desc;
    exCardReps.textContent = `${repCount}/${targetReps}`;
    exCardSets.textContent = `${setCount}/${targetSets}`;
    if(exThumb) exThumb.textContent = ex.thumb || '🦵';
    // Reset cal
    calState='idle'; calStep=0; resetCalRing();
    btnCal.textContent='START CALIBRATION';
    updateStatus('READY','ready');
    lagCnt=0;
}

// ================================================================
// STATUS BAR
// ================================================================
function updateStatus(text,state){
    statusText.textContent=text;
    statusText.className='status-val '+state;
    statusDot.className='status-dot '+state;
}

// ================================================================
// ROM TOGGLE
// ================================================================
romToggle.addEventListener('change',()=>{
    romActive=romToggle.checked;
    romStatus.textContent=romActive?'ROM':'OFF';
    romStatus.style.color=romActive?'#0277BD':'#999';
});

// ================================================================
// ROM SAFETY GATE
// ================================================================
function checkRom(a){
    if(!romActive||romFrozen)return;
    if(a>maxRom||a<minRom){
        romFrozen=true;
        forceModuleVisible('rom', 'ROM safety override');
        recordTelemetry('safety_event', {
            type: 'rom_limit',
            angle: a,
            maxRom,
            minRom,
            timestamp: Date.now()
        });
        romOverlay.classList.remove('hidden');
        speak('Stop. Range limit exceeded.',true);
        updateStatus('ROM LIMIT','warn');
    }
}
document.getElementById('btn-rom-resume').addEventListener('click',()=>{
    romFrozen=false;
    clearForcedModule('rom');
    romOverlay.classList.add('hidden');
    updateStatus('ACTIVE','active');
});


function updateRomPatientUI(angle = lastAngle) {
    if (!liveRomDisplay && !romTargetDisplay && !romFill) return;

    const safeMin = Number.isFinite(minRom) ? minRom : 0;
    const safeMax = Number.isFinite(maxRom) ? maxRom : 180;
    const current = Math.round(Number.isFinite(angle) ? angle : 0);
    const span = Math.max(1, safeMax - safeMin);
    const pct = Math.min(100, Math.max(0, ((current - safeMin) / span) * 100));

    if (liveRomDisplay) liveRomDisplay.textContent = current + '°';
    if (romTargetDisplay) romTargetDisplay.textContent = `${safeMin}°–${safeMax}°`;
    if (romFill) romFill.style.width = pct + '%';

    const inRange = current >= safeMin && current <= safeMax;

    if (romCaption) {
        romCaption.textContent = inRange
            ? 'Within prescribed safe range.'
            : 'Outside prescribed safe range. Stop and reset.';
        romCaption.style.color = inRange ? 'var(--text-dim)' : 'var(--warn)';
    }

    if (historyRom) historyRom.textContent = `ROM ${current}°`;
}

function updateHistoryWarnings() {
    if (!historyWarnings) return;

    const count =
        (sxCompLog?.hipHike || 0) +
        (sxCompLog?.trunkLean || 0) +
        (sxCompLog?.limbInst || 0);

    historyWarnings.textContent = `Warnings ${count}`;
}

// ================================================================
// READ INPUTS
// ================================================================
function readInputs(){
    targetReps=parseInt(document.getElementById('inp-reps').value)||10;
    targetSets=parseInt(inpSets.value)||3;
    T_STR=(parseFloat(inpRest.value)||2)*1000;
    T_PEAK=(parseFloat(inpToPeak.value)||3)*1000;
    T_HOLD=(parseFloat(inpHold.value)||2)*1000;
    T_RET=(parseFloat(inpReturn.value)||3)*1000;
    maxRom=parseFloat(inpMaxRom.value)||180;
    minRom=parseFloat(inpMinRom.value)||0;
    if (inpVelLow) TARGET_LOW=parseFloat(inpVelLow.value)||20;
    if (inpVelHigh) TARGET_HIGH=parseFloat(inpVelHigh.value)||60;
    if (TARGET_HIGH <= TARGET_LOW) TARGET_HIGH = TARGET_LOW + 10;
    updateVelocityZone();
    updateRomPatientUI(lastAngle);
}

// ================================================================
// SESSION RESET
// ================================================================
function resetSession(){
    readInputs();
    repCount=0; setCount=0;
    phase='straight'; phaseStart=null; lastPhaseSpoken='';
    initHipX=null; initHipY=null;
    lagCnt=0; lastSpoken=''; velHist=[]; lastVelT=performance.now();
    romFrozen=false;
    sxPeakRom=0; sxMinRom=999;
    sxCompLog={hipHike:0,trunkLean:0,limbInst:0};
    sxTotalFr=0; sxRepLog=[]; sxCompTags=[];
    resetKF();
    romOverlay.classList.add('hidden');
    summaryOverlay.classList.add('hidden');
    if(holdDisplay) holdDisplay.textContent='—';
    updateRepSets();
    updateStatus('ACTIVE','active');
    setFormStable();
}

function updateRepSets(){
    if(repsDisplay) repsDisplay.textContent=`${repCount}/${targetReps}`;
    if(setsDisplay) setsDisplay.textContent=`${setCount}/${targetSets}`;
    if(exCardReps) exCardReps.textContent=`${repCount}/${targetReps}`;
    if(exCardSets) exCardSets.textContent=`${setCount}/${targetSets}`;
    // progress bar width
    const total=targetSets*targetReps;
    const done=setCount*targetReps+repCount;
    if(progressBar) progressBar.style.width=Math.min(100,Math.round((done/total)*100))+'%';
}

// ================================================================
// CALIBRATION RING ON CANVAS
// ================================================================
function drawCalRing(kx,ky){
    const held=calStillStart?performance.now()-calStillStart:0;
    const frac=Math.min(1,held/CAL_MS);
    const r=30;
    ctx.beginPath(); ctx.arc(kx,ky,r,0,2*Math.PI);
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=5; ctx.stroke();
    if(frac>0){
        ctx.beginPath(); ctx.arc(kx,ky,r,-Math.PI/2,-Math.PI/2+2*Math.PI*frac);
        ctx.strokeStyle=frac>=1?'#43a047':'#29b6f6'; ctx.lineWidth=5; ctx.stroke();
    }
    if(calStillStart){
        const s=Math.max(0,Math.ceil((CAL_MS-held)/1000));
        ctx.fillStyle='#fff'; ctx.font='bold 14px monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(s>0?s+'s':'✓',kx,ky);
    }
}
function resetCalRing(){calStillStart=null;calBuf=[];calLastSec=-1;}

// ================================================================
// AUTO-CALIBRATION
// ================================================================
function runAutoCal(angle,kx,ky){
    calBuf.push(angle);
    if(calBuf.length>CAL_WIN)calBuf.shift();
    const rng=Math.max(...calBuf)-Math.min(...calBuf);
    const thr=(currentEx.legRaise&&calStep===1)?CAL_THR_LR:CAL_THR;
    const stable=calBuf.length>=CAL_WIN&&rng<=thr;
    if(stable){
        if(!calStillStart)calStillStart=performance.now();
        const held=performance.now()-calStillStart;
        const s=Math.ceil((CAL_MS-held)/1000);
        if(s!==calLastSec&&s<=3&&s>0){calLastSec=s;speak(String(s));}
        drawCalRing(kx,ky);
        if(held>=CAL_MS)captureCal(angle);
    } else {
        if(calStillStart)resetCalRing();
    }
}

function captureCal(angle){
    resetCalRing();
    if (!targetLimbProfile && targetProfileSamples.length >= TARGET_PROFILE_MIN_SAMPLES) {
        finalizeTargetLimbProfile();
    }
    const ex=currentEx;
    if(calStep===0){
        if(!ex.calBoth){
            calMax=Math.round(angle); calMin=calMax;
            calState='ready'; finishCal();
        } else {
            if(ex.peakContracted){
                calMax=Math.round(angle);
                calState='waiting_pos2';
                speak('Good. Now move to your peak position and hold still.');
            } else {
                calMin=Math.round(angle);
                calState='waiting_pos2';
                speak('Good. Now extend fully and hold still.');
            }
            btnCal.textContent='HOLD PEAK POSITION…';
            calStep=1;
        }
    } else {
        if(ex.peakContracted) calMin=Math.round(angle);
        else calMax=Math.round(angle);
        if(calMax<calMin)[calMax,calMin]=[calMin,calMax];
        calState='ready'; finishCal();
    }
}

function finishCal(){
    if (!targetLimbProfile && targetProfileSamples.length >= TARGET_PROFILE_MIN_SAMPLES) {
        finalizeTargetLimbProfile();
    }
    btnCal.textContent='RECALIBRATE';
    updateStatus('ACTIVE','active');
    const ex=currentEx;
    const msg=ex.legRaise?'Calibration complete. Target raise: 45°.'
        :`Calibration complete. Range: ${calMin}°–${calMax}°.`;
    speak('Calibration complete. '+ex.cues.straight);
    resetSession();
}

// CALIBRATION BUTTON
btnCal.addEventListener('click',()=>{
    if(!currentEx)return;
    beginMotionObservation();
    calStep=0; resetCalRing(); lastSpoken='';
    calState='motion_observe';
    speak('Move your working leg slowly once so I can identify it.');
    btnCal.textContent='IDENTIFYING WORKING LEG…';
    updateStatus('IDENTIFYING LEG','cal');
});

btnApply.addEventListener('click',()=>{readInputs();resetSession();});

// ================================================================
// PHASE MACHINE
// ================================================================
function atPeak(angle,hipFlex){
    const ex=currentEx;
    if(ex.legRaise)return hipFlex!==null&&hipFlex<=(ex.peakHipTarget+15);
    if(ex.peakContracted)return angle<=calMin+15;
    return angle>=calMax-15;
}
function atStart(angle,hipFlex){
    const ex=currentEx;
    if(ex.legRaise)return hipFlex!==null&&hipFlex>=165;
    if(ex.peakContracted)return angle>=calMax-15;
    return angle<=calMin+15;
}

const PHASE_CENTER={
    straight: {lbl:'REST',     col:'#90A4AE'},
    to_peak:  {lbl:'MOVING',   col:'#FFB300'},
    hold:     {lbl:'HOLD',     col:'#43A047'},
    returning:{lbl:'RETURN',   col:'#29B6F6'},
};

function drawCenterLabel(lbl,col){
    const cw=canvasEl.width,ch=canvasEl.height;
    ctx.save();
    ctx.font='bold 36px DM Sans, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const w=ctx.measureText(lbl).width+48;
    ctx.fillStyle='rgba(0,0,0,0.52)';
    const rx=cw/2-w/2,ry=ch/2-30,rh=56;
    roundRect(ctx,rx,ry,w,rh,12);
    ctx.fill();
    ctx.fillStyle=col;
    ctx.fillText(lbl,cw/2,ch/2);
    ctx.restore();
}
function roundRect(c,x,y,w,h,r){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);
    c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}

// Phase bar strip along bottom of canvas
function drawPhaseBar(ph,elapsed,duration){
    const pct=Math.min(1,elapsed/duration);
    const w=canvasEl.width,h=canvasEl.height;
    const barH=10,barY=h-barH-8,barX=20,barW=w-40;
    const colors={straight:'#78909C',to_peak:'#FFB300',hold:'#43A047',returning:'#29B6F6'};
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.4)';
    roundRect(ctx,barX,barY,barW,barH,5);ctx.fill();
    ctx.fillStyle=colors[ph]||'#29B6F6';
    roundRect(ctx,barX,barY,barW*pct,barH,5);ctx.fill();
    ctx.restore();
}

function runPhase(angle,hipFlex){
    const now=performance.now();
    if(!phaseStart)phaseStart=now;
    const el=now-phaseStart;
    const ex=currentEx;
    const pc=PHASE_CENTER[phase]||PHASE_CENTER.straight;
    drawCenterLabel(pc.lbl,pc.col);
    drawPhaseBar(phase,el,{straight:T_STR,to_peak:T_PEAK,hold:T_HOLD,returning:T_RET}[phase]||T_STR);

    switch(phase){
        case 'straight':
            if(holdDisplay)holdDisplay.textContent='—';
            if(lastPhaseSpoken!=='s'){speak(ex.cues.straight);lastPhaseSpoken='s';}
            if(el>=T_STR){phase='to_peak';phaseStart=now;lastPhaseSpoken='';}
            break;
        case 'to_peak':
            if(lastPhaseSpoken!=='p'){speak(ex.cues.toPeak);lastPhaseSpoken='p';}
            if(el>=T_PEAK||atPeak(angle,hipFlex)){phase='hold';phaseStart=now;lastPhaseSpoken='';}
            break;
        case 'hold': {
            const held=now-phaseStart;
            if(holdDisplay)holdDisplay.textContent=(held/1000).toFixed(1)+'s';
            if(lastPhaseSpoken!=='h'){speak(ex.cues.hold);lastPhaseSpoken='h';}
            if(held>=T_HOLD){
                sxRepLog.push({holdFrac:Math.min(1,held/T_HOLD),angle});
                repCount++;
                speak(String(repCount));
                if(repCount>=targetReps){
                    setCount++;
                    repCount=0;
                    if(setCount>=targetSets){updateRomPatientUI(sxPeakRom);
            updateHistoryWarnings();
            showSummary();return;}
                    speak('Set '+setCount+' complete. Rest.');
                }
                updateRepSets();
                phase='returning';phaseStart=now;lastPhaseSpoken='';
                if(holdDisplay)holdDisplay.textContent='—';
            }
            break;
        }
        case 'returning':
            if(lastPhaseSpoken!=='r'){speak(ex.cues.ret);lastPhaseSpoken='r';}
            if(el>=T_RET||atStart(angle,hipFlex)){phase='straight';phaseStart=now;lastPhaseSpoken='';}
            break;
    }
}

// ================================================================
// CLINICAL SUMMARY OVERLAY
// ================================================================
function showSummary(){
    speak('Session complete. Excellent work.',true);
    const ex=currentEx;
    const totalReps=setCount*targetReps;
    const goodFormPct=sxTotalFr>0?Math.round((1-(sxCompLog.hipHike+sxCompLog.trunkLean)/(sxTotalFr||1))*100):100;
    const avgHold=sxRepLog.length>0?Math.round(sxRepLog.reduce((a,b)=>a+b.holdFrac,0)/sxRepLog.length*100):0;

    // ── Performance line ──
    sumPerf.textContent=
        `Patient completed ${setCount} total set${setCount!==1?'s':''} of ${ex.name} `+
        `for ${totalReps} rep${totalReps!==1?'s':''} with ${goodFormPct}% overall good form.`;

    // ── ROM line ──
    sumRom.textContent=
        `Peak Knee Flexion: ${sxPeakRom>0?sxPeakRom+'°':'N/A'}. `+
        `Minimal Knee Extension: ${sxMinRom<999?sxMinRom+'°':'N/A'}.`;

    // ── Clinical notes ──
    const notes=[];
    if(sxCompLog.hipHike>20)
        notes.push(`Compensated on ${ex.name} by lifting hip — hip hiking detected in ${sxCompLog.hipHike} frames, suggesting inadequate core stabilization and pelvic control.`);
    if(sxCompLog.trunkLean>20)
        notes.push(`Trunk lean detected (${sxCompLog.trunkLean} frames) — suggests hip flexor tightness or insufficient balance strategy.`);
    if(avgHold<70&&ex.lagThr)
        notes.push(`Lag in quad movement suggests incomplete quad activation — hold accuracy ${avgHold}%. Focus on pre-activation before peak effort.`);
    if(sxCompLog.limbInst>15)
        notes.push(`Limb instability detected — irregular joint tracking in ${sxCompLog.limbInst} frames suggests fatigue or neuromuscular control deficit.`);
    if(sxPeakRom>0&&(sxPeakRom-sxMinRom)<(calMax-calMin)*0.65&&!ex.legRaise)
        notes.push(`Active ROM (${sxPeakRom-sxMinRom}°) is below 65% of calibrated range — gradually work toward full available range.`);
    if(notes.length===0)
        notes.push('No significant compensations detected. Session biomechanics within acceptable clinical parameters.');
    sumNotes.innerHTML=notes.map(n=>`<li>${n}</li>`).join('');

    summaryOverlay.classList.remove('hidden');
}

btnSumDismiss.addEventListener('click',()=>summaryOverlay.classList.add('hidden'));
btnSumRestart.addEventListener('click',()=>{
    summaryOverlay.classList.add('hidden');
    calState='idle'; calStep=0; resetCalRing();
    btnCal.textContent='START CALIBRATION';
    updateStatus('READY','ready');
    resetSession();
    setFormStable();
});

// ================================================================
// MAIN POSE LOOP
// ================================================================

function onResults(results){
    if(!results.poseLandmarks)return;
    frameCnt++;

    const resultNow = performance.now();
    if (lastPoseResultAt) {
        const dt = Math.max(1, resultNow - lastPoseResultAt);
        lastPoseResultDelta = dt;
        const fps = 1000 / dt;
        poseFpsEMA = poseFpsEMA ? (poseFpsEMA * 0.85 + fps * 0.15) : fps;
    }
    lastPoseResultAt = resultNow;

    ctx.save();
    ctx.clearRect(0,0,canvasEl.width,canvasEl.height);
    ctx.drawImage(results.image,0,0,canvasEl.width,canvasEl.height);

    const lm=results.poseLandmarks;

    if(!currentEx){ ctx.restore(); return; }

    if (calState === 'motion_observe') {
        const decidedLeg = collectMotionLockFrame(lm);
        // Heel-slide-only build: do not draw raw full-body skeleton during motion observation.
        // The UI should show only the trusted target limb once identified.
        updateTrackingQualityUI(50, motionLockReason);
        debugLastDecision = `motion lock · ${motionLockReason}`;
        showSignalToast(false);
        ctx.restore();
        if (!decidedLeg) return;

        // Once the working limb is identified, continue into normal calibration using that physical limb.
        resetKF();
        lockedLeg = decidedLeg;
        calState = 'waiting_pos1';
        btnCal.textContent = 'HOLD START POSITION…';
        updateStatus('CALIBRATING','cal');
        speak('Working leg identified. Hold your start position still.');
        return;
    }

    const quality = evaluateTrackingQuality(lm);
    const acceptFrame = quality.ok;
    const drawFrame = quality.score >= DRAW_QUALITY_MIN;
    lastFrameAccepted = acceptFrame;
    debugRawAngle = Number.isFinite(quality.rawAngle) ? quality.rawAngle : null;
    if (acceptFrame) debugAcceptedFrames++;
    else debugRejectedFrames++;
    const matchText = Number.isFinite(quality.targetMatch) ? ` · match ${Math.round(quality.targetMatch)}%` : '';
    debugLastDecision = acceptFrame
        ? `accepted · ${lockedLeg} limb${matchText}`
        : `${quality.reason} · ${lockedLeg} limb${matchText}`;

    // Heel-slide-only build: hide the raw full-body skeleton.
    // Draw only the trusted hip→knee→ankle target chain after validation.

    if (acceptFrame) {
        badTrackingFrames = 0;
        goodTrackingFrames++;
    } else {
        badTrackingFrames++;
        goodTrackingFrames = Math.max(0, goodTrackingFrames - 1);
        if (badTrackingFrames >= STALE_POSE_CLEAR_FRAMES) {
            lastGoodPts = null;
            lastGoodAngle = null;
        }
    }

    updateTrackingQualityUI(quality.score, quality.reason);
    if (acceptFrame) showSignalToast(false);
    else showSignalToast(quality.score < DRAW_QUALITY_MIN || badTrackingFrames >= SIG_FR);

    // If the frame is not trustworthy, keep last good points instead of letting joints teleport.
    let pts = null;
    let angle = lastGoodAngle;
    if (acceptFrame) {
        const rawPts = getWorkingLegPoints(lm, false);
        pts = getWorkingLegPoints(lm, true);
        pts = applyTrustedKalman(pts, rawPts, quality);

        const clinicalTrusted = pts.clinicalTrusted !== false;

        if (clinicalTrusted) {
            if ((calState === 'waiting_pos1' || calState === 'waiting_pos2') && quality.score >= CALIBRATION_QUALITY_MIN) {
                collectTargetLimbSample(pts, lockedLeg);
                if (!targetLimbProfile && targetProfileSamples.length >= TARGET_PROFILE_MIN_SAMPLES) {
                    finalizeTargetLimbProfile();
                }
            }

            const measuredAngle = angle3(pts.hip, pts.knee, pts.ankle);
            const nowForTune = performance.now();
            const dtForTune = lastVelT ? Math.max(0.001, (nowForTune - lastVelT) / 1000) : 0.033;
            const rawVelForTune = lastGoodAngle !== null ? Math.abs(measuredAngle - lastGoodAngle) / dtForTune : 0;
            tuneFiltersForMotion(rawVelForTune);

            angle = Math.round(angleFilter.filter(measuredAngle));
            debugSmoothAngle = angle;
            updateVelocityFromAngle(angle);
            lastGoodPts = pts;
            lastGoodAngle = angle;
            lastGoodSegmentLengths = {
                hk: dist2(pts.hip, pts.knee),
                ka: dist2(pts.knee, pts.ankle),
                kh: pts.heel ? dist2(pts.knee, pts.heel) : dist2(pts.knee, pts.ankle),
                ah: pts.heel ? dist2(pts.ankle, pts.heel) : 0
            };
            lastKneeToAnkleVec = { x: pts.ankle.x - pts.knee.x, y: pts.ankle.y - pts.knee.y };
        } else {
            angle = lastGoodAngle;
            debugSmoothAngle = Number.isFinite(lastGoodAngle) ? lastGoodAngle : null;
            updateTrackingQualityUI(Math.min(quality.score, 68), `tracking uncertain: ${lastUncertainReason}`);
            showSignalToast(false);
        }
    }

    // Do not draw stale/invalid points. If quality is bad, show only the camera + signal toast.
    if (pts && drawFrame) drawSmoothedWorkingLeg(pts);

    const fHip = pts?.hip;
    const fKnee = pts?.knee;
    const fAnkle = pts?.ankle;
    const fSh = pts?.shoulder || rawLM(lm, 'shoulder', lockedLeg);

    const kx = (fKnee?.x ?? 0.5) * canvasEl.width;
    const ky = (fKnee?.y ?? 0.5) * canvasEl.height;

    if(calState==='waiting_pos1'||calState==='waiting_pos2'){
        if(pts && quality.score >= DRAW_QUALITY_MIN) drawCalRing(kx,ky);
    }
    ctx.restore();

    if(!pts || angle === null || angle === undefined){
        if(!DEV_MODE) return;
    }

    // Phase 1.2.7 clinical safety gate: if ankle is virtual/questionable, freeze ROM/reps/velocity.
    if (pts?.clinicalTrusted === false) {
        if (calState==='waiting_pos1' || calState==='waiting_pos2') {
            updateStatus('TRACKING UNCERTAIN','warn');
            resetCalRing();
        } else if (calState === 'ready') {
            updateStatus('TRACKING UNCERTAIN','warn');
        }
        if(!DEV_MODE) return;
    }

    // Confidence gate: for calibration/exercise, use quality score instead of raw visibility only.
    if(!acceptFrame){
        if (calState==='waiting_pos1' || calState==='waiting_pos2') {
            updateStatus('WAITING FULL LEG','warn');
            resetCalRing();
        }
        if(!DEV_MODE) return;
    }

    if (trackingUncertain && calState === 'ready') {
        updateTrackingQualityUI(Math.min(lastTrackingScore, 62), lastUncertainReason || 'tracking uncertain');
        updateStatus('TRACKING UNCERTAIN','warn');
        if(!DEV_MODE) return;
    }

    if(limbSwapped(fHip,fKnee,fAnkle,fSh)){
        sxCompLog.limbInst++;
        updateTrackingQualityUI(Math.min(lastTrackingScore, 45), 'leg geometry unstable');
        return;
    }
    if(romFrozen)return;

    lastAngle=angle;
    updateRomPatientUI(angle);

    // Track ROM extremes
    if(angle>sxPeakRom)sxPeakRom=angle;
    if(angle<sxMinRom)sxMinRom=angle;

    // ROM safety gate
    checkRom(angle);
    if(romFrozen)return;

    // Hip flex for SLR
    let hipFlex=null;
    if(currentEx.hipFlex && fSh && fSh.visibility>0.35&&fHip.visibility>0.35&&fKnee.visibility>0.35) {
        hipFlex=angle3(fSh,fHip,fKnee);
    }

    // Calibration only counts down when tracking is stable for several frames.
    if(calState==='waiting_pos1'||calState==='waiting_pos2'){
        if (quality.score < CALIBRATION_QUALITY_MIN || goodTrackingFrames < 8) {
            updateStatus('WAITING FULL LEG','cal');
            resetCalRing();
            return;
        }
        updateStatus('CALIBRATING','cal');
        runAutoCal(angle,kx,ky);
        return;
    }
    if(calState!=='ready')return;
    if(frameCnt%SKIP!==0)return;
    sxTotalFr++;

    // Compensation detection
    if(!initHipX){initHipX=fHip.x;initHipY=fHip.y;}
    const hipDrift=Math.abs(fHip.x-initHipX);
    const hipVert=Math.abs(fHip.y-initHipY);

    // Hip hiking: hip y rises more than ~5° (0.05 normalized units)
    const hipHike=hipVert>0.05;
    const trunkLean=hipDrift>0.05;

    if(hipHike){
        sxCompLog.hipHike++;
        setFormWarning('HIP HIKE');
        forceModuleVisible('exercise', 'Form safety override');
        recordTelemetry('safety_event', { type:'hip_hike', hipVert, timestamp:Date.now() });
        if(!sxCompTags.includes('hip hiking'))sxCompTags.push('hip hiking');
        if(frameCnt%90===0)speak(currentEx.cues.comp);
    } else if(trunkLean){
        sxCompLog.trunkLean++;
        setFormWarning('TRUNK LEAN');
        forceModuleVisible('exercise', 'Form safety override');
        recordTelemetry('safety_event', { type:'trunk_lean', hipDrift, timestamp:Date.now() });
        if(!sxCompTags.includes('trunk lean'))sxCompTags.push('trunk lean');
        if(frameCnt%90===0)speak(currentEx.cues.comp);
    } else {
        setFormStable();
        clearForcedModule('exercise');
    }

    updateHistoryWarnings();

    // Extensor lag
    if(currentEx.lagThr&&phase==='straight'&&!currentEx.legRaise){
        if(angle<currentEx.lagThr){
            lagCnt++;
            if(lagCnt>15)setFormWarning('EXT LAG');
        } else {
            lagCnt=Math.max(0,lagCnt-2);
            if(lagCnt===0&&!hipHike&&!trunkLean)setFormStable();
        }
    }
    // Leg raise knee bend
    if(currentEx.legRaise&&(phase==='to_peak'||phase==='hold')){
        if(angle<currentEx.lagThr)setFormWarning('KNEE BEND');
        else if(!hipHike&&!trunkLean)setFormStable();
    }

    runPhase(angle,hipFlex);
}


// ================================================================
// PHASE 1.2 — SOURCE MANAGER + PERCEPTION DEBUG HARNESS
// ================================================================
function formatSeconds(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    const min = Math.floor(seconds / 60);
    const sec = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${min}:${sec}`;
}

function resetPerceptionDebugCounters() {
    debugAcceptedFrames = 0;
    debugRejectedFrames = 0;
    debugRawAngle = null;
    debugSmoothAngle = null;
    debugLastDecision = 'reset';
    poseFpsEMA = 0;
    lastPoseResultAt = 0;
    lastPoseSendAt = 0;
    updateDebugPanel();
}

function resetSourceTrackingState(label = 'READY') {
    resetTargetLimbProfile('source reset');
    calState = 'idle';
    calStep = 0;
    resetCalRing();
    resetKF();
    resetPerceptionDebugCounters();
    velocityAngleLast = null;
    velocityTimeLast = null;
    velocityDebugLast = 0;
    btnCal.textContent = 'START CALIBRATION';
    updateStatus(label, label === 'READY' ? 'ready' : 'cal');
    showSignalToast(false);
}

function updateSourceButtons() {
    sourceCameraBtn?.classList.toggle('active', activeSourceMode === 'camera');
    sourceTestVideoBtn?.classList.toggle('active', activeSourceMode === 'test-video');
    document.body.dataset.sourceMode = activeSourceMode === 'camera' ? 'camera' : 'video';
    if (dbgSource) dbgSource.textContent = activeSourceMode === 'camera' ? 'Camera' : 'Test Video';
}

function updateDebugPanel() {
    if (!debugPanel) return;
    const now = performance.now();
    const inferenceAge = lastPoseResultAt ? Math.round(now - lastPoseResultAt) + 'ms' : '—';
    if (dbgSource) dbgSource.textContent = activeSourceMode === 'camera' ? 'Camera' : 'Test Video';
    if (dbgPoseFps) dbgPoseFps.textContent = poseFpsEMA ? poseFpsEMA.toFixed(1) : '—';
    if (dbgInferenceAge) dbgInferenceAge.textContent = inferenceAge;
    if (dbgRawAngle) dbgRawAngle.textContent = Number.isFinite(debugRawAngle) ? Math.round(debugRawAngle) + '°' : '—';
    if (dbgSmoothAngle) dbgSmoothAngle.textContent = Number.isFinite(debugSmoothAngle) ? Math.round(debugSmoothAngle) + '°' : '—';
    if (dbgFrames) dbgFrames.textContent = `${debugAcceptedFrames} / ${debugRejectedFrames}`;
    if (dbgReason) {
        const motionText = motionLockSource && motionLockSource !== 'manual'
            ? ` · ${motionLockSource} · L${Math.round(motionLockScores.left)} R${Math.round(motionLockScores.right)}`
            : '';
        const ankleText = Number.isFinite(lastAnkleIntegrityScore) && lastAnkleIntegrityScore > 0
            ? ` · ankle ${lastAnkleIntegrityScore}% ${ankleIntegrityState}`
            : '';
        dbgReason.textContent = (debugLastDecision || '—') + motionText + ankleText;
    }
    if (dbgVideoTime) {
        if (activeSourceMode === 'test-video' && videoEl.duration) {
            dbgVideoTime.textContent = `${formatSeconds(videoEl.currentTime)} / ${formatSeconds(videoEl.duration)}`;
        } else {
            dbgVideoTime.textContent = 'live';
        }
    }
}

setInterval(updateDebugPanel, 250);

async function sendPoseFrame(sourceEl) {
    if (!sourceEl || inferenceBusy) return;
    if (sourceEl.readyState < 2) return;

    inferenceBusy = true;
    lastPoseSendAt = performance.now();
    try {
        await pose.send({ image: sourceEl });
    } catch (err) {
        console.warn('Pose send failed:', err);
    } finally {
        inferenceBusy = false;
    }
}

function stopTestVideoLoop() {
    if (testVideoRAF) {
        cancelAnimationFrame(testVideoRAF);
        testVideoRAF = null;
    }
}

function startTestVideoLoop() {
    stopTestVideoLoop();
    const loop = async () => {
        if (activeSourceMode !== 'test-video') return;
        const now = performance.now();
        if (!videoEl.paused && !videoEl.ended && now - lastTestPoseSend >= TEST_VIDEO_INFERENCE_MS) {
            lastTestPoseSend = now;
            await sendPoseFrame(videoEl);
        }
        updateDebugPanel();
        testVideoRAF = requestAnimationFrame(loop);
    };
    testVideoRAF = requestAnimationFrame(loop);
}

function stopCameraSource() {
    try {
        if (cameraController && typeof cameraController.stop === 'function') cameraController.stop();
    } catch (err) {
        console.warn('Camera stop failed:', err);
    }
    cameraController = null;

    try {
        const stream = videoEl.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach(track => track.stop());
        }
    } catch (err) {
        console.warn('Camera track stop failed:', err);
    }
}

async function startCameraSource() {
    stopTestVideoLoop();
    if (testVideoObjectURL) {
        URL.revokeObjectURL(testVideoObjectURL);
        testVideoObjectURL = null;
    }
    videoEl.pause?.();
    videoEl.removeAttribute('src');
    videoEl.srcObject = null;
    videoEl.load?.();

    cameraController = new Camera(videoEl, {
        onFrame: async () => {
            if (activeSourceMode !== 'camera') return;
            await sendPoseFrame(videoEl);
        },
        width: 640,
        height: 480,
    });
    await cameraController.start();
}

async function setSourceMode(mode) {
    activeSourceMode = mode === 'test-video' ? 'test-video' : 'camera';
    updateSourceButtons();
    resetSourceTrackingState(activeSourceMode === 'camera' ? 'READY' : 'TEST VIDEO');

    if (activeSourceMode === 'camera') {
        if (sourceNote) sourceNote.textContent = 'Camera mode active. Press D to toggle debug metrics.';
        await startCameraSource();
    } else {
        stopCameraSource();
        stopTestVideoLoop();
        videoEl.srcObject = null;
        if (sourceNote) sourceNote.textContent = 'Test Video mode active. Upload a video, then play, pause, restart, or frame-step.';
        updateStatus('TEST VIDEO', 'cal');
    }
}

async function loadTestVideoFile(file) {
    if (!file) return;
    activeSourceMode = 'test-video';
    updateSourceButtons();
    stopCameraSource();
    stopTestVideoLoop();

    if (testVideoObjectURL) URL.revokeObjectURL(testVideoObjectURL);
    testVideoObjectURL = URL.createObjectURL(file);

    videoEl.srcObject = null;
    videoEl.src = testVideoObjectURL;
    videoEl.muted = true;
    videoEl.loop = false;
    videoEl.playbackRate = parseFloat(videoSpeedSelect?.value || '1') || 1;

    resetSourceTrackingState('TEST VIDEO');
    if (sourceNote) sourceNote.textContent = `Loaded: ${file.name}. This file is your repeatability baseline.`;

    await new Promise(resolve => {
        if (videoEl.readyState >= 1) return resolve();
        videoEl.onloadedmetadata = () => resolve();
    });

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    startTestVideoLoop();
    await videoEl.play().catch(() => {});
    await sendPoseFrame(videoEl);
}

async function stepTestVideoFrame() {
    if (activeSourceMode !== 'test-video' || !videoEl.src) return;
    videoEl.pause();
    const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : Infinity;
    videoEl.currentTime = Math.min(duration, videoEl.currentTime + (1 / TEST_VIDEO_FPS));
    await new Promise(resolve => {
        const done = () => { videoEl.removeEventListener('seeked', done); resolve(); };
        videoEl.addEventListener('seeked', done, { once: true });
        setTimeout(done, 120);
    });
    await sendPoseFrame(videoEl);
    updateDebugPanel();
}

function initInputSourceUI() {
    sourceCameraBtn?.addEventListener('click', () => setSourceMode('camera'));
    sourceTestVideoBtn?.addEventListener('click', () => setSourceMode('test-video'));
    testVideoFileInput?.addEventListener('change', e => loadTestVideoFile(e.target.files?.[0]));
    videoPlayBtn?.addEventListener('click', async () => {
        if (activeSourceMode !== 'test-video') await setSourceMode('test-video');
        await videoEl.play().catch(() => {});
        startTestVideoLoop();
    });
    videoPauseBtn?.addEventListener('click', () => videoEl.pause());
    videoRestartBtn?.addEventListener('click', async () => {
        if (activeSourceMode !== 'test-video' || !videoEl.src) return;
        videoEl.pause();
        videoEl.currentTime = 0;
        resetSourceTrackingState('TEST VIDEO');
        await sendPoseFrame(videoEl);
    });
    videoStepBtn?.addEventListener('click', stepTestVideoFrame);
    videoSpeedSelect?.addEventListener('change', () => {
        videoEl.playbackRate = parseFloat(videoSpeedSelect.value) || 1;
    });
    debugToggleBtn?.addEventListener('click', () => {
        debugPanel?.classList.toggle('collapsed');
        if (debugToggleBtn) debugToggleBtn.textContent = debugPanel?.classList.contains('collapsed') ? 'Show Debug Metrics' : 'Hide Debug Metrics';
    });
    document.addEventListener('keydown', e => {
        if (e.key.toLowerCase() !== 'd') return;
        if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
        debugToggleBtn?.click();
    });
    updateSourceButtons();
    updateDebugPanel();
}

// ================================================================
// MEDIAPIPE
// ================================================================
const pose=new Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55
});
pose.onResults(onResults);

window.addEventListener('load',async()=>{
    loadPhase(1);
    setWorkingLeg(workingLeg);
    initExecutivePrescriptionUI();
    initInputSourceUI();

    // DEV MODE: start mock data ticker and ensure signal overlay stays hidden
    if (DEV_MODE) {
        startMockTicker();
        if (signalOverlay) signalOverlay.classList.add('hidden');
        updateStatus('DEV MODE', 'active');
    }

    await setSourceMode('camera');
});

// ── Accordion toggle ─────────────────────────────────────────
document.querySelectorAll('.acc-header').forEach(h=>{
    h.addEventListener('click',()=>{
        const body=document.getElementById(h.dataset.target);
        if(!body)return;
        const open=!body.classList.contains('closed');
        body.classList.toggle('closed',open);
        h.querySelector('.acc-chev').textContent=open?'▾':'▴';
    });
});




// ================================================================
// EXECUTIVE VS PRESCRIPTION ARCHITECTURE
// ================================================================
const STORAGE_KEYS = {
    viewMode: 'rehabViewMode',
    modulePrefs: 'rehabModulePrefs',
    forcedModules: 'rehabForcedModules',
    activeProtocol: 'rehabActivePatientProtocol',
    telemetry: 'rehabTelemetryBuffer'
};

const MODULE_REGISTRY = {
    form:     { label: 'Form Status', mandatory: true },
    velocity: { label: 'Velocity / Speed', mandatory: true },
    exercise: { label: 'Exercise Details', mandatory: false },
    phase:    { label: 'Recovery Phase', mandatory: false, ptOnly: true },
    rom:      { label: 'ROM Monitor', mandatory: false },
    tempo:    { label: 'Tempo / Session Info', mandatory: false },
    fatigue:  { label: 'Fatigue Plot', mandatory: false },
    history:  { label: 'Session History', mandatory: false }
};

let viewMode = localStorage.getItem(STORAGE_KEYS.viewMode) || 'patient';

const UI_PREF_VERSION = 'v3_patient_minimal';

const DEFAULT_MODULE_PREFS = {
    exercise: true,
    rom: true,
    tempo: false,
    fatigue: false,
    history: true
};

if (localStorage.getItem('rehabUIPrefVersion') !== UI_PREF_VERSION) {
    localStorage.setItem(STORAGE_KEYS.modulePrefs, JSON.stringify(DEFAULT_MODULE_PREFS));
    localStorage.setItem('rehabUIPrefVersion', UI_PREF_VERSION);
}

let modulePrefs = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.modulePrefs) ||
    JSON.stringify(DEFAULT_MODULE_PREFS)
);

let forcedModules = new Set(
    JSON.parse(localStorage.getItem(STORAGE_KEYS.forcedModules) || '[]')
);

let telemetryBuffer = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.telemetry) || '[]'
);

function saveModulePrefs() {
    localStorage.setItem(STORAGE_KEYS.modulePrefs, JSON.stringify(modulePrefs));
}

function saveForcedModules() {
    localStorage.setItem(STORAGE_KEYS.forcedModules, JSON.stringify([...forcedModules]));
}

function recordTelemetry(type, payload = {}) {
    telemetryBuffer.push({
        type,
        ...payload,
        timestamp: payload.timestamp || Date.now()
    });

    if (telemetryBuffer.length > 500) {
        telemetryBuffer = telemetryBuffer.slice(-500);
    }

    localStorage.setItem(STORAGE_KEYS.telemetry, JSON.stringify(telemetryBuffer));
    updatePTReviewDashboard();
}

function updatePTReviewDashboard() {
    const lastRomEl = document.getElementById('pt-last-rom');
    const safetyEl = document.getElementById('pt-safety-events');
    const compEl = document.getElementById('pt-comp-events');
    const noteEl = document.getElementById('pt-review-note');

    if (!lastRomEl && !safetyEl && !compEl) return;

    const safetyEvents = telemetryBuffer.filter(e => ['rom_limit','excessive_velocity','hip_hike','trunk_lean','safety_event'].includes(e.type));
    const compEvents = telemetryBuffer.filter(e =>
        ['hip_hike', 'trunk_lean'].includes(e.type)
    );

    const romEvents = telemetryBuffer.filter(e =>
        e.angle !== undefined
    );

    const lastRom = romEvents.length
        ? romEvents[romEvents.length - 1].angle + '°'
        : (sxPeakRom > 0 ? sxPeakRom + '°' : '—');

    if (lastRomEl) lastRomEl.textContent = lastRom;
    if (safetyEl) safetyEl.textContent = String(safetyEvents.length);
    if (compEl) compEl.textContent = String(compEvents.length);

    if (noteEl) {
        noteEl.textContent = safetyEvents.length
            ? 'Recent safety events detected. Review ROM limits, velocity, and compensation logs.'
            : 'No major safety events recorded in the current telemetry buffer.';
    }
}

function collectCurrentPrescription() {
    readInputs();

    return {
        phase: parseInt(phaseDropdown.value) || 1,
        exercise: exDropdown.value || (currentEx ? currentEx.key : 'ankle_pumps'),
        maxRom,
        minRom,
        velocityLow: TARGET_LOW,
        velocityHigh: TARGET_HIGH,
        sets: targetSets,
        reps: targetReps,
        restSeconds: parseFloat(inpRest.value) || 2,
        setRestSeconds: parseFloat(inpRest2.value) || 2,
        toPeakSeconds: parseFloat(inpToPeak.value) || 3,
        holdSeconds: parseFloat(inpHold.value) || 2,
        returnSeconds: parseFloat(inpReturn.value) || 3,
        updatedAt: new Date().toISOString()
    };
}

function applyPrescription(protocol) {
    if (!protocol) return;

    if (protocol.phase && phaseDropdown) {
        phaseDropdown.value = String(protocol.phase);
        loadPhase(protocol.phase);
    }

    if (protocol.exercise && exDropdown) {
        exDropdown.value = protocol.exercise;
        const ex = REGISTRY[currentPhase].find(e => e.key === protocol.exercise);
        if (ex) loadExercise(ex);
    }

    if (inpMaxRom && protocol.maxRom !== undefined) inpMaxRom.value = protocol.maxRom;
    if (inpMinRom && protocol.minRom !== undefined) inpMinRom.value = protocol.minRom;
    if (inpVelLow && protocol.velocityLow !== undefined) inpVelLow.value = protocol.velocityLow;
    if (inpVelHigh && protocol.velocityHigh !== undefined) inpVelHigh.value = protocol.velocityHigh;
    if (inpSets && protocol.sets !== undefined) inpSets.value = protocol.sets;
    if (document.getElementById('inp-reps') && protocol.reps !== undefined) document.getElementById('inp-reps').value = protocol.reps;
    if (inpRest && protocol.restSeconds !== undefined) inpRest.value = protocol.restSeconds;
    if (inpRest2 && protocol.setRestSeconds !== undefined) inpRest2.value = protocol.setRestSeconds;
    if (inpToPeak && protocol.toPeakSeconds !== undefined) inpToPeak.value = protocol.toPeakSeconds;
    if (inpHold && protocol.holdSeconds !== undefined) inpHold.value = protocol.holdSeconds;
    if (inpReturn && protocol.returnSeconds !== undefined) inpReturn.value = protocol.returnSeconds;

    readInputs();
    updateRepSets();
}

function updateActiveProtocolCard(protocol = null) {
    const raw = protocol || (() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.activeProtocol) || 'null');
        } catch {
            return null;
        }
    })();

    const exerciseEl = document.getElementById('active-protocol-exercise');
    const phaseEl = document.getElementById('active-protocol-phase');
    const romEl = document.getElementById('active-protocol-rom');
    const doseEl = document.getElementById('active-protocol-dose');
    const updatedEl = document.getElementById('active-protocol-updated');

    if (!exerciseEl && !phaseEl && !romEl && !doseEl && !updatedEl) return;

    if (!raw) {
        if (exerciseEl) exerciseEl.textContent = '—';
        if (phaseEl) phaseEl.textContent = '—';
        if (romEl) romEl.textContent = '—';
        if (doseEl) doseEl.textContent = '—';
        if (updatedEl) updatedEl.textContent = 'No published protocol yet.';
        return;
    }

    const exName = Object.values(REGISTRY)
        .flat()
        .find(e => e.key === raw.exercise)?.name || raw.exercise || '—';

    if (exerciseEl) exerciseEl.textContent = exName;
    if (phaseEl) phaseEl.textContent = raw.phase ? `Phase ${raw.phase}` : '—';
    if (romEl) romEl.textContent = `${raw.minRom ?? 0}°–${raw.maxRom ?? 180}°`;
    if (doseEl) doseEl.textContent = `${raw.sets ?? 3} × ${raw.reps ?? 10}`;

    if (updatedEl) {
        const when = raw.updatedAt ? new Date(raw.updatedAt).toLocaleString() : 'Unknown time';
        updatedEl.textContent = `Last published: ${when}`;
    }
}

function pushPrescriptionToPatient() {
    const protocol = collectCurrentPrescription();

    localStorage.setItem(STORAGE_KEYS.activeProtocol, JSON.stringify(protocol));
    applyPrescription(protocol);
    updateActiveProtocolCard(protocol);

    recordTelemetry('protocol_pushed', protocol);

    const btn = document.getElementById('btn-push-patient');
    if (btn) {
        const old = btn.textContent;
        btn.textContent = 'PUBLISHED ✓';
        setTimeout(() => btn.textContent = old, 1200);
    }
}

function loadActivePatientProtocol() {
    const raw = localStorage.getItem(STORAGE_KEYS.activeProtocol);
    if (!raw) return;

    try {
        const protocol = JSON.parse(raw);
        applyPrescription(protocol);
        updateActiveProtocolCard(protocol);
    } catch (err) {
        console.warn('Unable to load active patient protocol', err);
    }
}

function setViewMode(mode) {
    viewMode = mode === 'pt' ? 'pt' : 'patient';

    localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
    document.body.dataset.viewMode = viewMode;

    document.getElementById('mode-patient')?.classList.toggle('active', viewMode === 'patient');
    document.getElementById('mode-pt')?.classList.toggle('active', viewMode === 'pt');

    document.querySelectorAll('[data-clinical-input], .clinical-input').forEach(el => {
        el.disabled = viewMode === 'patient';
    });

    if (viewMode === 'patient') {
        loadActivePatientProtocol();
    }

    applyModuleVisibility();
    updatePTReviewDashboard();
}

function applyModuleVisibility() {
    Object.keys(MODULE_REGISTRY).forEach(key => {
        const meta = MODULE_REGISTRY[key];
        const card = document.querySelector(`[data-module="${key}"]`);
        if (!card) return;

        const isForced = forcedModules.has(key);
        const isMandatory = meta.mandatory;
        const isPtOnly = meta.ptOnly;
        const prefVisible = modulePrefs[key] !== false;

        let visible = isMandatory || isForced || prefVisible;

        if (viewMode === 'patient' && isPtOnly) {
            visible = false;
        }

        if (viewMode === 'pt') {
            // PT mode is a prescription/review workspace.
            // Hide live patient execution modules, but keep velocity available as editable thresholds.
            const executionOnlyForPT = ['form', 'fatigue'];
            visible = !executionOnlyForPT.includes(key);
        }

        card.classList.toggle('module-hidden', !visible);
        card.classList.toggle('module-forced', isForced);
    });

    document.querySelectorAll('.module-pref').forEach(input => {
        const key = input.dataset.modulePref;
        const locked = forcedModules.has(key) || MODULE_REGISTRY[key]?.mandatory;

        input.checked = modulePrefs[key] !== false || forcedModules.has(key);
        input.disabled = locked;

        const label = input.closest('.module-toggle');
        if (label) label.classList.toggle('mandatory', locked);
    });
}

function forceModuleVisible(key, reason = 'Safety override') {
    if (!MODULE_REGISTRY[key]) return;

    forcedModules.add(key);
    saveForcedModules();
    applyModuleVisibility();

    recordTelemetry('module_forced_visible', { module: key, reason });
}

function clearForcedModule(key) {
    if (!forcedModules.has(key)) return;

    forcedModules.delete(key);
    saveForcedModules();
    applyModuleVisibility();
}

function initExecutivePrescriptionUI() {
    document.getElementById('mode-patient')?.addEventListener('click', () => setViewMode('patient'));
    document.getElementById('mode-pt')?.addEventListener('click', () => setViewMode('pt'));

    document.getElementById('btn-push-patient')?.addEventListener('click', pushPrescriptionToPatient);

    const viewToggle = document.getElementById('view-settings-toggle');
    const viewBody = document.getElementById('view-settings-body');

    if (viewToggle && viewBody) {
        viewToggle.addEventListener('click', () => {
            const closed = viewBody.classList.toggle('closed');
            const chev = viewToggle.querySelector('.view-settings-chev');
            if (chev) chev.textContent = closed ? '▸' : '▾';
        });
    }

    document.querySelectorAll('.module-pref').forEach(input => {
        input.addEventListener('change', () => {
            const key = input.dataset.modulePref;

            if (forcedModules.has(key)) {
                input.checked = true;
                return;
            }

            modulePrefs[key] = input.checked;
            saveModulePrefs();
            applyModuleVisibility();
        });
    });

    const btnTestSummary = document.getElementById('btn-test-summary');
    if (btnTestSummary) {
        btnTestSummary.addEventListener('click', () => {
            const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            const randFloat = (min, max, d=1) => Number((Math.random() * (max - min) + min).toFixed(d));

            sxPeakRom = rand(95, 145);
            sxMinRom = rand(0, 12);
            sxTotalFr = rand(220, 500);
            sxCompLog = {
                hipHike: rand(0, 45),
                trunkLean: rand(0, 35),
                limbInst: rand(0, 25)
            };
            sxRepLog = Array.from({length: rand(5, 12)}, () => ({
                holdFrac: randFloat(0.62, 1.0, 2),
                angle: rand(95, 145)
            }));
            setCount = rand(1, targetSets || 3);
            repCount = rand(0, targetReps || 10);

            const notes = [
                'Pain remained 2/10 throughout session.',
                'Reported stiffness during first set but improved after warmup.',
                'No swelling noted following exercise.',
                'Mild fatigue reported near final repetitions.',
                'Patient reported improved confidence with movement.'
            ];

            if (sumUserNotes) sumUserNotes.value = notes[rand(0, notes.length - 1)];

            recordTelemetry('test_summary_generated', { sxPeakRom, sxMinRom, sxCompLog });
            recordTelemetry('rom_limit', { angle: sxPeakRom, maxRom, minRom });
            if (sxCompLog.hipHike > 20) recordTelemetry('hip_hike', { hipVert: sxCompLog.hipHike });
            if (sxCompLog.trunkLean > 15) recordTelemetry('trunk_lean', { hipDrift: sxCompLog.trunkLean });
            updatePTReviewDashboard();
            showSummary();
        });
    }

    loadActivePatientProtocol();
    updateActiveProtocolCard();
    setViewMode(viewMode);
    applyModuleVisibility();
}

// ================================================================
// THEME TOGGLE + DRAGGABLE SIDEBAR
// ================================================================
const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = nextTheme;
    localStorage.setItem('rehabTheme', nextTheme);

    if (themeToggle) {
        const icon = themeToggle.querySelector('.theme-toggle-icon');
        const text = themeToggle.querySelector('.theme-toggle-text');

        if (nextTheme === 'dark') {
            if (icon) icon.textContent = '☀️';
            if (text) text.textContent = 'Light';
            themeToggle.setAttribute('aria-label', 'Switch to light mode');
        } else {
            if (icon) icon.textContent = '🌙';
            if (text) text.textContent = 'Dark';
            themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        }
    }
}

if (themeToggle) {
    const savedTheme = localStorage.getItem('rehabTheme') || 'light';
    setTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
} else {
    const savedTheme = localStorage.getItem('rehabTheme') || 'light';
    document.body.dataset.theme = savedTheme;
}

const resizeHandle = document.getElementById('sidebar-resize-handle');

function clampSidebarWidth(width) {
    const MIN_SIDEBAR = 320;
    const MAX_SIDEBAR = 560;

    return Math.min(
        MAX_SIDEBAR,
        Math.max(MIN_SIDEBAR, width)
    );
}


function updateSidebarScale(width) {
    let scale = 0.86;

    if (width >= 380) scale = 0.9;
    if (width >= 440) scale = 0.96;
    if (width >= 500) scale = 1.0;

    document.documentElement.style.setProperty('--sidebar-scale', String(scale));
}

function setSidebarWidth(width, save = false) {
    const clamped = clampSidebarWidth(width);

    document.documentElement.style.setProperty('--sidebar-w', clamped + 'px');
    updateSidebarScale(clamped);

    if (save) {
        localStorage.setItem('rehabSidebarWidth', String(clamped));
    }
}

if (resizeHandle) {
    const DEFAULT_SIDEBAR = 360;
    const savedWidth = parseInt(localStorage.getItem('rehabSidebarWidth'), 10);

    setSidebarWidth(Number.isFinite(savedWidth) ? savedWidth : DEFAULT_SIDEBAR);

    let resizing = false;

    resizeHandle.addEventListener('mousedown', () => {
        resizing = true;
        document.body.classList.add('resizing');
    });

    window.addEventListener('mousemove', (e) => {
        if (!resizing) return;

        const newWidth = window.innerWidth - e.clientX;
        setSidebarWidth(newWidth);
    });

    window.addEventListener('mouseup', () => {
        if (!resizing) return;

        resizing = false;
        document.body.classList.remove('resizing');

        const currentWidth = parseInt(
            getComputedStyle(document.documentElement)
                .getPropertyValue('--sidebar-w'),
            10
        );

        setSidebarWidth(currentWidth, true);
    });
}