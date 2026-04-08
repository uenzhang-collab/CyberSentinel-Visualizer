import { AudioEngine } from './AudioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';
import { initNebulaShader, renderNebulaShader } from './vfx/NebulaShader.js';
import { translations } from './i18n.js';

// ==========================================
// 🌐 全域翻譯引擎 (動態文字處理)
// ==========================================
window.t = function(key) {
    const lang = localStorage.getItem('preferredLang') || 'zh-TW';
    return translations[lang] && translations[lang][key] ? translations[lang][key] : key;
};

// ==========================================
// UI DOM 變數與基礎設定
// ==========================================
const audioPlayer = document.getElementById('audioPlayer');
const btnRecord = document.getElementById('btnRecord');
const btnStopRecord = document.getElementById('btnStopRecord');
const vfxSelector = document.getElementById('vfxSelector');
const lyricsInput = document.getElementById('lyricsInput');

let audio = new AudioEngine();
let streamDestination = null;
let isDrawing = false;
let currentMode = null;
let mediaRecorder, recordedChunks = [];
let logoImg = new Image();

const canvas2D = document.getElementById('visualizer2D');
const ctx2D = canvas2D.getContext('2d');
const canvas3D = document.getElementById('visualizer3D'); 
const particleCanvas = document.createElement('canvas');
const pCtx = particleCanvas.getContext('2d');

let rm, vfxManager, aurora, sun; 
let nebulaSystem; 

// ==========================================
// 🌟 畫面排版與拖曳狀態管理 (Layout & Dragging)
// ==========================================
let layoutOffsets = {
    channel: { px: 0.04, py: 0.06 }, 
    titles: { px: 0.50, py: 0.16 },  
    logo: { px: 0.96, py: 0.06 },    
    lyrics: { px: 0.50, py: 0.90 }   
};
let hitboxes = { channel: {x:0,y:0,w:0,h:0}, titles: {x:0,y:0,w:0,h:0}, logo: {x:0,y:0,w:0,h:0}, lyrics: {x:0,y:0,w:0,h:0} };
let dragTarget = null;
let hoverTarget = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let userHasDragged = false; 

function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm;
    vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora;
    sun = auroraSystem.sun;
    nebulaSystem = initNebulaShader(canvas3D);
}

function applyResolution(width, height) {
    canvas2D.width = width;
    canvas2D.height = height;
    canvas3D.width = width;
    canvas3D.height = height;
    particleCanvas.width = width;
    particleCanvas.height = height;
    
    pCtx.fillStyle = '#000000';
    pCtx.fillRect(0, 0, width, height);

    if (rm && rm.renderer) {
        rm.renderer.setSize(width, height, false);
        rm.camera.aspect = width / height;
        rm.camera.updateProjectionMatrix();
    }
    
    if (nebulaSystem && nebulaSystem.renderer) {
        nebulaSystem.renderer.setSize(width, height, false);
    }
    forceRenderFrame();
}

function getScale() { 
    return canvas2D.width / 1920; 
}

window.ESG_ECO_MODE = false;

async function initESGMode() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            const handleBatteryChange = () => {
                if (battery.level <= 0.20 && !battery.charging) {
                    window.ESG_ECO_MODE = true;
                    const notice = document.getElementById('energyNotice');
                    if(notice) {
                        notice.innerHTML = '<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> <span>' + window.t('esg_eco_mode') + '</span>';
                        notice.style.display = 'flex';
                    }
                } else {
                    window.ESG_ECO_MODE = false;
                    const notice = document.getElementById('energyNotice');
                    if(notice && !document.hidden) notice.style.display = 'none';
                }
            };
            battery.addEventListener('levelchange', handleBatteryChange);
            battery.addEventListener('chargingchange', handleBatteryChange);
            handleBatteryChange();
        } catch(e) {
            console.log('Battery Status API not fully supported.');
        }
    }
}

