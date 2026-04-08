import { getPremiumAudioAmps } from '../AudioEngine.js';

// 將原本全域污染的變數安全地鎖在模組內
let circularRotation = 0;
let circColorOffset = 0; 
let eqColorOffset = 0;
let waveColorOffset = 0;
let eqCapsState = [];

// --- 核心優化：環形緩衝區變數 ---
let waveTrailsBuffer = null;
let waveBufferHead = 0; 

export function renderCircular(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config) {
    const cBgGrad = ctx2D.createRadialGradient(canvas2D.width * 0.70, canvas2D.height / 2, 50 * scale, canvas2D.width * 0.70, canvas2D.height / 2, 900 * scale);
    cBgGrad.addColorStop(0, '#1a1a2e'); cBgGrad.addColorStop(1, '#050505');
    ctx2D.fillStyle = cBgGrad; ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);

    const cx = canvas2D.width * 0.70;
    const cy = canvas2D.height / 2;
    
    const halfBars = Math.floor(config.count / 2);
    const numBins = halfBars + 1; 

    const baseRadius = 180 * scale;
    const dynamicRadius = baseRadius + (safePulse * 40 * scale * config.ampMult);
    const circDynamicBeatAmp = 1.0 + (safePulse * 1.5); 

    const premiumCircAmps = getPremiumAudioAmps(dataArray, 'circAmpsState', numBins, 'circular');

    let cVolSum = 0; for(let i=0; i < dataArray.length * 0.45; i++) cVolSum+=dataArray[i];
    const cVolAvg = cVolSum / (dataArray.length * 0.45);

    circularRotation += (0.005 + (cVolAvg / 255) * 0.04) * config.spinMult; 
    circColorOffset += 1.5 * config.colorMult; 

    ctx2D.save(); 
    ctx2D.translate(cx, cy);
    ctx2D.rotate(circularRotation); 

    const dynamicLineWidth = Math.max(1.0, ((Math.PI * dynamicRadius) / halfBars) * 0.7);

    const drawPremiumCircBar = (angle, amp, val, i) => {
        const startX = Math.cos(angle) * (dynamicRadius + 6*scale);
        const startY = Math.sin(angle) * (dynamicRadius + 6*scale);
        const endX = Math.cos(angle) * (dynamicRadius + 6*scale + amp);
        const endY = Math.sin(angle) * (dynamicRadius + 6*scale + amp);
        
        const hue = ((i / halfBars) * 360 + circColorOffset) % 360;
        
        const barGrad = ctx2D.createLinearGradient(startX, startY, endX, endY);
        barGrad.addColorStop(0, `hsla(${hue}, 100%, 30%, 0.4)`);
        barGrad.addColorStop(0.5, `hsla(${hue}, 100%, 50%, 0.8)`);
        barGrad.addColorStop(1, `hsla(${hue}, 100%, 70%, 1.0)`);

        ctx2D.beginPath();
        ctx2D.moveTo(startX, startY); ctx2D.lineTo(endX, endY);
        ctx2D.strokeStyle = barGrad;
        ctx2D.lineWidth = dynamicLineWidth * scale;
        ctx2D.lineCap = 'round'; 
        ctx2D.shadowBlur = val > 0.3 ? 15 * scale : 5 * scale;
        ctx2D.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx2D.stroke();

        if (val > 0.15) {
            ctx2D.beginPath();
            ctx2D.arc(endX, endY, (dynamicLineWidth / 2) * scale, 0, Math.PI * 2);
            ctx2D.fillStyle = '#ffffff';
            ctx2D.shadowBlur = 12 * scale;
            ctx2D.fill();
        }
    };

    const angleOffset = Math.PI / 2; 

    for (let i = 0; i <= halfBars; i++) {
        const pVal = isA11y ? Math.min(premiumCircAmps[i], 0.4) : premiumCircAmps[i];
        const amp = Math.max(8*scale, Math.pow(pVal, 1.2) * 380 * scale * config.ampMult * circDynamicBeatAmp); 
        
        const angleRight = angleOffset - (i / halfBars) * Math.PI;
        const angleLeft = angleOffset + (i / halfBars) * Math.PI;

        drawPremiumCircBar(angleRight, amp, pVal, i); 
        if (i > 0 && i < halfBars) drawPremiumCircBar(angleLeft, amp, pVal, i); 
    }
    ctx2D.shadowBlur = 0;

    // 繪製唱盤底座
    ctx2D.beginPath(); ctx2D.arc(0, 0, dynamicRadius, 0, Math.PI * 2);
    ctx2D.fillStyle = '#0f0f0f'; ctx2D.fill();
    ctx2D.lineWidth = 3 * scale; ctx2D.strokeStyle = '#222'; ctx2D.stroke();

    ctx2D.lineWidth = 1 * scale; ctx2D.strokeStyle = '#1a1a1a';
    for (let r = dynamicRadius - 15*scale; r > dynamicRadius * 0.4; r -= 8*scale) {
        ctx2D.beginPath(); ctx2D.arc(0, 0, r, 0, Math.PI * 2); ctx2D.stroke();
    }

    const labelR = dynamicRadius * 0.35;
    ctx2D.beginPath(); ctx2D.arc(0, 0, labelR, 0, Math.PI * 2);
    const vinylGrad = ctx2D.createLinearGradient(-labelR, -labelR, labelR, labelR);
    vinylGrad.addColorStop(0, '#00c6ff'); vinylGrad.addColorStop(1, '#0072ff');
    ctx2D.fillStyle = vinylGrad; ctx2D.fill();
    ctx2D.restore(); 

    // 上方文字與光澤
    ctx2D.save();
    ctx2D.translate(cx, cy);
    ctx2D.shadowBlur = 15 * scale;
    ctx2D.shadowColor = '#00c6ff';
    ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx2D.font = `bold ${18*scale}px sans-serif`;
    ctx2D.textAlign = 'center'; ctx2D.textBaseline = 'middle';
    ctx2D.fillText('AUDIO', 0, -14*scale); 
    ctx2D.fillText('VISUAL', 0, 14*scale);
    
    ctx2D.shadowBlur = 0;
    ctx2D.beginPath(); ctx2D.arc(0, 0, 5*scale, 0, Math.PI * 2);
    ctx2D.fillStyle = '#000'; ctx2D.fill();

    const gloss = ctx2D.createLinearGradient(-dynamicRadius, -dynamicRadius, dynamicRadius, dynamicRadius);
    gloss.addColorStop(0, 'rgba(255,255,255,0.15)');
    gloss.addColorStop(0.4, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx2D.fillStyle = gloss;
    ctx2D.beginPath(); ctx2D.arc(0, 0, dynamicRadius, 0, Math.PI * 2); ctx2D.fill();
    ctx2D.restore();
}

