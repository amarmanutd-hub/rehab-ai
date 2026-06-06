// ================================================================
// REHAB.AI — app.js  v4.0
// Matches image blueprint exactly.
// Kalman · Confidence gate · Orthogonality · ROM safety
// Phase-locked registry · Velocity target band · Clinical summary
// ================================================================
'use strict';

// ── DEV MODE ─────────────────────────────────────────────────────
// Set to true to bypass signal-lost blocking and populate HUD with
// mock data so you can iterate on the UI without being in front of
// the camera. Flip back to false for clinical use.
const DEV_MODE = true;

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
        if (exCardReps) exCardReps.textContent = 'REPS: ' + mockRep + '/10';
        if (exCardSets) exCardSets.textContent = 'SETS: ' + mockSet + '/3';
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
    2: { label: 'Phase 2', weeks: 'Weeks 4–8', desc: 'Strength Building · Neuromuscular Control' },
    3: { label: 'Phase 3', weeks: 'Weeks 8–16', desc: 'Functional Loading · Return to Activity' },
};

const REGISTRY = {
    1: [
        { key:'ankle_pumps',  name:'Ankle Pumps',
          desc:'Seated or supine. Pump ankle through full dorsiflexion/plantarflexion. Camera LEFT.',
          thumb:'🦶',
          lm:{p1:25,p2:27,p3:31}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Foot neutral. Relax.', toPeak:'Pull toes up — dorsiflex.', hold:'Hold dorsiflexion.', ret:'Point foot down slowly.', lag:null, comp:'Keep knee still.' } },
        { key:'quad_sets',    name:'Quad Sets (Isometric)',
          desc:'Lying flat. Press knee into surface, tighten quad, hold. Camera LEFT.',
          thumb:'🦵',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:false, legRaise:false, lagThr:165,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Relax quad.', toPeak:'Press knee down — activate quad.', hold:'Hold contraction.', ret:'Relax slowly.', lag:'Insufficient quad activation.', comp:'Do not lift hips.' } },
        { key:'heel_slide',   name:'Supine Heel Slide',
          desc:'Supine. Slide heel toward glutes and back. Camera LEFT.',
          thumb:'🛝',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:160,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Leg extended. Rest.', toPeak:'Slide heel toward glutes.', hold:'Hold — knee fully bent.', ret:'Slide slowly back.', lag:'Extensor lag — lock out fully at rest.', comp:'Hip hiking detected — keep pelvis flat.' } },
        { key:'slr',          name:'Straight Leg Raise (SLR)',
          desc:'Supine. Raise straight left leg to ~45°. Camera LEFT.',
          thumb:'⬆️',
          lm:{p1:23,p2:25,p3:27}, hipFlex:{p1:11,p2:23,p3:25}, hip:23, peakContracted:false, calBoth:false, legRaise:true, peakHipTarget:135, lagThr:155,
          comp:{ hipRise:0.06, trunkLean:0.05 },
          cues:{ straight:'Leg flat. Tighten quad first.', toPeak:'Raise slowly — keep knee straight.', hold:'Hold at top.', ret:'Lower under control.', lag:'Knee bending — quad lag detected.', comp:'Hip shift — keep pelvis level.' } },
        { key:'glute_sets',   name:'Gluteal Sets (Isometric)',
          desc:'Lying flat. Squeeze glutes and hold. Camera overhead or LEFT.',
          thumb:'🍑',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:false, legRaise:false, lagThr:null,
          comp:{ hipRise:0.06, trunkLean:0.04 },
          cues:{ straight:'Relax glutes.', toPeak:'Squeeze glutes.', hold:'Hold the squeeze.', ret:'Slowly release.', lag:null, comp:'Do not lift hips.' } },
    ],
    2: [
        { key:'saqs',         name:'Short Arc Quads (SAQs)',
          desc:'Supine, rolled towel under knee. Extend from 45° to full lock. Camera LEFT.',
          thumb:'🦵',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:158,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Leg at 45°. Relax.', toPeak:'Extend — lock knee out.', hold:'Hold at full extension.', ret:'Lower slowly to 45°.', lag:'Extensor lag — drive to full lock.', comp:'Keep thigh on the roll.' } },
        { key:'bridges',      name:'Supine Bridges',
          desc:'Supine, knees bent. Drive hips up. Camera LEFT.',
          thumb:'🌉',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:0.08, trunkLean:0.06 },
          cues:{ straight:'Hips down. Relax.', toPeak:'Drive hips up — squeeze glutes.', hold:'Hold at top. Hips level.', ret:'Lower slowly.', lag:null, comp:'Hip drop — keep hips level.' } },
        { key:'leg_extension',name:'Seated Leg Extension',
          desc:'Seated at edge. Extend left knee from 90° to full lock. Camera LEFT.',
          thumb:'🦿',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:158,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Leg at 90°. Rest.', toPeak:'Extend — lock the knee.', hold:'Hold. Quad squeezed.', ret:'Lower slowly.', lag:'Extensor lag — knee not at full extension.', comp:'Keep trunk upright.' } },
        { key:'calf_raises',  name:'Calf Raises',
          desc:'Standing. Rise on toes and lower. Camera LEFT.',
          thumb:'👟',
          lm:{p1:25,p2:27,p3:31}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Feet flat. Ready.', toPeak:'Rise onto toes.', hold:'Hold at top.', ret:'Lower slowly.', lag:null, comp:'Keep knees straight.' } },
        { key:'ham_curl',     name:'Standing Hamstring Curl',
          desc:'Standing. Curl left heel toward glutes. Camera LEFT.',
          thumb:'🔄',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.05 },
          cues:{ straight:'Leg straight. Stand tall.', toPeak:'Curl heel up.', hold:'Hold at peak.', ret:'Lower slowly.', lag:null, comp:'Keep thigh still.' } },
    ],
    3: [
        { key:'mini_squats',  name:'Mini Squats',
          desc:'Standing. Partial squat to ~45°. Camera LEFT.',
          thumb:'🏋️',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.07 },
          cues:{ straight:'Standing. Ready.', toPeak:'Descend — knee over toes.', hold:'Hold at depth.', ret:'Drive through heels.', lag:null, comp:'Knee caving — push knee out.' } },
        { key:'step_ups',     name:'Step-Ups',
          desc:'Step up with left leg leading. Camera LEFT.',
          thumb:'🪜',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:155,
          comp:{ hipRise:5, trunkLean:0.06 },
          cues:{ straight:'At platform. Ready.', toPeak:'Step up — drive quad.', hold:'Full extension at top.', ret:'Step down slowly.', lag:'Incomplete extension at top.', comp:'Trunk lean — keep torso upright.' } },
        { key:'wall_sit',     name:'Wall Sit',
          desc:'Back to wall. Hold 90° position. Camera LEFT.',
          thumb:'🧱',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:true, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.08 },
          cues:{ straight:'Standing at wall.', toPeak:'Slide to 90°.', hold:'Hold — back flat on wall.', ret:'Slide back up.', lag:null, comp:'Back leaving wall.' } },
        { key:'sit_stand',    name:'Sit-to-Stand',
          desc:'From chair, stand and return under control. Camera LEFT.',
          thumb:'🪑',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:155,
          comp:{ hipRise:5, trunkLean:0.07 },
          cues:{ straight:'Seated. Lean slightly forward.', toPeak:'Drive through heels — stand.', hold:'Full extension standing.', ret:'Lower slowly.', lag:'Incomplete extension — stand fully.', comp:'Trunk lean — keep chest tall.' } },
        { key:'lateral_walks',name:'Banded Lateral Walks',
          desc:'Band above knees. Step sideways maintaining squat. Camera FRONT.',
          thumb:'🔀',
          lm:{p1:23,p2:25,p3:27}, hip:23, peakContracted:false, calBoth:true, legRaise:false, lagThr:null,
          comp:{ hipRise:5, trunkLean:0.06 },
          cues:{ straight:'Athletic stance.', toPeak:'Step out — maintain depth.', hold:'Hold. Resist band.', ret:'Bring feet together.', lag:null, comp:'Hip drop — maintain level hips.' } },
    ],
};

// ================================================================
// KALMAN FILTER
// ================================================================
class KF1D {
    constructor(R=0.008,Q=0.08){this.R=R;this.Q=Q;this.x=null;this.p=1;}
    filter(z){
        if(this.x===null){this.x=z;return z;}
        this.p+=this.Q;
        const K=this.p/(this.p+this.R);
        this.x+=K*(z-this.x);
        this.p*=(1-K);
        return this.x;
    }
    reset(){this.x=null;this.p=1;}
}
const KF={};
['hip','knee','ankle','shoulder','foot'].forEach(n=>{KF[n]={x:new KF1D(),y:new KF1D()};});
const LMIDX={hip:23,knee:25,ankle:27,shoulder:11,foot:31};
function fLM(raw,name){const r=raw[LMIDX[name]];return{x:KF[name].x.filter(r.x),y:KF[name].y.filter(r.y),visibility:r.visibility};}
function resetKF(){Object.values(KF).forEach(f=>{f.x.reset();f.y.reset();});}

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
const CAL_MS=3000,CAL_WIN=15,CAL_THR=4,CAL_THR_LR=12;
const CONF=0.85,SIG_FR=8,SKIP=2;

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
    currentPhase=p;
    const meta=PHASE_META[p];
    progressLabel.textContent=`Post-Meniscus · ${meta.label}: ${meta.weeks} · ${meta.desc}`;
    // Rebuild exercise dropdown
    exDropdown.innerHTML='';
    REGISTRY[p].forEach(ex=>{
        const o=document.createElement('option');
        o.value=ex.key; o.textContent=ex.name;
        exDropdown.appendChild(o);
    });
    loadExercise(REGISTRY[p][0]);
}

function loadExercise(ex){
    currentEx=ex;
    // Update exercise card
    exCardName.textContent=ex.name;
    exCardDesc.textContent=ex.desc;
    exCardReps.textContent=`${repCount}/${targetReps}`;
    exCardSets.textContent=`${setCount}/${targetSets}`;
    if(exThumb) exThumb.textContent=ex.thumb||'🦵';
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
    calStep=0; resetCalRing(); lastSpoken='';
    const ex=currentEx;
    if(!ex.calBoth||ex.legRaise){
        calState='waiting_pos1';
        speak('Hold your start position still for 3 seconds.');
    } else if(ex.peakContracted){
        calState='waiting_pos1';
        speak('Straighten your leg fully and hold still for 3 seconds.');
    } else {
        calState='waiting_pos1';
        speak('Hold your start position still for 3 seconds.');
    }
    btnCal.textContent='HOLD START POSITION…';
    updateStatus('CALIBRATING','cal');
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

    ctx.save();
    ctx.clearRect(0,0,canvasEl.width,canvasEl.height);
    ctx.drawImage(results.image,0,0,canvasEl.width,canvasEl.height);

    const lm=results.poseLandmarks;
    drawConnectors(ctx,lm,POSE_CONNECTIONS,{color:'rgba(41,182,246,0.3)',lineWidth:2});
    drawLandmarks(ctx,lm,{color:'rgba(41,182,246,0.5)',lineWidth:1,radius:3});

    if(currentEx){
        const hi=[lm[currentEx.lm.p1],lm[currentEx.lm.p2],lm[currentEx.lm.p3]];
        drawLandmarks(ctx,hi,{color:'#29B6F6',lineWidth:2,radius:7});
    }

    const fHip=fLM(lm,'hip'),fKnee=fLM(lm,'knee'),fAnkle=fLM(lm,'ankle'),fSh=fLM(lm,'shoulder');
    const kx=fKnee.x*canvasEl.width, ky=fKnee.y*canvasEl.height;

    if(calState==='waiting_pos1'||calState==='waiting_pos2'){
        if(fKnee.visibility>0.5)drawCalRing(kx,ky);
    }
    ctx.restore();

    if(!currentEx)return;

    // Confidence gate
    const vis=Math.min(fHip.visibility,fKnee.visibility,fAnkle.visibility);
    if(vis<CONF){
        sigLostFr++;
        if(sigLostFr>=SIG_FR) showSignalToast(true);
        if(!DEV_MODE) return;   // only freeze tracking in production
    } else {
        sigLostFr=0;
        showSignalToast(false);
    }

    // Limb swap guard
    if(limbSwapped(fHip,fKnee,fAnkle,fSh)){sxCompLog.limbInst++;return;}
    if(romFrozen)return;

    const angle=angle3(fHip,fKnee,fAnkle);
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
    if(currentEx.hipFlex){
        const sh=fLM(lm,'shoulder');
        if(sh.visibility>0.6&&fHip.visibility>0.6&&fKnee.visibility>0.6)
            hipFlex=angle3(sh,fHip,fKnee);
    }

    // Calibration
    if(calState==='waiting_pos1'||calState==='waiting_pos2'){
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

    // Velocity
    const now=performance.now();
    const dt=(now-lastVelT)/1000;
    if(dt>0.18){
        velHist.push(Math.abs((angle-lastAngle)/dt));
        if(velHist.length>6)velHist.shift();
        const avg=velHist.reduce((a,b)=>a+b,0)/velHist.length;
        updateVelBand(avg);
        lastVelT=now;
    }

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
// MEDIAPIPE
// ================================================================
const pose=new Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`});
pose.setOptions({modelComplexity:0,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
pose.onResults(onResults);

window.addEventListener('load',async()=>{
    loadPhase(1);
    initExecutivePrescriptionUI();

    // DEV MODE: start mock data ticker and ensure signal overlay stays hidden
    if (DEV_MODE) {
        startMockTicker();
        if (signalOverlay) signalOverlay.classList.add('hidden');
        updateStatus('DEV MODE', 'active');
    }

    const camera=new Camera(videoEl,{
        onFrame:async()=>{if(videoEl.readyState===4)await pose.send({image:videoEl});},
        width:640,height:480,
    });
    await camera.start();
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
    const MIN_SIDEBAR = 500;
    const MAX_SIDEBAR = 760;

    return Math.min(
        MAX_SIDEBAR,
        Math.max(MIN_SIDEBAR, width)
    );
}

function updateSidebarScale(width) {
    let scale = 1;

    if (width >= 620) {
        scale = 1.14;
    }

    if (width >= 700) {
        scale = 1.24;
    }

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
    const DEFAULT_SIDEBAR = 500;
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