function getVfxConfig() {
    const config = {
        aurora: {
            rotSpeed: parseFloat(document.getElementById('slRotation')?.value) || 0.2,
            transmission: parseFloat(document.getElementById('slTransmission')?.value) || 0.9,
            showAurora: document.getElementById('chkAurora')?.checked ?? true,
            showSun: document.getElementById('chkSun')?.checked ?? true,
        },
        particle: {
            amountMult: parseFloat(document.getElementById('slParticleAmount')?.value) || 1.0,
            speedMult: parseFloat(document.getElementById('slParticleSpeed')?.value) || 1.0,
        },
        circular: {
            count: parseInt(document.getElementById('slCircCount')?.value) || 360,
            ampMult: parseFloat(document.getElementById('slCircAmp')?.value) || 1.0,
            colorMult: parseFloat(document.getElementById('slCircColor')?.value) || 1.0,
            spinMult: parseFloat(document.getElementById('slCircSpin')?.value) || 1.0,
        },
        eq: {
            count: parseInt(document.getElementById('slEqCount')?.value) || 128,
            ampMult: parseFloat(document.getElementById('slEqAmp')?.value) || 1.0,
            colorMult: parseFloat(document.getElementById('slEqColor')?.value) || 1.0,
            gravityMult: parseFloat(document.getElementById('slEqGravity')?.value) || 1.0,
        },
        waveform: {
            ampMult: parseFloat(document.getElementById('slWaveAmp')?.value) || 1.0,
            colorMult: parseFloat(document.getElementById('slWaveColor')?.value) || 1.0,
            glowMult: parseFloat(document.getElementById('slWaveGlow')?.value) || 1.0,
            thick: parseFloat(document.getElementById('slWaveThick')?.value) || 5.0,
        },
        nebula: { 
            viscosity: parseFloat(document.getElementById('slNebViscosity')?.value) || 0.2,
            colorFlow: parseFloat(document.getElementById('slNebColor')?.value) || 1.0,
        }
    };

    if (window.ESG_ECO_MODE) {
        config.particle.amountMult = Math.min(config.particle.amountMult, 0.25); 
        config.waveform.glowMult = Math.min(config.waveform.glowMult, 0.3); 
        config.circular.count = Math.min(config.circular.count, 90); 
        config.eq.count = Math.min(config.eq.count, 64); 
        config.nebula.viscosity = Math.min(config.nebula.viscosity, 0.1); 
    }
    return config;
}

function renderScene(activeVfx, dataArray, safePulse, scale, isA11y, config) {
    switch (activeVfx) {
        case 'aurora':
            canvas3D.style.display = 'block';
            renderAurora3D(ctx2D, canvas2D, canvas3D, rm, vfxManager, aurora, sun, dataArray, safePulse, config.aurora);
            break;
        case 'nebula': 
            canvas3D.style.display = 'block';
            ctx2D.fillStyle = '#000000';
            ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height); 
            renderNebulaShader(nebulaSystem, canvas2D.width, canvas2D.height, safePulse, config.nebula);
            ctx2D.drawImage(canvas3D, 0, 0, canvas2D.width, canvas2D.height);
            break;
        case 'particle':
            canvas3D.style.display = 'none';
            renderParticles(ctx2D, canvas2D, particleCanvas, pCtx, dataArray, scale, isA11y, config.particle);
            break;
        case 'circular':
            canvas3D.style.display = 'none';
            renderCircular(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config.circular);
            break;
        case 'eq':
            canvas3D.style.display = 'none';
            renderEq(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config.eq);
            break;
        case 'waveform':
            canvas3D.style.display = 'none';
            renderWaveform(ctx2D, canvas2D, audio.analyser, scale, safePulse, isA11y, config.waveform);
            break;
    }
}

function forceRenderFrame() {
    if (isDrawing) return; 

    let dataArray = new Uint8Array(256);
    let safePulse = 0;
    
    if (audio.analyser) {
        const bufferLength = audio.analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        audio.analyser.getByteFrequencyData(dataArray);
        const bassSum = dataArray.slice(0, 6).reduce((a, b) => a + b, 0);
        const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
        const isA11y = document.getElementById('chkA11y')?.checked || false;
        safePulse = isA11y ? Math.min(orbPulse, 0.15) : orbPulse;
    }

    const activeVfx = vfxSelector.value;
    const scale = getScale(); 
    const config = getVfxConfig();
    const isA11y = document.getElementById('chkA11y')?.checked || false;

    ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
    renderScene(activeVfx, dataArray, safePulse, scale, isA11y, config);
    drawLayout();
    drawLyrics();
    drawInteractions(); 
}

function drawMasterLoop() {
    if (!isDrawing) return;
    requestAnimationFrame(drawMasterLoop);
    
    if (!audio.analyser) return;

    const bufferLength = audio.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audio.analyser.getByteFrequencyData(dataArray);
    
    const activeVfx = vfxSelector.value;
    const scale = getScale(); 

    const bassSum = dataArray.slice(0, 6).reduce((a, b) => a + b, 0);
    const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
    const isA11y = document.getElementById('chkA11y').checked;
    const safePulse = isA11y ? Math.min(orbPulse, 0.15) : orbPulse;

    const config = getVfxConfig();

    renderScene(activeVfx, dataArray, safePulse, scale, isA11y, config);
    drawLayout();
    drawLyrics();
    drawInteractions(); 
}