export function renderEq(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config) {
    const eBgGrad = ctx2D.createLinearGradient(0, 0, 0, canvas2D.height);
    eBgGrad.addColorStop(0, '#050505'); eBgGrad.addColorStop(1, '#1a1a2e');
    ctx2D.fillStyle = eBgGrad; ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);

    const numEqBars = config.count;
    const eGap = 4 * scale;
    const eWidth = (canvas2D.width / numEqBars) - eGap; 
    
    const premiumEqAmps = getPremiumAudioAmps(dataArray, 'eqAmpsState', numEqBars, 'eq');

    if (eqCapsState.length !== numEqBars) eqCapsState = new Array(numEqBars).fill(0);

    eqColorOffset += 1.5 * config.colorMult; 

    const eBaseY = canvas2D.height * 0.88 + (safePulse * 15 * scale);
    let ex = eGap / 2;

    for (let i = 0; i < numEqBars; i++) {
        const pVal = isA11y ? Math.min(premiumEqAmps[i], 0.4) : premiumEqAmps[i];
        const barHeight = Math.max(4*scale, pVal * (canvas2D.height * 0.65) * config.ampMult);

        const hue = ((i / numEqBars) * 300 + eqColorOffset) % 360;
        const color = `hsl(${hue}, 100%, 60%)`;
        const topColor = `hsl(${hue}, 100%, 80%)`;

        if (barHeight + (10*scale) > eqCapsState[i]) {
            eqCapsState[i] = barHeight + (10*scale);
        } else { 
            eqCapsState[i] -= (3 * scale * config.gravityMult); 
            if (eqCapsState[i] < 0) eqCapsState[i] = 0; 
        }

        const grad = ctx2D.createLinearGradient(0, eBaseY, 0, eBaseY - barHeight);
        grad.addColorStop(0, `hsla(${hue}, 100%, 20%, 0.5)`); grad.addColorStop(1, color); 

        ctx2D.fillStyle = grad; ctx2D.beginPath();
        ctx2D.roundRect(ex, eBaseY - barHeight, eWidth, barHeight, [4*scale, 4*scale, 0, 0]); ctx2D.fill();

        ctx2D.fillStyle = topColor; ctx2D.shadowBlur = 10 * scale; ctx2D.shadowColor = color;
        ctx2D.beginPath(); ctx2D.roundRect(ex, eBaseY - eqCapsState[i] - 5*scale, eWidth, 5*scale, 2*scale); ctx2D.fill();
        ctx2D.shadowBlur = 0; 

        const refHeight = barHeight * 0.3; 
        const refGrad = ctx2D.createLinearGradient(0, eBaseY, 0, eBaseY + refHeight);
        refGrad.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.3)`); refGrad.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`); 

        ctx2D.fillStyle = refGrad; ctx2D.beginPath();
        ctx2D.roundRect(ex, eBaseY + 2*scale, eWidth, refHeight, [0, 0, 4*scale, 4*scale]); ctx2D.fill();
        
        ex += eWidth + eGap;
    }
    ctx2D.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx2D.lineWidth = 2 * scale;
    ctx2D.beginPath(); ctx2D.moveTo(0, eBaseY); ctx2D.lineTo(canvas2D.width, eBaseY); ctx2D.stroke();
}

