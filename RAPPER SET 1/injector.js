(function() {
    'use strict';
    console.log('%c⚡ [GOD-X TOOLS] Initializing Apex 1000X Engine...', 'color:#ff0055;font-weight:900;font-size:16px;text-shadow:0 0 8px #ff0055;');

    if (window.GodXToolsActive) {
        console.log('[GOD-X TOOLS] Already active in this tab.');
        return;
    }
    window.GodXToolsActive = true;

    const DEFAULTS = { 
        gain: 1, 
        echo: 0, 
        talkset: 0, 
        dominance: 0, 
        boost: 0, 
        punch: 0, 
        wide: 0, 
        gate: 0,
        ultra: 0,
        siren: 0
    };
    let PARAMS = { ...DEFAULTS };

    const WORKLET_CODE = `
        class GodXProcessor extends AudioWorkletProcessor {
            static get parameterDescriptors() {
                return [
                    { name: 'gain', defaultValue: 1.0 },
                    { name: 'echo', defaultValue: 0.0 },
                    { name: 'talkset', defaultValue: 0.0 },
                    { name: 'dominance', defaultValue: 0.0 },
                    { name: 'boost', defaultValue: 0.0 },
                    { name: 'punch', defaultValue: 0.0 },
                    { name: 'wide', defaultValue: 0.0 },
                    { name: 'gate', defaultValue: 0.0 },
                    { name: 'ultra', defaultValue: 0.0 },
                    { name: 'siren', defaultValue: 0.0 }
                ];
            }
            constructor() { 
                super(); 
                this.sampleRate = 48000;
                
                this.echoBufSize = 72000;
                this.echoBuf = new Float32Array(this.echoBufSize); 
                this.echoPtr = 0; 

                this.haasSize = 1440;
                this.haasBuf = new Float32Array(this.haasSize);
                this.haasPtr = 0;

                this.dcIn = 0;
                this.dcOut = 0;

                this.presLow = 0;
                this.presBand = 0;
                this.bassLow = 0;
                this.bassBand = 0;

                this.gateEnv = 0.0;
                this.meterCounter = 0;
                this.peakVal = 0;

                // Siren Generator States
                this.sirenPhase = 0;
                this.sirenLfo = 0;
            }

            process(inputs, outputs, parameters) {
                const input = inputs[0]; 
                const output = outputs[0];
                if (!input || !input[0]) return true;

                const g = parameters.gain[0];
                const e = parameters.echo[0];
                const t = parameters.talkset[0];
                const dom = parameters.dominance[0];
                const b = parameters.boost[0];
                const punch = parameters.punch[0];
                const wide = parameters.wide[0];
                const gateThresh = parameters.gate[0];
                const ultra = parameters.ultra[0];
                const siren = parameters.siren[0];

                const numSamples = input[0].length;
                const outL = output[0];
                const outR = output[1] || output[0];

                const fPres = 0.44; 
                const qPres = 1.1;
                const fBass = 0.0235;
                const qBass = 0.9;

                // 1000X ULTRA DEMOLITION MULTIPLIER
                const ultraMult = (ultra > 0.5) ? 1000.0 : 1.0;
                const masterGain = (g * 50.0) * (1.0 + b * 50.0) * ultraMult;

                for (let i = 0; i < numSamples; i++) {
                    let s = input[0][i];

                    // 1. TACTICAL SIREN GENERATOR (Direct Audio-Rate Synthesis)
                    if (siren > 0.1) {
                        this.sirenLfo += 1.4 / this.sampleRate; // 1.4 Hz air-raid cycle
                        if (this.sirenLfo >= 1.0) this.sirenLfo -= 1.0;

                        // Frequency sweep between 650Hz and 1850Hz (peak human ear resonance)
                        const sweep = 0.5 + 0.5 * Math.sin(this.sirenLfo * 2 * Math.PI);
                        const sirenFreq = 650 + sweep * 1200;

                        this.sirenPhase += sirenFreq / this.sampleRate;
                        if (this.sirenPhase >= 1.0) this.sirenPhase -= 1.0;

                        // Harsh square + saw mix for max ear piercing loudness
                        const sqr = this.sirenPhase < 0.5 ? 1.0 : -1.0;
                        const saw = (this.sirenPhase * 2.0) - 1.0;
                        const sirenTone = (sqr * 0.75 + saw * 0.25) * siren * 1.8;

                        s = s * 0.35 + sirenTone;
                    }

                    // 2. DC-BLOCKER (Strips DC drift for 100% full-scale peak symmetry)
                    const dc = s - this.dcIn + 0.996 * this.dcOut;
                    this.dcIn = s;
                    this.dcOut = isNaN(dc) ? 0 : dc;
                    s = this.dcOut;

                    // 3. INTELLIGENT NOISE GATE (Clean silence when not speaking/siren off)
                    if (gateThresh > 0.01 && siren < 0.1) {
                        const absIn = Math.abs(s);
                        this.gateEnv = absIn > this.gateEnv ? this.gateEnv * 0.8 + absIn * 0.2 : this.gateEnv * 0.9995;
                        const targetThresh = gateThresh * 0.04;
                        if (this.gateEnv < targetThresh) {
                            const gateGain = Math.max(0, this.gateEnv / (targetThresh + 1e-6));
                            s *= gateGain;
                        }
                    }

                    // 4. PSYCHOACOUSTIC PRESENCE PEAK (3.4kHz ear canal resonance cut)
                    if (dom > 0) {
                        const highP = s - this.presLow - qPres * this.presBand;
                        const bandP = this.presBand + fPres * highP;
                        const lowP = this.presLow + fPres * bandP;
                        this.presLow = isNaN(lowP) ? 0 : lowP;
                        this.presBand = isNaN(bandP) ? 0 : bandP;
                        s += this.presBand * (dom * 7.5);
                    }

                    // 5. SUB-BASS & CHEST PUNCH (180Hz body expansion)
                    if (punch > 0) {
                        const highB = s - this.bassLow - qBass * this.bassBand;
                        const bandB = this.bassBand + fBass * highB;
                        const lowB = this.bassLow + fBass * bandB;
                        this.bassLow = isNaN(lowB) ? 0 : lowB;
                        this.bassBand = isNaN(bandB) ? 0 : bandB;
                        s += (lowB * 1.5 + this.bassBand) * (punch * 6.0);
                    }

                    // 6. MASTER APEX GAIN DRIVE (Includes 1000X boost multiplier)
                    s *= masterGain;

                    // 7. 1000X ULTRA POWER BRICKWALL RMS MAXIMIZER
                    // Forces every quiet fraction of speech into full 100% saturated power block
                    if (ultra > 0.5) {
                        const absS = Math.abs(s);
                        if (absS > 1e-6) {
                            s = Math.sign(s) * Math.pow(absS, 0.04) * 1.5;
                        }
                        // Multi-band harmonic exciter
                        s += Math.sin(s * 4.0) * 0.35;
                    }

                    // 8. MULTI-STAGE SATURATION & ASYMMETRICAL WAVEFOLDING
                    if (t > 0.01) {
                        const drive = 1.0 + t * 7.0;
                        let x = s * drive;

                        // Asymmetrical tube overdrive
                        x = x >= 0 ? Math.tanh(x) : Math.tanh(x * 1.3) / 1.3;

                        // Harmonic wavefolding
                        if (t > 0.40) {
                            const foldAmt = (t - 0.40) * 2.2;
                            const folded = Math.sin(x * (1.0 + foldAmt * 4.0));
                            x = (1.0 - foldAmt * 0.45) * x + (foldAmt * 0.45) * folded;
                        }

                        // Brickwall RMS Maximizer
                        if (t > 0.75) {
                            const wallAmt = (t - 0.75) * 6.0;
                            x = Math.max(-1.0, Math.min(1.0, x * (1.0 + wallAmt * 10.0)));
                            x = Math.sign(x) * Math.pow(Math.abs(x), 0.15);
                        }

                        s = x;
                    }

                    // 9. ARENA FEEDBACK ECHO
                    if (e > 0.01) {
                        const delaySamples = Math.floor(e * 28000) + 400;
                        const readPtr = (this.echoPtr - delaySamples + this.echoBufSize) % this.echoBufSize;
                        const tap = this.echoBuf[readPtr];
                        const feedback = Math.tanh(s * 0.4 + tap * 0.65);
                        this.echoBuf[this.echoPtr] = feedback;
                        s += tap * (e * 0.85);
                    }
                    this.echoPtr = (this.echoPtr + 1) % this.echoBufSize;

                    // 10. 0 dBFS TRUE PEAK BRICKWALL LIMITER
                    s = Math.max(-0.9995, Math.min(0.9995, s));
                    if (isNaN(s)) s = 0;

                    // 11. HAAS DUAL-EAR WIDENER
                    let leftSample = s;
                    let rightSample = s;

                    if (wide > 0.01) {
                        this.haasBuf[this.haasPtr] = s;
                        const haasDelay = Math.floor(wide * 900) + 120;
                        const haasRead = (this.haasPtr - haasDelay + this.haasSize) % this.haasSize;
                        const delayedS = this.haasBuf[haasRead];
                        
                        leftSample = Math.max(-0.9995, Math.min(0.9995, s + delayedS * (wide * 0.5)));
                        rightSample = Math.max(-0.9995, Math.min(0.9995, delayedS - s * (wide * 0.4)));

                        this.haasPtr = (this.haasPtr + 1) % this.haasSize;
                    }

                    outL[i] = leftSample;
                    outR[i] = rightSample;

                    const absPeak = Math.max(Math.abs(leftSample), Math.abs(rightSample));
                    if (absPeak > this.peakVal) this.peakVal = absPeak;
                }

                this.meterCounter += numSamples;
                if (this.meterCounter >= 2048) {
                    this.port.postMessage({ type: 'meter', peak: this.peakVal });
                    this.peakVal = 0;
                    this.meterCounter = 0;
                }

                return true;
            }
        }
        registerProcessor('godx-engine', GodXProcessor);
    `;

    let workletBlobUrl = null;
    function getWorkletBlobUrl() {
        if (!workletBlobUrl) {
            workletBlobUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }));
        }
        return workletBlobUrl;
    }

    const UI = {
        init() {
            this.injectStyle();
            this.mount();

            setInterval(() => {
                if (!document.getElementById('godx-root') && (document.body || document.documentElement)) {
                    this.mount();
                }
            }, 800);
        },
        injectStyle() {
            if (document.getElementById('godx-style')) return;
            const s = document.createElement('style');
            s.id = 'godx-style';
            s.textContent = `
                @keyframes godxGlow {
                    0% { box-shadow: 0 0 25px rgba(255, 0, 85, 0.4), 0 0 50px rgba(140, 0, 255, 0.2); }
                    50% { box-shadow: 0 0 40px rgba(255, 0, 85, 0.7), 0 0 70px rgba(140, 0, 255, 0.45); }
                    100% { box-shadow: 0 0 25px rgba(255, 0, 85, 0.4), 0 0 50px rgba(140, 0, 255, 0.2); }
                }
                @keyframes pulseDot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.85); }
                }
                @keyframes sirenAlarm {
                    0%, 100% { background: #ff0000; box-shadow: 0 0 25px #ff0000, inset 0 0 15px #fff; }
                    50% { background: #ff7700; box-shadow: 0 0 35px #ffaa00, inset 0 0 15px #ff0; }
                }
                @keyframes ultraPulse {
                    0%, 100% { box-shadow: 0 0 15px #00ffea, 0 0 30px #ff0055; border-color: #00ffea; }
                    50% { box-shadow: 0 0 30px #ff0055, 0 0 45px #00ffea; border-color: #ff0055; }
                }
                #godx-root { 
                    position: fixed !important; 
                    top: 25px !important; 
                    right: 25px !important; 
                    width: 335px !important; 
                    background: linear-gradient(170deg, rgba(16, 4, 18, 0.98) 0%, rgba(6, 1, 8, 0.99) 100%) !important; 
                    border: 1.5px solid rgba(255, 0, 85, 0.7) !important; 
                    color: #fff !important; 
                    z-index: 2147483647 !important; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; 
                    border-radius: 14px !important; 
                    animation: godxGlow 4s infinite ease-in-out !important;
                    backdrop-filter: blur(25px) !important; 
                    transition: width 0.25s, opacity 0.25s, transform 0.2s !important; 
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    box-sizing: border-box !important;
                    pointer-events: auto !important;
                    user-select: none !important;
                }
                #godx-drag { 
                    background: linear-gradient(90deg, #ff0055 0%, #a600ff 100%) !important; 
                    padding: 10px 14px !important; 
                    color: #fff !important; 
                    display: flex !important; 
                    justify-content: space-between !important; 
                    align-items: center !important; 
                    font-size: 11px !important; 
                    cursor: move !important; 
                    border-radius: 13px 13px 0 0 !important; 
                    font-weight: 900 !important;
                    letter-spacing: 0.5px !important;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8) !important;
                }
                .godx-brand { display: flex; align-items: center; gap: 6px; }
                .godx-logo-icon { font-size: 14px; filter: drop-shadow(0 0 5px #fff); }
                .godx-tag { background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 4px; font-size: 9px; border: 1px solid rgba(255,255,255,0.25); color: #00ffea; }
                .godx-btns { display: flex !important; align-items: center !important; gap: 6px !important; }
                #godx-min, #godx-close { 
                    background: rgba(0,0,0,0.6) !important; 
                    color: #ff0055 !important; 
                    border: 1px solid #ff0055 !important; 
                    border-radius: 5px !important; 
                    padding: 2px 8px !important; 
                    cursor: pointer !important; 
                    font-weight: bold !important; 
                    font-size: 11px !important; 
                    transition: 0.2s !important;
                }
                #godx-min:hover, #godx-close:hover { background: #ff0055 !important; color: #fff !important; box-shadow: 0 0 10px #ff0055 !important; }
                
                .godx-wrap { padding: 14px 16px !important; transition: 0.25s !important; overflow: hidden !important; max-height: 990px !important; }
                .godx-minimized .godx-wrap { max-height: 0 !important; padding: 0 !important; opacity: 0 !important; pointer-events: none !important; }
                .godx-minimized { width: 180px !important; }

                /* TOP HUD */
                .godx-hud { display: flex; justify-content: space-between; background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,0,85,0.2); margin-bottom: 10px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px; }
                .godx-status-item { display: flex; align-items: center; gap: 5px; color: #aaa; }
                .godx-dot { width: 6px; height: 6px; border-radius: 50%; background: #666; }
                .godx-dot.active { background: #00ff66; box-shadow: 0 0 8px #00ff66; animation: pulseDot 1.5s infinite; }
                .godx-val { color: #00ffea; }

                /* 20-SEGMENT LED PEAK METER */
                .godx-meter-card { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,0,85,0.3); border-radius: 8px; padding: 7px 10px; margin-bottom: 10px; }
                .godx-meter-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: 900; color: #ff0055; margin-bottom: 4px; letter-spacing: 0.5px; }
                .godx-led-bar { display: flex; gap: 2px; height: 12px; width: 100%; background: #0a0105; padding: 2px; border-radius: 4px; box-sizing: border-box; }
                .godx-led-seg { flex: 1; background: #1f0510; border-radius: 1px; transition: background 0.04s ease; }
                .godx-led-seg.on-green { background: #00ff66; box-shadow: 0 0 6px #00ff66; }
                .godx-led-seg.on-yellow { background: #ffcc00; box-shadow: 0 0 6px #ffcc00; }
                .godx-led-seg.on-orange { background: #ff6600; box-shadow: 0 0 6px #ff6600; }
                .godx-led-seg.on-red { background: #ff0055; box-shadow: 0 0 8px #ff0055; }

                /* DUAL TACTICAL WEAPON BUTTONS: SIREN & 1000X BOOST */
                .godx-weapon-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
                .godx-weapon-btn { 
                    padding: 9px 6px !important; 
                    border-radius: 7px !important; 
                    font-size: 10px !important; 
                    font-weight: 900 !important; 
                    cursor: pointer !important; 
                    text-align: center !important; 
                    transition: 0.2s !important; 
                    letter-spacing: 0.5px !important; 
                    border: 1.5px solid transparent !important;
                }
                #godx-siren-btn {
                    background: linear-gradient(135deg, #2b0000 0%, #150000 100%) !important;
                    border-color: #ff2200 !important;
                    color: #ff4422 !important;
                }
                #godx-siren-btn.active {
                    animation: sirenAlarm 0.4s infinite !important;
                    color: #fff !important;
                    text-shadow: 0 0 5px #000 !important;
                }
                #godx-ultra-btn {
                    background: linear-gradient(135deg, #021a24 0%, #0c0018 100%) !important;
                    border-color: #00ffea !important;
                    color: #00ffea !important;
                }
                #godx-ultra-btn.active {
                    animation: ultraPulse 1.5s infinite !important;
                    background: linear-gradient(135deg, #ff0055 0%, #00ffea 100%) !important;
                    color: #fff !important;
                    text-shadow: 0 0 6px #000 !important;
                }

                /* CENTRAL CORE DISPLAY CARD */
                .godx-core-card { 
                    background: radial-gradient(circle at center, rgba(35, 5, 45, 0.7) 0%, rgba(10, 0, 15, 0.9) 100%); 
                    border: 1px solid rgba(166, 0, 255, 0.4); 
                    border-radius: 8px; 
                    padding: 8px; 
                    text-align: center; 
                    margin-bottom: 8px; 
                    box-shadow: inset 0 0 20px rgba(166,0,255,0.15);
                }
                #godx-icon { font-size: 24px; margin-bottom: 2px; filter: drop-shadow(0 0 8px rgba(255,0,85,0.8)); }
                #godx-mode { font-size: 9px; color: #00ffea; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
                .godx-big-val { font-size: 20px; font-weight: 900; color: #ff0055; text-shadow: 0 0 12px rgba(255,0,85,0.8); }

                /* SLIDERS */
                .godx-row { display: flex !important; justify-content: space-between !important; font-size: 9.5px !important; font-weight: 800 !important; margin-bottom: 2px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; color: #ddd !important; }
                .godx-row b { color: #ff0055 !important; }
                .godx-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px; }
                .godx-bar { width: 100% !important; height: 3px !important; background: #20000a !important; border-radius: 2px !important; margin-bottom: 6px !important; overflow: hidden !important; border: 1px solid #350012 !important; }
                .godx-prog { height: 100% !important; background: linear-gradient(90deg, #ff0055, #a600ff) !important; width: 0% !important; box-shadow: 0 0 8px #ff0055 !important; }
                #godx-root input[type=range] { width: 100% !important; accent-color: #ff0055 !important; cursor: pointer !important; background: transparent !important; height: 13px !important; margin-bottom: 2px !important; }

                /* PRESETS */
                .godx-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
                .godx-btn { 
                    background: linear-gradient(135deg, rgba(25, 3, 30, 0.9), rgba(12, 1, 15, 0.9)) !important; 
                    border: 1px solid rgba(255, 0, 85, 0.4) !important; 
                    color: #fff !important; 
                    padding: 7px 5px !important; 
                    border-radius: 6px !important; 
                    font-size: 9px !important; 
                    font-weight: 900 !important; 
                    cursor: pointer !important; 
                    transition: 0.2s !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important; 
                    gap: 3px !important; 
                    letter-spacing: 0.5px !important;
                }
                .godx-btn:hover { 
                    border-color: #ff0055 !important; 
                    background: linear-gradient(135deg, #ff0055, #a600ff) !important; 
                    box-shadow: 0 0 15px rgba(255,0,85,0.6) !important; 
                    transform: translateY(-1px) !important;
                }
                .godx-btn.nuke { 
                    border-color: #ff0055 !important; 
                    color: #ffcc00 !important; 
                    background: linear-gradient(135deg, rgba(50, 0, 20, 0.9), rgba(20, 0, 30, 0.9)) !important; 
                    box-shadow: 0 0 10px rgba(255,0,85,0.3) !important;
                }
                .godx-btn.nuke:hover { 
                    background: linear-gradient(90deg, #ff0055, #ff6600) !important; 
                    color: #fff !important;
                }

                .godx-footer { text-align: center !important; font-size: 8px !important; margin-top: 8px !important; color: #666 !important; letter-spacing: 1.5px !important; }
                
                #godx-pill { 
                    position: fixed !important; 
                    top: 15px !important; 
                    right: 15px !important; 
                    background: linear-gradient(135deg, rgba(20, 2, 25, 0.95), rgba(8, 0, 10, 0.98)) !important; 
                    border: 1.5px solid #ff0055 !important; 
                    color: #fff !important; 
                    padding: 7px 14px !important; 
                    font-size: 11px !important; 
                    font-weight: 900 !important; 
                    border-radius: 20px !important; 
                    cursor: pointer !important; 
                    z-index: 2147483647 !important; 
                    box-shadow: 0 0 20px rgba(255, 0, 85, 0.6) !important; 
                    display: none; 
                    user-select: none !important; 
                    transition: 0.2s !important;
                }
                #godx-pill:hover { background: #ff0055 !important; transform: scale(1.05) !important; }
            `;
            (document.head || document.documentElement).appendChild(s);
        },
        mount() {
            const parent = document.body || document.documentElement;
            if (!parent) return;
            if (document.getElementById('godx-root')) return;

            let ledHtml = '';
            for (let i = 0; i < 20; i++) {
                ledHtml += `<div class="godx-led-seg" id="godx-seg-${i}"></div>`;
            }

            const div = document.createElement('div');
            div.id = 'godx-root';
            div.innerHTML = `
                <div id="godx-drag">
                    <div class="godx-brand">
                        <span class="godx-logo-icon">⚡</span>
                        <span>GOD-X TOOLS</span>
                        <span class="godx-tag">1000X APEX</span>
                    </div>
                    <div class="godx-btns">
                        <button id="godx-min" title="Minimize">_</button>
                        <button id="godx-close" title="Hide (or press F8)">✕</button>
                    </div>
                </div>
                <div id="godx-content" class="godx-wrap">
                    <!-- HUD STATS -->
                    <div class="godx-hud">
                        <div class="godx-status-item">
                            <div id="godx-live-dot" class="godx-dot"></div>
                            <span id="godx-live-txt">OFFLINE</span>
                        </div>
                        <div class="godx-status-item">PEAK: <span class="godx-val" id="godx-hud-peak">-∞ dB</span></div>
                        <div class="godx-status-item">MODE: <span class="godx-val" id="godx-hud-mode">NORMAL</span></div>
                    </div>

                    <!-- LED PEAK METER -->
                    <div class="godx-meter-card">
                        <div class="godx-meter-header">
                            <span>1000X POWER SPECTRUM</span>
                            <span id="godx-peak-db">0.0 dBFS MAX</span>
                        </div>
                        <div class="godx-led-bar">
                            ${ledHtml}
                        </div>
                    </div>

                    <!-- TACTICAL WEAPON TOGGLE BUTTONS (SIREN + 1000X ULTRA) -->
                    <div class="godx-weapon-row">
                        <button id="godx-siren-btn" class="godx-weapon-btn">🚨 SIREN: OFF</button>
                        <button id="godx-ultra-btn" class="godx-weapon-btn">⚡ 1000X: OFF</button>
                    </div>

                    <!-- MAIN GAIN -->
                    <div class="godx-row">MASTER GAIN <b id="v-gx-g">${PARAMS.gain}x</b></div>
                    <div class="godx-bar"><div id="bar-gx-g" class="godx-prog" style="width:${(PARAMS.gain/300)*100}%"></div></div>
                    <input type="range" id="gx-g" min="1" max="300" value="${PARAMS.gain}">

                    <!-- CENTRAL CORE SATURATION CARD -->
                    <div class="godx-core-card">
                        <div id="godx-icon">⚡</div>
                        <div id="godx-mode">CLEAN DRIVE</div>
                        <div id="v-gx-t" class="godx-big-val">${Math.round(PARAMS.talkset*100)}%</div>
                    </div>
                    <div class="godx-bar"><div id="bar-gx-t" class="godx-prog" style="width:${PARAMS.talkset*100}%"></div></div>
                    <input type="range" id="gx-t" min="0" max="100" value="${Math.round(PARAMS.talkset*100)}">

                    <!-- FREQUENCY POWER GRID -->
                    <div class="godx-grid">
                        <div>
                            <div class="godx-row">PRESENCE CUT <b id="v-gx-dom">${Math.round(PARAMS.dominance*100)}%</b></div>
                            <div class="godx-bar"><div id="bar-gx-dom" class="godx-prog" style="width:${PARAMS.dominance*100}%"></div></div>
                            <input type="range" id="gx-dom" min="0" max="100" value="${Math.round(PARAMS.dominance*100)}">
                        </div>
                        <div>
                            <div class="godx-row">CHEST PUNCH <b id="v-gx-punch">${Math.round(PARAMS.punch*100)}%</b></div>
                            <div class="godx-bar"><div id="bar-gx-punch" class="godx-prog" style="width:${PARAMS.punch*100}%"></div></div>
                            <input type="range" id="gx-punch" min="0" max="100" value="${Math.round(PARAMS.punch*100)}">
                        </div>
                    </div>

                    <!-- SPATIAL & REVERB GRID -->
                    <div class="godx-grid">
                        <div>
                            <div class="godx-row">DUAL-EAR WIDE <b id="v-gx-wide">${Math.round(PARAMS.wide*100)}%</b></div>
                            <div class="godx-bar"><div id="bar-gx-wide" class="godx-prog" style="width:${PARAMS.wide*100}%"></div></div>
                            <input type="range" id="gx-wide" min="0" max="100" value="${Math.round(PARAMS.wide*100)}">
                        </div>
                        <div>
                            <div class="godx-row">ARENA ECHO <b id="v-gx-e">${Math.round(PARAMS.echo*100)}%</b></div>
                            <div class="godx-bar"><div id="bar-gx-e" class="godx-prog" style="width:${PARAMS.echo*100}%"></div></div>
                            <input type="range" id="gx-e" min="0" max="100" value="${Math.round(PARAMS.echo*100)}">
                        </div>
                    </div>

                    <!-- BATTLE BOOST -->
                    <div class="godx-row">BATTLE BOOST <b id="v-gx-b">${Math.round(PARAMS.boost*100)}%</b></div>
                    <div class="godx-bar"><div id="bar-gx-b" class="godx-prog" style="width:${PARAMS.boost*100}%"></div></div>
                    <input type="range" id="gx-b" min="0" max="100" value="${Math.round(PARAMS.boost*100)}">

                    <!-- NOISE GATE -->
                    <div class="godx-row">NOISE GATE (ANTI-HISS) <b id="v-gx-gate">${PARAMS.gate === 0 ? 'OFF' : Math.round(PARAMS.gate*100) + '%'}</b></div>
                    <div class="godx-bar"><div id="bar-gx-gate" class="godx-prog" style="width:${PARAMS.gate*100}%"></div></div>
                    <input type="range" id="gx-gate" min="0" max="100" value="${Math.round(PARAMS.gate*100)}">

                    <!-- 1-CLICK PRESETS -->
                    <div class="godx-presets">
                        <button id="godx-nuke" class="godx-btn nuke">⚡ 1000X NUKE</button>
                        <button id="godx-demon" class="godx-btn">👺 DEMON VOID</button>
                        <button id="godx-scream" class="godx-btn">💀 SCREAM-WAR</button>
                        <button id="godx-reset" class="godx-btn">🛡️ CLEAN RESET</button>
                    </div>

                    <div class="godx-footer">GOD-X 1000X EDITION // PRESS [F8] TO TOGGLE</div>
                </div>
            `;
            parent.appendChild(div);

            if (!document.getElementById('godx-pill')) {
                const pill = document.createElement('div');
                pill.id = 'godx-pill';
                pill.innerHTML = '⚡ GOD-X [F8]';
                parent.appendChild(pill);
            }

            this.injectStyle();
            this.events();
            console.log('%c⚡ [GOD-X TOOLS 1000X] Mounted Successfully!', 'color:#00ffea;font-weight:bold;');
        },
        events() {
            const minBtn = document.getElementById('godx-min');
            const closeBtn = document.getElementById('godx-close');
            const pill = document.getElementById('godx-pill');
            const root = document.getElementById('godx-root');
            const sirenBtn = document.getElementById('godx-siren-btn');
            const ultraBtn = document.getElementById('godx-ultra-btn');
            const hudMode = document.getElementById('godx-hud-mode');

            if (minBtn && root) {
                minBtn.onclick = () => {
                    root.classList.toggle('godx-minimized');
                    minBtn.innerText = root.classList.contains('godx-minimized') ? "+" : "_";
                };
            }

            const togglePanel = () => {
                if (!root) return;
                const isHidden = root.style.display === 'none';
                root.style.display = isHidden ? 'block' : 'none';
                if (pill) pill.style.display = isHidden ? 'none' : 'block';
            };

            if (closeBtn) closeBtn.onclick = togglePanel;
            if (pill) pill.onclick = togglePanel;

            // F8 Global Hotkey Toggle
            if (!window._godxHotkeyAttached) {
                window._godxHotkeyAttached = true;
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'F8') {
                        e.preventDefault();
                        togglePanel();
                    }
                });
            }

            // SIREN BUTTON TOGGLE
            if (sirenBtn) {
                sirenBtn.onclick = () => {
                    PARAMS.siren = (PARAMS.siren > 0.5) ? 0 : 1;
                    if (PARAMS.siren > 0.5) {
                        sirenBtn.classList.add('active');
                        sirenBtn.innerText = '🚨 SIREN: ACTIVE!';
                    } else {
                        sirenBtn.classList.remove('active');
                        sirenBtn.innerText = '🚨 SIREN: OFF';
                    }
                    Core.update();
                };
            }

            // 1000X ULTRA BOOST TOGGLE
            if (ultraBtn) {
                ultraBtn.onclick = () => {
                    PARAMS.ultra = (PARAMS.ultra > 0.5) ? 0 : 1;
                    if (PARAMS.ultra > 0.5) {
                        ultraBtn.classList.add('active');
                        ultraBtn.innerText = '⚡ 1000X: DEMOLITION';
                        if (hudMode) { hudMode.innerText = '1000X MAX'; hudMode.style.color = '#ff0055'; }
                    } else {
                        ultraBtn.classList.remove('active');
                        ultraBtn.innerText = '⚡ 1000X: OFF';
                        if (hudMode) { hudMode.innerText = 'NORMAL'; hudMode.style.color = '#00ffea'; }
                    }
                    Core.update();
                };
            }

            // Draggable Window Handler
            const dragHeader = document.getElementById('godx-drag');
            if (dragHeader && root) {
                let isDragging = false, startX, startY, origLeft, origTop;
                dragHeader.onmousedown = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    const rect = root.getBoundingClientRect();
                    origLeft = rect.left;
                    origTop = rect.top;
                    root.style.right = 'auto';
                    root.style.left = origLeft + 'px';
                    root.style.top = origTop + 'px';
                    const onMouseMove = (ev) => {
                        if (!isDragging) return;
                        root.style.left = (origLeft + ev.clientX - startX) + 'px';
                        root.style.top = (origTop + ev.clientY - startY) + 'px';
                    };
                    const onMouseUp = () => {
                        isDragging = false;
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                };
            }

            const ids = ['gx-g', 'gx-e', 'gx-t', 'gx-dom', 'gx-b', 'gx-punch', 'gx-wide', 'gx-gate'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.oninput = () => {
                    const v = Number(el.value);
                    const bar = document.getElementById('bar-' + id);
                    if (bar) bar.style.width = ((v / el.max) * 100) + '%';
                    
                    const label = document.getElementById('v-' + id);
                    if (id === 'gx-g') {
                        PARAMS.gain = v;
                        if (label) label.innerText = v + 'x';
                    } else if (id === 'gx-e') {
                        PARAMS.echo = v / 100;
                        if (label) label.innerText = v + '%';
                    } else if (id === 'gx-dom') {
                        PARAMS.dominance = v / 100;
                        if (label) label.innerText = v + '%';
                    } else if (id === 'gx-b') {
                        PARAMS.boost = v / 100;
                        if (label) label.innerText = v + '%';
                    } else if (id === 'gx-punch') {
                        PARAMS.punch = v / 100;
                        if (label) label.innerText = v + '%';
                    } else if (id === 'gx-wide') {
                        PARAMS.wide = v / 100;
                        if (label) label.innerText = v + '%';
                    } else if (id === 'gx-gate') {
                        PARAMS.gate = v / 100;
                        if (label) label.innerText = v === 0 ? 'OFF' : v + '%';
                    } else if (id === 'gx-t') {
                        PARAMS.talkset = v / 100;
                        let icon = "⚡", mode = "CLEAN DRIVE";
                        if (v > 20) { icon = "🌑"; mode = "TUBE OVERDRIVE"; }
                        if (v > 45) { icon = "👺"; mode = "DEMON WAVE"; }
                        if (v > 70) { icon = "💀"; mode = "SCREAM SQUARER"; }
                        if (v >= 90) { icon = "☣️"; mode = "GOD-MODE MAX"; }
                        const iconEl = document.getElementById('godx-icon');
                        const modeEl = document.getElementById('godx-mode');
                        const bigValEl = document.getElementById('v-gx-t');
                        if (iconEl) iconEl.innerText = icon;
                        if (modeEl) modeEl.innerText = mode;
                        if (bigValEl) bigValEl.innerText = v + '%';
                        if (label) label.innerText = v + '%';
                    }
                    Core.update();
                };
            });

            const applyPreset = (cfg) => {
                for (const key in cfg) {
                    const el = document.getElementById(key);
                    if (el) {
                        el.value = cfg[key];
                        el.dispatchEvent(new Event('input'));
                    }
                }
            };

            // Preset: 1000X NUKE (Absolute Decibel Demolition)
            const nukeBtn = document.getElementById('godx-nuke');
            if (nukeBtn) {
                nukeBtn.onclick = () => {
                    applyPreset({
                        'gx-g': 300, 'gx-t': 98, 'gx-dom': 95, 'gx-punch': 90,
                        'gx-wide': 70, 'gx-e': 18, 'gx-b': 95, 'gx-gate': 15
                    });
                    if (PARAMS.ultra < 0.5 && ultraBtn) {
                        ultraBtn.click();
                    }
                };
            }

            // Preset: DEMON VOID
            const demonBtn = document.getElementById('godx-demon');
            if (demonBtn) {
                demonBtn.onclick = () => applyPreset({
                    'gx-g': 180, 'gx-t': 65, 'gx-dom': 45, 'gx-punch': 100,
                    'gx-wide': 50, 'gx-e': 35, 'gx-b': 70, 'gx-gate': 30
                });
            }

            // Preset: SCREAM-WAR
            const screamBtn = document.getElementById('godx-scream');
            if (screamBtn) {
                screamBtn.onclick = () => applyPreset({
                    'gx-g': 220, 'gx-t': 80, 'gx-dom': 100, 'gx-punch': 40,
                    'gx-wide': 75, 'gx-e': 10, 'gx-b': 90, 'gx-gate': 25
                });
            }

            // Preset: CLEAN RESET
            const resetBtn = document.getElementById('godx-reset');
            if (resetBtn) {
                resetBtn.onclick = () => {
                    applyPreset({
                        'gx-g': 1, 'gx-t': 0, 'gx-dom': 0, 'gx-punch': 0,
                        'gx-wide': 0, 'gx-e': 0, 'gx-b': 0, 'gx-gate': 0
                    });
                    if (PARAMS.ultra > 0.5 && ultraBtn) ultraBtn.click();
                    if (PARAMS.siren > 0.5 && sirenBtn) sirenBtn.click();
                };
            }

            // Status checker
            setInterval(() => {
                const dot = document.getElementById('godx-live-dot');
                const txt = document.getElementById('godx-live-txt');
                if (!dot || !txt) return;
                if (window.DiscordCtx && window.DiscordCtx.state === 'running') {
                    dot.className = "godx-dot active";
                    txt.innerText = "ONLINE";
                    txt.style.color = "#00ff66";
                } else {
                    dot.className = "godx-dot";
                    txt.innerText = "STANDBY";
                    txt.style.color = "#888";
                }
            }, 1000);
        },
        updatePeak(peak) {
            const numSegs = 20;
            const activeCount = Math.round(Math.min(1, peak) * numSegs);
            
            for (let i = 0; i < numSegs; i++) {
                const seg = document.getElementById('godx-seg-' + i);
                if (!seg) continue;
                if (i < activeCount) {
                    if (i < 10) seg.className = 'godx-led-seg on-green';
                    else if (i < 14) seg.className = 'godx-led-seg on-yellow';
                    else if (i < 17) seg.className = 'godx-led-seg on-orange';
                    else seg.className = 'godx-led-seg on-red';
                } else {
                    seg.className = 'godx-led-seg';
                }
            }

            const dbHeader = document.getElementById('godx-peak-db');
            const hudPeak = document.getElementById('godx-hud-peak');
            if (peak <= 0.0001) {
                if (dbHeader) dbHeader.innerText = "-∞ dBFS";
                if (hudPeak) hudPeak.innerText = "-∞ dB";
            } else {
                const db = (20 * Math.log10(peak)).toFixed(1);
                const str = db >= -0.1 ? "0.0 dB (MAX)" : db + " dB";
                if (dbHeader) dbHeader.innerText = str;
                if (hudPeak) hudPeak.innerText = str;
            }
        }
    };

    const Core = {
        node: null,
        async init(stream) {
            try {
                const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
                window.DiscordCtx = ctx;
                await ctx.audioWorklet.addModule(getWorkletBlobUrl());
                const source = ctx.createMediaStreamSource(stream);
                const dest = ctx.createMediaStreamDestination();
                
                this.node = new AudioWorkletNode(ctx, 'godx-engine', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [2]
                });

                this.node.port.onmessage = (e) => {
                    if (e.data && e.data.type === 'meter') {
                        UI.updatePeak(e.data.peak);
                    }
                };

                source.connect(this.node).connect(dest);
                this.update();
                console.log('%c⚡ [GOD-X TOOLS 1000X] Audio Core Online & Hijacking Stream!', 'color:#00ffea;font-weight:bold;');
                return dest.stream;
            } catch (err) {
                console.error('[GOD-X TOOLS] Audio init error:', err);
                return stream;
            }
        },
        update() {
            if (!this.node || !window.DiscordCtx) return;
            const now = window.DiscordCtx.currentTime;
            for (let p in PARAMS) {
                const param = this.node.parameters.get(p);
                if (param) {
                    param.setTargetAtTime(PARAMS[p], now, 0.005);
                }
            }
        }
    };

    // Strip Discord/WebRTC browser filters for raw digital audio power
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (c) => {
            if (c && c.audio) {
                c.audio = { 
                    echoCancellation: false, 
                    noiseSuppression: false, 
                    autoGainControl: false,
                    googEchoCancellation: false,
                    googNoiseSuppression: false,
                    googAutoGainControl: false,
                    googHighpassFilter: false,
                    googTypingNoiseDetection: false,
                    channelCount: 2
                };
            }
            const s = await origGetUserMedia(c);
            if (c && c.audio) return await Core.init(s);
            return s;
        };
    }

    // Start UI
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UI.init());
    } else {
        UI.init();
    }
})();