function showPrivacyToast() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-gray-900/95 backdrop-blur-md border border-blue-500/50 text-blue-300 px-5 py-4 rounded-xl text-sm shadow-2xl z-[100] flex items-center gap-4 transform transition-all duration-700 translate-y-24 opacity-0 max-w-sm';
    toast.innerHTML = `
        <span class="text-2xl drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">🛡️</span> 
        <p data-i18n="privacy_notice" class="leading-relaxed"></p> 
        <button class="text-gray-500 hover:text-white text-xl leading-none transition-colors" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);
    
    toast.querySelector('[data-i18n]').textContent = window.t('privacy_notice');
    
    requestAnimationFrame(() => {
        setTimeout(() => { toast.classList.remove('translate-y-24', 'opacity-0'); }, 100);
    });
    setTimeout(() => {
        if(document.body.contains(toast)) {
            toast.classList.add('translate-y-24', 'opacity-0');
            setTimeout(() => { if(document.body.contains(toast)) toast.remove(); }, 700);
        }
    }, 8000);
}

function drawLayout() {
    const cName = document.getElementById('channelName').value.trim();
    const topic = document.getElementById('topicTitle').value.trim();
    const speaker = document.getElementById('speakerInfo').value.trim();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    const scale = getScale();
    const shadowIntensity = (vfxSelector.value === 'nebula') ? 30 : 15;

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = shadowIntensity * scale;

    if (!userHasDragged) {
        const isLeftAlign = (vfxSelector.value === 'circular');
        layoutOffsets.titles.px = isLeftAlign ? 0.08 : 0.50; 
        layoutOffsets.titles.py = isLeftAlign ? 0.35 : 0.16; 
        layoutOffsets.channel.px = 0.04;
        layoutOffsets.channel.py = 0.06;
        layoutOffsets.logo.px = 0.96;
        layoutOffsets.logo.py = 0.06;
        layoutOffsets.lyrics.px = isLeftAlign ? 0.08 : 0.50; 
        layoutOffsets.lyrics.py = isLeftAlign ? 0.88 : 0.90; 
    }

    const cx = layoutOffsets.channel.px * canvas2D.width;
    const cy = layoutOffsets.channel.py * canvas2D.height;
    const tx = layoutOffsets.titles.px * canvas2D.width;
    const ty = layoutOffsets.titles.py * canvas2D.height;
    const lx = layoutOffsets.logo.px * canvas2D.width;
    const ly = layoutOffsets.logo.py * canvas2D.height;

    // 1. 繪製左上角頻道資訊
    if (cName) {
        ctx2D.textAlign = 'left';
        ctx2D.textBaseline = 'top';
        const lines = cName.split('\n');
        
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx2D.font = `bold ${32*scale}px ${font}`;
        ctx2D.fillText(lines[0], cx, cy);
        
        let maxWidth = ctx2D.measureText(lines[0]).width;
        let currentY = cy + 40 * scale;
        
        if (lines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx2D.font = `${18*scale}px ${font}`;
            for (let i = 1; i < lines.length; i++) {
                ctx2D.fillText(lines[i], cx, currentY);
                maxWidth = Math.max(maxWidth, ctx2D.measureText(lines[i]).width);
                currentY += 26 * scale;
            }
        }
        hitboxes.channel = { x: cx, y: cy, w: maxWidth, h: currentY - cy };
    } else {
        hitboxes.channel = { x: 0, y: 0, w: 0, h: 0 };
    }
    
    // 2. 繪製中央主標題與副標題
    if (topic || speaker) {
        const align = (layoutOffsets.titles.px < 0.25) ? 'left' : ((layoutOffsets.titles.px > 0.75) ? 'right' : 'center');
        ctx2D.textAlign = align;
        ctx2D.textBaseline = 'top';
        
        let titleBoxW = 0;
        let currentY = ty;
        
        if (topic) {
            ctx2D.fillStyle = '#ffffff';
            ctx2D.font = `bold ${64 * scale}px ${font}`;
            ctx2D.fillText(topic, tx, currentY);
            const metrics = ctx2D.measureText(topic);
            titleBoxW = metrics.width;
            currentY += 76 * scale;
        }
        
        if (speaker) {
            ctx2D.fillStyle = '#a0aec0';
            ctx2D.font = `${26 * scale}px ${font}`;
            ctx2D.fillText(speaker, tx, currentY);
            const metrics = ctx2D.measureText(speaker);
            titleBoxW = Math.max(titleBoxW, metrics.width);
            currentY += 32 * scale;
        }
        
        let boxX = tx;
        if (align === 'center') boxX = tx - titleBoxW / 2;
        if (align === 'right') boxX = tx - titleBoxW;
        hitboxes.titles = { x: boxX, y: ty, w: titleBoxW, h: currentY - ty };
    } else {
        hitboxes.titles = { x: 0, y: 0, w: 0, h: 0 };
    }
    
    // 3. 繪製右上角 Logo
    ctx2D.shadowBlur = 0;
    if (logoImg.src && logoImg.complete) {
        const userLogoScale = parseFloat(document.getElementById('slLogoScale')?.value) || 1.0;
        const maxW = 120 * scale * userLogoScale; 
        const aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW;
        const dh = aspect < 1 ? maxW : maxW / aspect;
        
        const drawX = lx - dw; 
        const drawY = ly;
        ctx2D.drawImage(logoImg, drawX, drawY, dw, dh);
        hitboxes.logo = { x: drawX, y: drawY, w: dw, h: dh };
    } else {
        hitboxes.logo = { x: 0, y: 0, w: 0, h: 0 };
    }
}

function drawInteractions() {
    if (hoverTarget || dragTarget) {
        const target = dragTarget || hoverTarget;
        const box = hitboxes[target];
        if (box && box.w > 0) {
            const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
            const scale = getScale();
            ctx2D.save();
            ctx2D.strokeStyle = 'rgba(59, 130, 246, 0.9)'; 
            ctx2D.lineWidth = 2 * scale;
            ctx2D.setLineDash([8, 6]);
            ctx2D.strokeRect(box.x - 12*scale, box.y - 12*scale, box.w + 24*scale, box.h + 24*scale);
            
            ctx2D.fillStyle = 'rgba(59, 130, 246, 1.0)';
            ctx2D.font = `bold ${15*scale}px ${font}`;
            ctx2D.textAlign = 'left';
            ctx2D.textBaseline = 'bottom';
            const hintText = target === 'logo' ? window.t('drag_hint_logo') : window.t('drag_hint');
            ctx2D.fillText(hintText, box.x - 10*scale, box.y - 16*scale);
            ctx2D.restore();
        }
    }
}

// ==========================================
// 👆 畫布拖曳與滾輪監聽器 (Canvas Interactions)
// ==========================================
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX = evt.clientX;
    let clientY = evt.clientY;
    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    }
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function handlePointerMove(e) {
    const pos = getMousePos(canvas2D, e);
    
    if (dragTarget) {
        layoutOffsets[dragTarget].px = (pos.x - dragOffsetX) / canvas2D.width;
        layoutOffsets[dragTarget].py = (pos.y - dragOffsetY) / canvas2D.height;
        userHasDragged = true;
        forceRenderFrame();
        canvas2D.style.cursor = 'grabbing';
        if(e.cancelable) e.preventDefault(); 
        return;
    }
    
    hoverTarget = null;
    const pad = 15 * getScale();
    for (const key of ['channel', 'titles', 'logo', 'lyrics']) {
        const box = hitboxes[key];
        if (box && box.w > 0 && 
            pos.x >= box.x - pad && pos.x <= box.x + box.w + pad &&
            pos.y >= box.y - pad && pos.y <= box.y + box.h + pad) {
            hoverTarget = key;
            break;
        }
    }
    canvas2D.style.cursor = hoverTarget ? 'grab' : 'default';
    if (!isDrawing) forceRenderFrame();
}

function handlePointerDown(e) {
    if (hoverTarget) {
        dragTarget = hoverTarget;
        const pos = getMousePos(canvas2D, e);
        const anchorX = layoutOffsets[dragTarget].px * canvas2D.width;
        const anchorY = layoutOffsets[dragTarget].py * canvas2D.height;
        dragOffsetX = pos.x - anchorX;
        dragOffsetY = pos.y - anchorY;
        canvas2D.style.cursor = 'grabbing';
        if (!isDrawing) forceRenderFrame();
    }
}

function handlePointerUp() {
    if (dragTarget) {
        dragTarget = null;
        canvas2D.style.cursor = hoverTarget ? 'grab' : 'default';
        if (!isDrawing) forceRenderFrame();
    }
}

canvas2D.addEventListener('mousemove', handlePointerMove);
canvas2D.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp);
canvas2D.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas2D.addEventListener('touchstart', handlePointerDown);
window.addEventListener('touchend', handlePointerUp);

canvas2D.addEventListener('wheel', (e) => {
    if (hoverTarget === 'logo' || dragTarget === 'logo') {
        e.preventDefault(); 
        const slider = document.getElementById('slLogoScale');
        if (slider) {
            let val = parseFloat(slider.value);
            val -= e.deltaY * 0.002; 
            val = Math.max(0.2, Math.min(5.0, val));
            slider.value = val;
            const label = document.getElementById('valLogoScale');
            if (label) label.textContent = val.toFixed(1) + 'x';
            forceRenderFrame();
        }
    }
}, { passive: false });

let parsedLyrics = [], rawLines = [], syncIndex = 0, isSyncing = false;

function parseLRC(text) {
    parsedLyrics = [];
    const timeRegEx = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    text.split('\n').forEach(line => {
        const m = timeRegEx.exec(line);
        if (m) {
            const time = parseInt(m[1])*60 + parseInt(m[2]) + parseInt(m[3])/Math.pow(10, m[3].length);
            const txt = line.replace(timeRegEx, '').trim();
            if(txt) parsedLyrics.push({time, text: txt});
        }
    });
}

lyricsInput.addEventListener('input', () => parseLRC(lyricsInput.value));

function drawLyrics() {
    let active = "";
    let hasLyrics = parsedLyrics && parsedLyrics.length > 0;

    if (currentMode === 'file' && audioPlayer && !audioPlayer.paused && hasLyrics) {
        const ct = audioPlayer.currentTime;
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (ct >= parsedLyrics[i].time) active = parsedLyrics[i].text;
            else break; 
        }
    }

    if (!active && (dragTarget === 'lyrics' || hoverTarget === 'lyrics' || isSyncing)) {
        active = hasLyrics ? window.t('lyric_preview') : window.t('lyric_placeholder');
    }

    const scale = getScale();
    const lx = layoutOffsets.lyrics.px * canvas2D.width;
    const ly = layoutOffsets.lyrics.py * canvas2D.height;
    const align = (layoutOffsets.lyrics.px < 0.25) ? 'left' : ((layoutOffsets.lyrics.px > 0.75) ? 'right' : 'center');

    if (active) {
        ctx2D.textAlign = align; 
        ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#ffde2a'; 
        ctx2D.font = `bold ${46*scale}px "Microsoft JhengHei", sans-serif`;
        ctx2D.shadowColor = 'rgba(0,0,0,1)'; 
        ctx2D.shadowBlur = 15 * scale;
        
        ctx2D.fillText(active, lx, ly);
        ctx2D.shadowBlur = 0;

        const metrics = ctx2D.measureText(active);
        const w = metrics.width;
        const h = 46 * scale;
        let hx = lx;
        if (align === 'center') hx = lx - w/2;
        if (align === 'right') hx = lx - w;
        
        hitboxes.lyrics = { x: hx, y: ly - h/2, w: w, h: h };
    } else {
        const w = 400 * scale; 
        const h = 60 * scale;
        let hx = lx;
        if (align === 'center') hx = lx - w/2;
        if (align === 'right') hx = lx - w;
        hitboxes.lyrics = { x: hx, y: ly - h/2, w: w, h: h };
    }
}

function stopSyncing() {
    isSyncing = false;
    document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_start');
    document.getElementById('btnMarkTime').disabled = true;
    document.getElementById('currentSyncLine').innerText = window.t('sync_end');
}

// ==========================================
// 檔案匯入邏輯 
// ==========================================
async function handleFileImport(file) {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/') && file.type !== "") {
        alert(window.t('alert_invalid_file'));
        return;
    }

    try {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        if (fileName.includes(" - ")) {
            const parts = fileName.split(" - ");
            document.getElementById('topicTitle').value = parts[1].trim();
            document.getElementById('speakerInfo').value = `Artist: ${parts[0].trim()}`;
        } else {
            document.getElementById('topicTitle').value = fileName;
        }

        audioPlayer.src = URL.createObjectURL(file);
        await audio.init(audioPlayer);
        
        if (!streamDestination) { 
            streamDestination = audio.audioCtx.createMediaStreamDestination(); 
            audio.analyser.connect(streamDestination); 
        }

        const waveformData = await audio.getStaticWaveform(file);
        drawStaticWaveform(waveformData);

        const overlayText = document.getElementById('overlayText');
        if(overlayText) overlayText.innerText = window.t('msg_audio_loaded');
        
        const overlay = document.getElementById('canvasOverlay');
        if(overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        }

        btnRecord.disabled = false;
        btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
        btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'file';
        
        applyResolution(1920, 1080); 
    } catch (e) {
        console.error("載入失敗:", e);
        alert(window.t('alert_load_fail'));
    }
}

function drawStaticWaveform(data) {
    const container = document.getElementById('waveformPreview');
    if (!container) return; 
    container.innerHTML = ''; 
    const max = Math.max(...data);
    
    data.forEach((val, i) => {
        const bar = document.createElement('div');
        const height = (val / max) * 100;
        bar.className = 'w-1 bg-gray-600 rounded-full transition-all hover:bg-blue-400 cursor-pointer';
        bar.style.height = `${Math.max(10, height)}%`;
        bar.onclick = () => {
            const pct = i / data.length;
            audioPlayer.currentTime = audioPlayer.duration * pct;
        };
        container.appendChild(bar);
    });
}

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('bg-blue-900/20');
});

window.addEventListener('dragleave', () => {
    document.body.classList.remove('bg-blue-900/20');
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('bg-blue-900/20');
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
});

// ==========================================
// UI 事件監聽綁定
// ==========================================
document.getElementById('resSelector').addEventListener('change', (e) => {
    const [w, h] = e.target.value.split('x').map(Number);
    document.getElementById('resSelectorMobile').value = e.target.value; 
    applyResolution(w, h);
});

document.getElementById('resSelectorMobile').addEventListener('change', (e) => {
    const [w, h] = e.target.value.split('x').map(Number);
    document.getElementById('resSelector').value = e.target.value; 
    applyResolution(w, h);
});

document.getElementById('btnToggleSync').addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel');
    panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) {
        stopSyncing();
    }
});

document.getElementById('btnStartSync').addEventListener('click', () => {
    if(currentMode !== 'file') return alert(window.t('alert_no_audio'));
    if (isSyncing) { audioPlayer.pause(); stopSyncing(); return; }
    
    const text = lyricsInput.value.trim();
    if (!text) return alert(window.t('alert_no_lyrics'));

    rawLines = text.split('\n').map(l=>l.trim()).filter(l=>l);
    syncIndex = 0; isSyncing = true;
    lyricsInput.value = rawLines.join('\n');

    document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_pause');
    const btnMarkTime = document.getElementById('btnMarkTime');
    btnMarkTime.disabled = false;
    document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    
    const overlay = document.getElementById('canvasOverlay');
    if (overlay && overlay.style.display !== 'none') {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    
    if (!isDrawing) { 
        isDrawing = true; 
        drawMasterLoop(); 
    }

    audioPlayer.currentTime = 0; 
    audioPlayer.play();
});

document.getElementById('btnMarkTime').addEventListener('click', () => {
    if(!isSyncing || syncIndex >= rawLines.length) return;
    const ct = audioPlayer.currentTime;
    const m = Math.floor(ct/60).toString().padStart(2,'0');
    const s = Math.floor(ct%60).toString().padStart(2,'0');
    const ms = Math.floor((ct%1)*100).toString().padStart(2,'0');
    const tag = `[${m}:${s}.${ms}]`;
    
    let lines = lyricsInput.value.split('\n');
    for(let i=0; i<lines.length; i++){
        if(lines[i] === rawLines[syncIndex]){ lines[i] = tag + rawLines[syncIndex]; break; }
    }
    lyricsInput.value = lines.join('\n');
    parseLRC(lyricsInput.value);
    
    syncIndex++;
    if (syncIndex >= rawLines.length) {
        document.getElementById('currentSyncLine').innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        isSyncing = false;
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_restart');
        document.getElementById('btnMarkTime').disabled = true;
    } else {
        document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    }
});

// ==========================================
// 🌟 歌詞匯出邏輯 (LRC / SRT 轉換引擎)
// ==========================================
document.getElementById('btnExportLRC')?.addEventListener('click', () => {
    const text = lyricsInput.value.trim();
    if (!text) return alert(window.t('alert_no_lyrics'));
    
    // 直接將 LRC 文字打包成 Blob 並觸發下載
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const topic = document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Lyrics';
    a.download = `${topic}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btnExportSRT')?.addEventListener('click', () => {
    parseLRC(lyricsInput.value); // 確保擷取到最新狀態
    if (parsedLyrics.length === 0) {
        alert(window.t('alert_no_lyrics'));
        return;
    }

    let srtContent = '';
    
    // SRT 專用時間軸格式轉換 (HH:MM:SS,mmm)
    const formatTime = (sec) => {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
        return `${h}:${m}:${s},${ms}`;
    };

    for (let i = 0; i < parsedLyrics.length; i++) {
        const startSec = parsedLyrics[i].time;
        // 計算結束時間：預設為下一句的開始時間。若是最後一句，則停留顯示 5 秒。
        // 為了避免單句顯示在畫面上過久，設定最高極限單句為 15 秒。
        let endSec = (i < parsedLyrics.length - 1) ? parsedLyrics[i+1].time : startSec + 5.0; 
        if (endSec - startSec > 15.0) endSec = startSec + 15.0; 

        srtContent += `${i + 1}\n`;
        srtContent += `${formatTime(startSec)} --> ${formatTime(endSec)}\n`;
        srtContent += `${parsedLyrics[i].text}\n\n`;
    }

    // 將 SRT 內容打包成 Blob 並觸發下載
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const topic = document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Subtitle';
    a.download = `${topic}.srt`;
    a.click();
    URL.revokeObjectURL(url);
});