/**
 * 🌊 霓虹時域波形 - 環形緩衝優化版
 */
export function renderWaveform(ctx2D, canvas2D, analyser, scale, safePulse, isA11y, config) {
    const wBgGrad = ctx2D.createRadialGradient(canvas2D.width/2, canvas2D.height/2, 100*scale, canvas2D.width/2, canvas2D.height/2, 900*scale);
    wBgGrad.addColorStop(0, '#111827'); wBgGrad.addColorStop(1, '#000000');
    ctx2D.fillStyle = wBgGrad; ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);

    waveColorOffset += (2.0 + safePulse * 20.0) * config.colorMult;
    const wBaseY = canvas2D.height * 0.55 + (safePulse * 25 * scale);

    ctx2D.strokeStyle = 'rgba(255, 255, 255, 0.05)'; 
    ctx2D.lineWidth = 2 * scale;
    ctx2D.beginPath(); ctx2D.moveTo(0, wBaseY); ctx2D.lineTo(canvas2D.width, wBaseY); ctx2D.stroke();

    const bufferLength = analyser.frequencyBinCount;
    const maxTrails = Math.max(1, Math.floor(15 * config.glowMult));

    // --- 初始化固定長度的 Float32Array 矩陣 (僅執行一次) ---
    if (!waveTrailsBuffer || waveTrailsBuffer.length !== maxTrails) {
        waveTrailsBuffer = Array.from({ length: maxTrails }, () => new Float32Array(bufferLength));
        waveBufferHead = 0;
    }

    const timeData = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(timeData);

    // --- 將最新數據寫入 Head 位置 ---
    const currentPath = waveTrailsBuffer[waveBufferHead];
    const waveDynamicBeatAmp = 1.0 + (safePulse * 4.0); 
    for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0; 
        let amplitude = (v - 1) * (canvas2D.height / 3.5) * config.ampMult;
        currentPath[i] = isA11y ? (amplitude * 0.5) : (amplitude * waveDynamicBeatAmp);
    }

    const sliceWidth = canvas2D.width * 1.0 / bufferLength;
    ctx2D.globalCompositeOperation = 'lighter';
    ctx2D.lineJoin = 'round'; 
    ctx2D.lineCap = 'round';

    // --- 渲染循環：從 Head 往前追蹤歷史數據 ---
    for (let t = 0; t < maxTrails; t++) {
        const index = (waveBufferHead - t + maxTrails) % maxTrails;
        const path = waveTrailsBuffer[index];
        const ageRatio = t / maxTrails; 
        
        ctx2D.beginPath();
        let wx = 0;
        for (let i = 0; i < bufferLength; i++) {
            let y = wBaseY + path[i];
            if (i === 0) ctx2D.moveTo(wx, y); 
            else ctx2D.lineTo(wx, y);
            wx += sliceWidth;
        }

        const opacity = Math.min(1.0, (1.0 - Math.pow(ageRatio, 0.8)) * (0.4 + safePulse * 1.5)); 
        const hueStart = (waveColorOffset - (t * 10)) % 360;
        
        ctx2D.strokeStyle = `hsla(${hueStart}, 100%, 60%, ${opacity})`;
        ctx2D.lineWidth = (config.thick * scale) + (t * scale * 1.2);
        
        if (t === 0) {
            ctx2D.shadowBlur = (15 + safePulse * 30) * scale;
            ctx2D.shadowColor = `hsla(${hueStart}, 100%, 60%, 1)`;
        } else {
            ctx2D.shadowBlur = 0;
        }
        ctx2D.stroke();
    }

    // --- 更新指針，循環利用空間 ---
    waveBufferHead = (waveBufferHead + 1) % maxTrails;

    ctx2D.globalCompositeOperation = 'source-over';
    
    ctx2D.beginPath();
    let wxCore = 0;
    const newestPath = waveTrailsBuffer[(waveBufferHead - 1 + maxTrails) % maxTrails];
    for (let i = 0; i < bufferLength; i++) {
        let y = wBaseY + newestPath[i];
        if (i === 0) ctx2D.moveTo(wxCore, y); 
        else ctx2D.lineTo(wxCore, y);
        wxCore += sliceWidth;
    }
    ctx2D.lineWidth = Math.max(1.5, config.thick * 0.25 + safePulse * 2.0) * scale;
    ctx2D.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx2D.shadowBlur = 0;
    ctx2D.stroke();
}