window.addEventListener('keydown', (e) => { 
    if(isSyncing && e.code === 'Space' && document.activeElement !== lyricsInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { 
        e.preventDefault(); 
        document.getElementById('btnMarkTime').click(); 
    }
});

document.getElementById('audioUpload').addEventListener('change', (e) => {
    if(e.target.files.length) {
        handleFileImport(e.target.files[0]);
    }
});

document.getElementById('channelLogo').addEventListener('change', function(e) {
    if(this.files.length) {
        logoImg.onload = () => { 
            const logoLabel = document.getElementById('logoLabel');
            if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded'); 
            
            const scaleWrapper = document.getElementById('logoScaleWrapper');
            if (scaleWrapper) scaleWrapper.classList.remove('hidden');
            
            forceRenderFrame(); 
        };
        logoImg.src = URL.createObjectURL(this.files[0]);
    }
});

document.getElementById('slLogoScale')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    const label = document.getElementById('valLogoScale');
    if(label) label.textContent = val.toFixed(1) + 'x';
    forceRenderFrame();
});

['channelName', 'topicTitle', 'speakerInfo'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        forceRenderFrame();
    });
});

// ==========================================
// 🛡️ 安全機制：將錄影資料存入 IndexedDB
// ==========================================
async function cacheVideoRecord(blob) {
    const DB_NAME = "CS_Video_Cache";
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore("records");
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction("records", "readwrite");
            const store = transaction.objectStore("records");
            store.put(blob, "latest_session");
            transaction.oncomplete = () => {
                console.log("[CyberSentinel] 影片已安全暫存至 IndexedDB");
                resolve();
            };
            transaction.onerror = (err) => {
                console.error("[CyberSentinel] IndexedDB 寫入失敗", err);
                resolve(); 
            };
        };
        request.onerror = (e) => {
            console.error("[CyberSentinel] 無法開啟 IndexedDB", e);
            resolve(); 
        };
    });
}

// ==========================================
// 錄影引擎 (MediaRecorder)
// ==========================================
btnRecord.addEventListener('click', () => {
    recordedChunks = [];
    const canvasStream = canvas2D.captureStream(30);
    const combinedStream = new MediaStream([...canvasStream.getTracks(), ...streamDestination.stream.getTracks()]);
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
    try {
        mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
        alert(window.t('alert_no_record')); return; 
    }
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        await cacheVideoRecord(blob); 

        const videoUrl = URL.createObjectURL(blob);
        document.getElementById('recordedVideo').src = videoUrl;
        document.getElementById('downloadLink').href = videoUrl;
        document.getElementById('downloadLink').download = `CyberSentinel_Record_${Date.now()}.webm`; 
        
        document.getElementById('resultModal').classList.remove('hidden');
        document.getElementById('resultModal').classList.add('flex'); 
        document.getElementById('recordingStatus').classList.add('hidden');
        btnRecord.disabled = false;
        btnStopRecord.disabled = true;
    };

    mediaRecorder.start();
    const overlay = document.getElementById('canvasOverlay');
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
    if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
    if(currentMode === 'file') { audioPlayer.currentTime = 0; audioPlayer.play(); }
    document.getElementById('recordingStatus').classList.remove('hidden');
    btnRecord.disabled = true;
    btnStopRecord.disabled = false;
});

btnStopRecord.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (currentMode === 'file') audioPlayer.pause();
    isDrawing = false;
});

document.getElementById('btnCloseResult').addEventListener('click', () => {
    document.getElementById('resultModal').classList.add('hidden');
    document.getElementById('resultModal').classList.remove('flex');
});

vfxSelector.addEventListener('change', (e) => {
    const v = e.target.value;
    ['panel3D', 'panelNebula', 'panelParticle', 'panelCircular', 'panelEq', 'panelWaveform'].forEach(id => {
        const el = document.getElementById(id); if(el) el.classList.add('hidden');
    });
    if (document.getElementById('panel' + v.charAt(0).toUpperCase() + v.slice(1))) {
        document.getElementById('panel' + v.charAt(0).toUpperCase() + v.slice(1)).classList.remove('hidden');
    } else if (v === 'aurora') document.getElementById('panel3D').classList.remove('hidden');
    
    if (audio.analyser) {
        audio.analyser.fftSize = (v === 'waveform' || v === 'aurora' || v === 'nebula') ? 2048 : 256;
    }
    forceRenderFrame();
});

['slCircAmp', 'slCircColor', 'slCircSpin', 'slCircCount', 'slEqCount', 'slEqAmp', 'slEqColor', 'slEqGravity', 'slWaveAmp', 'slWaveColor', 'slWaveGlow', 'slWaveThick', 'slTransmission', 'slRotation', 'slParticleAmount', 'slParticleSpeed', 'slNebViscosity', 'slNebColor'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const label = document.getElementById(id.replace('sl', 'val'));
        if(label) label.textContent = (id.includes('Count') || id.includes('Thick')) ? val : val.toFixed(2) + 'x';
    });
});

document.getElementById('btnMic').addEventListener('click', async () => {
    try {
        await audio.init(await navigator.mediaDevices.getUserMedia({ audio: true }));
        if (!streamDestination) { streamDestination = audio.audioCtx.createMediaStreamDestination(); audio.analyser.connect(streamDestination); }
        
        const overlayText = document.getElementById('overlayText');
        if(overlayText) overlayText.innerText = window.t('msg_mic_ready');
        
        const overlay = document.getElementById('canvasOverlay');
        if(overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        }

        btnRecord.disabled = false;
        btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
        btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'mic';
        
        applyResolution(1920, 1080); 
        if (!isDrawing) drawLayout();
    } catch(e) { 
        alert(window.t('alert_mic_fail')); 
    }
});

document.getElementById('langSelect').addEventListener('change', (e) => updateLanguage(e.target.value));

// ==========================================
// 🌐 語言選單自動生成與更新引擎
// ==========================================
const langNames = {
    "en-US": "English",
    "zh-TW": "繁體中文",
    "zh-CN": "简体中文",
    "es-ES": "Español",
    "ja-JP": "日本語",
    "de-DE": "Deutsch",
    "fr-FR": "Français",
    "ko-KR": "한국어"
};

function initLanguageSelect() {
    const langSelect = document.getElementById('langSelect');
    if (!langSelect) return;
    
    langSelect.innerHTML = '';
    for (const [code, name] of Object.entries(langNames)) {
        if (translations[code]) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            langSelect.appendChild(opt);
        }
    }
    
    const preferredLang = localStorage.getItem('preferredLang') || 'zh-TW';
    langSelect.value = preferredLang;
}

function updateLanguage(lang) {
    const dict = translations[lang] || translations['en-US'];
    if (!dict) return;
    
    // 1. 替換一般的靜態文字
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerHTML = dict[el.getAttribute('data-i18n')] || el.innerHTML;
    });

    // 2. 替換輸入框的 Placeholder 提示文字
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = dict[el.getAttribute('data-i18n-placeholder')] || el.placeholder;
    });

    localStorage.setItem('preferredLang', lang);

    // 3. 處理因為 JS 狀態而動態改變的文字，確保切換時立刻生效
    if (currentMode === 'file') {
        const overlayText = document.getElementById('overlayText');
        if (overlayText) overlayText.innerText = window.t('msg_audio_loaded');
    } else if (currentMode === 'mic') {
        const overlayText = document.getElementById('overlayText');
        if (overlayText) overlayText.innerText = window.t('msg_mic_ready');
    }

    const logoLabel = document.getElementById('logoLabel');
    if (logoImg.src && logoImg.complete && logoLabel) {
        logoLabel.innerText = window.t('btn_logo_loaded');
    }

    const btnStartSync = document.getElementById('btnStartSync');
    const syncLine = document.getElementById('currentSyncLine');
    if (btnStartSync && syncLine) {
        if (isSyncing) {
            btnStartSync.innerHTML = window.t('btn_sync_pause');
        } else if (syncIndex > 0 && syncIndex < rawLines.length) {
            btnStartSync.innerHTML = window.t('btn_sync_restart');
            syncLine.innerText = rawLines[syncIndex];
        } else if (syncIndex >= rawLines.length && rawLines.length > 0) {
            syncLine.innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        } else {
            btnStartSync.innerHTML = window.t('btn_sync_start');
            syncLine.innerText = window.t('sync_init');
        }
    }

    // 重新渲染畫布以更新畫布內的提示與文字
    forceRenderFrame();
}

// 啟動
setup3D();
setTimeout(() => applyResolution(1920, 1080), 500);

initLanguageSelect();
updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');

setTimeout(() => { showPrivacyToast(); }, 1000);
initESGMode();

document.addEventListener("visibilitychange", () => {
    if (rm) rm.isActive = !document.hidden;
});