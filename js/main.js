import { AudioEngine } from './AudioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';
import { initNebulaShader, renderNebulaShader } from './vfx/NebulaShader.js';
import { translations } from './i18n.js';
import { VideoRecorder } from './modules/VideoRecorder.js';
import { LyricsManager } from './modules/LyricsManager.js';

// ==========================================
// 🌐 全域翻譯引擎
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
let logoImg = new Image();

const canvas2D = document.getElementById('visualizer2D');
const ctx2D = canvas2D.getContext('2d');
const canvas3D = document.getElementById('visualizer3D'); 
const particleCanvas = document.createElement('canvas');
const pCtx = particleCanvas.getContext('2d');

let rm, vfxManager, aurora, sun, nebulaSystem; 

// 🌟 初始化核心模組
const videoRecorder = new VideoRecorder(canvas2D);
const lyricsManager = new LyricsManager();

// ==========================================
// 🌟 畫面排版與拖曳狀態管理
// ==========================================
let layoutOffsets = {
    channel: { px: 0.04, py: 0.06 }, 
    titles: { px: 0.50, py: 0.16 },  
    logo: { px: 0.96, py: 0.06 },    
    lyrics: { px: 0.50, py: 0.90 }   
};
let hitboxes = { channel: {x:0,y:0,w:0,h:0}, titles: {x:0,y:0,w:0,h:0}, logo: {x:0,y:0,w:0,h:0}, lyrics: {x:0,y:0,w:0,h:0} };
let dragTarget = null, hoverTarget = null, dragOffsetX = 0, dragOffsetY = 0, userHasDragged = false; 

function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm;
    vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora;
    sun = auroraSystem.sun;
    nebulaSystem = initNebulaShader(canvas3D);
}

function applyResolution(width, height) {
    canvas2D.width = width; canvas2D.height = height;
    canvas3D.width = width; canvas3D.height = height;
    particleCanvas.width = width; particleCanvas.height = height;
    
    pCtx.fillStyle = '#000000'; pCtx.fillRect(0, 0, width, height);
    if (rm && rm.renderer) {
        rm.renderer.setSize(width, height, false);
        rm.camera.aspect = width / height;
        rm.camera.updateProjectionMatrix();
    }
    if (nebulaSystem && nebulaSystem.renderer) nebulaSystem.renderer.setSize(width, height, false);
    forceRenderFrame();
}

function getScale() { return canvas2D.width / 1920; }

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
        } catch(e) {}
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
            ctx2D.fillStyle = '#000000'; ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height); 
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
    let dataArray = new Uint8Array(256), safePulse = 0;
    if (audio.analyser) {
        const bufferLength = audio.analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        audio.analyser.getByteFrequencyData(dataArray);
        const bassSum = dataArray.slice(0, 6).reduce((a, b) => a + b, 0);
        const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
        const isA11y = document.getElementById('chkA11y')?.checked || false;
        safePulse = isA11y ? Math.min(orbPulse, 0.15) : orbPulse;
    }

    ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
    renderScene(vfxSelector.value, dataArray, safePulse, getScale(), document.getElementById('chkA11y')?.checked || false, getVfxConfig());
    drawLayout(); drawLyrics(); drawInteractions(); 
}

function drawMasterLoop() {
    if (!isDrawing) return;
    requestAnimationFrame(drawMasterLoop);
    if (!audio.analyser) return;

    const dataArray = new Uint8Array(audio.analyser.frequencyBinCount);
    audio.analyser.getByteFrequencyData(dataArray);
    const orbPulse = Math.pow((dataArray.slice(0, 6).reduce((a, b) => a + b, 0) / 6) / 255, 3.0); 
    const isA11y = document.getElementById('chkA11y').checked;
    const safePulse = isA11y ? Math.min(orbPulse, 0.15) : orbPulse;

    renderScene(vfxSelector.value, dataArray, safePulse, getScale(), isA11y, getVfxConfig());
    drawLayout(); drawLyrics(); drawInteractions(); 
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
    requestAnimationFrame(() => { setTimeout(() => { toast.classList.remove('translate-y-24', 'opacity-0'); }, 100); });
    setTimeout(() => { if(document.body.contains(toast)) { toast.classList.add('translate-y-24', 'opacity-0'); setTimeout(() => { if(document.body.contains(toast)) toast.remove(); }, 700); } }, 8000);
}

function drawLayout() {
    const cName = document.getElementById('channelName').value.trim();
    const topic = document.getElementById('topicTitle').value.trim();
    const speaker = document.getElementById('speakerInfo').value.trim();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    const scale = getScale();

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = (vfxSelector.value === 'nebula' ? 30 : 15) * scale;

    if (!userHasDragged) {
        const isLeftAlign = (vfxSelector.value === 'circular');
        layoutOffsets.titles.px = isLeftAlign ? 0.08 : 0.50; 
        layoutOffsets.titles.py = isLeftAlign ? 0.35 : 0.16; 
        layoutOffsets.lyrics.px = isLeftAlign ? 0.08 : 0.50; 
        layoutOffsets.lyrics.py = isLeftAlign ? 0.88 : 0.90; 
        layoutOffsets.channel.px = 0.04; layoutOffsets.channel.py = 0.06;
        layoutOffsets.logo.px = 0.96; layoutOffsets.logo.py = 0.06;
    }

    const cx = layoutOffsets.channel.px * canvas2D.width; const cy = layoutOffsets.channel.py * canvas2D.height;
    const tx = layoutOffsets.titles.px * canvas2D.width; const ty = layoutOffsets.titles.py * canvas2D.height;
    const lx = layoutOffsets.logo.px * canvas2D.width; const ly = layoutOffsets.logo.py * canvas2D.height;

    if (cName) {
        ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'top';
        const lines = cName.split('\n');
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx2D.font = `bold ${32*scale}px ${font}`;
        ctx2D.fillText(lines[0], cx, cy);
        let maxWidth = ctx2D.measureText(lines[0]).width, currentY = cy + 40 * scale;
        if (lines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx2D.font = `${18*scale}px ${font}`;
            for (let i = 1; i < lines.length; i++) {
                ctx2D.fillText(lines[i], cx, currentY);
                maxWidth = Math.max(maxWidth, ctx2D.measureText(lines[i]).width);
                currentY += 26 * scale;
            }
        }
        hitboxes.channel = { x: cx, y: cy, w: maxWidth, h: currentY - cy };
    } else hitboxes.channel = { x: 0, y: 0, w: 0, h: 0 };
    
    if (topic || speaker) {
        const align = (layoutOffsets.titles.px < 0.25) ? 'left' : ((layoutOffsets.titles.px > 0.75) ? 'right' : 'center');
        ctx2D.textAlign = align; ctx2D.textBaseline = 'top';
        let titleBoxW = 0, currentY = ty;
        if (topic) {
            ctx2D.fillStyle = '#ffffff'; ctx2D.font = `bold ${64 * scale}px ${font}`; ctx2D.fillText(topic, tx, currentY);
            titleBoxW = ctx2D.measureText(topic).width; currentY += 76 * scale;
        }
        if (speaker) {
            ctx2D.fillStyle = '#a0aec0'; ctx2D.font = `${26 * scale}px ${font}`; ctx2D.fillText(speaker, tx, currentY);
            titleBoxW = Math.max(titleBoxW, ctx2D.measureText(speaker).width); currentY += 32 * scale;
        }
        let boxX = tx; if (align === 'center') boxX = tx - titleBoxW / 2; if (align === 'right') boxX = tx - titleBoxW;
        hitboxes.titles = { x: boxX, y: ty, w: titleBoxW, h: currentY - ty };
    } else hitboxes.titles = { x: 0, y: 0, w: 0, h: 0 };
    
    ctx2D.shadowBlur = 0;
    if (logoImg.src && logoImg.complete) {
        const userLogoScale = parseFloat(document.getElementById('slLogoScale')?.value) || 1.0;
        const maxW = 120 * scale * userLogoScale, aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW, dh = aspect < 1 ? maxW : maxW / aspect;
        const drawX = lx - dw, drawY = ly;
        ctx2D.drawImage(logoImg, drawX, drawY, dw, dh);
        hitboxes.logo = { x: drawX, y: drawY, w: dw, h: dh };
    } else hitboxes.logo = { x: 0, y: 0, w: 0, h: 0 };
}

function drawInteractions() {
    if (hoverTarget || dragTarget) {
        const target = dragTarget || hoverTarget;
        const box = hitboxes[target];
        if (box && box.w > 0) {
            const scale = getScale();
            ctx2D.save(); ctx2D.strokeStyle = 'rgba(59, 130, 246, 0.9)'; ctx2D.lineWidth = 2 * scale;
            ctx2D.setLineDash([8, 6]); ctx2D.strokeRect(box.x - 12*scale, box.y - 12*scale, box.w + 24*scale, box.h + 24*scale);
            ctx2D.fillStyle = 'rgba(59, 130, 246, 1.0)'; ctx2D.font = `bold ${15*scale}px sans-serif`;
            ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'bottom';
            ctx2D.fillText(target === 'logo' ? window.t('drag_hint_logo') : window.t('drag_hint'), box.x - 10*scale, box.y - 16*scale);
            ctx2D.restore();
        }
    }
}

// ==========================================
// 👆 畫布拖曳與滾輪監聽器
// ==========================================
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let cx = evt.touches?.length ? evt.touches[0].clientX : evt.clientX;
    let cy = evt.touches?.length ? evt.touches[0].clientY : evt.clientY;
    return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
}

function handlePointerMove(e) {
    const pos = getMousePos(canvas2D, e);
    if (dragTarget) {
        layoutOffsets[dragTarget].px = (pos.x - dragOffsetX) / canvas2D.width;
        layoutOffsets[dragTarget].py = (pos.y - dragOffsetY) / canvas2D.height;
        userHasDragged = true; forceRenderFrame(); canvas2D.style.cursor = 'grabbing';
        if(e.cancelable) e.preventDefault(); return;
    }
    hoverTarget = null; const pad = 15 * getScale();
    for (const key of ['channel', 'titles', 'logo', 'lyrics']) {
        const box = hitboxes[key];
        if (box && box.w > 0 && pos.x >= box.x - pad && pos.x <= box.x + box.w + pad && pos.y >= box.y - pad && pos.y <= box.y + box.h + pad) {
            hoverTarget = key; break;
        }
    }
    canvas2D.style.cursor = hoverTarget ? 'grab' : 'default';
    if (!isDrawing) forceRenderFrame();
}

function handlePointerDown(e) {
    if (hoverTarget) {
        dragTarget = hoverTarget; const pos = getMousePos(canvas2D, e);
        dragOffsetX = pos.x - layoutOffsets[dragTarget].px * canvas2D.width;
        dragOffsetY = pos.y - layoutOffsets[dragTarget].py * canvas2D.height;
        canvas2D.style.cursor = 'grabbing'; if (!isDrawing) forceRenderFrame();
    }
}

function handlePointerUp() {
    if (dragTarget) { dragTarget = null; canvas2D.style.cursor = hoverTarget ? 'grab' : 'default'; if (!isDrawing) forceRenderFrame(); }
}

canvas2D.addEventListener('mousemove', handlePointerMove); canvas2D.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp); canvas2D.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas2D.addEventListener('touchstart', handlePointerDown); window.addEventListener('touchend', handlePointerUp);

canvas2D.addEventListener('wheel', (e) => {
    if (hoverTarget === 'logo' || dragTarget === 'logo') {
        e.preventDefault(); const slider = document.getElementById('slLogoScale');
        if (slider) {
            slider.value = Math.max(0.2, Math.min(5.0, parseFloat(slider.value) - e.deltaY * 0.002));
            const label = document.getElementById('valLogoScale');
            if (label) label.textContent = parseFloat(slider.value).toFixed(1) + 'x';
            forceRenderFrame();
        }
    }
}, { passive: false });

// ==========================================
// 🎵 模組化 - 歌詞渲染與控制
// ==========================================
lyricsInput.addEventListener('input', () => lyricsManager.parse(lyricsInput.value));

function drawLyrics() {
    let active = "";
    if (currentMode === 'file' && audioPlayer && !audioPlayer.paused) {
        active = lyricsManager.getActiveLyric(audioPlayer.currentTime);
    }
    if (!active && (dragTarget === 'lyrics' || hoverTarget === 'lyrics' || lyricsManager.isSyncing)) {
        active = lyricsManager.parsedLyrics.length > 0 ? window.t('lyric_preview') : window.t('lyric_placeholder');
    }

    const scale = getScale(), lx = layoutOffsets.lyrics.px * canvas2D.width, ly = layoutOffsets.lyrics.py * canvas2D.height;
    const align = (layoutOffsets.lyrics.px < 0.25) ? 'left' : ((layoutOffsets.lyrics.px > 0.75) ? 'right' : 'center');

    if (active) {
        ctx2D.textAlign = align; ctx2D.textBaseline = 'middle'; ctx2D.fillStyle = '#ffde2a'; 
        ctx2D.font = `bold ${46*scale}px "Microsoft JhengHei", sans-serif`;
        ctx2D.shadowColor = 'rgba(0,0,0,1)'; ctx2D.shadowBlur = 15 * scale;
        ctx2D.fillText(active, lx, ly); ctx2D.shadowBlur = 0;
        
        const w = ctx2D.measureText(active).width, h = 46 * scale;
        let hx = lx; if (align === 'center') hx = lx - w/2; if (align === 'right') hx = lx - w;
        hitboxes.lyrics = { x: hx, y: ly - h/2, w: w, h: h };
    } else {
        const w = 400 * scale, h = 60 * scale;
        let hx = lx; if (align === 'center') hx = lx - w/2; if (align === 'right') hx = lx - w;
        hitboxes.lyrics = { x: hx, y: ly - h/2, w: w, h: h };
    }
}

document.getElementById('btnStartSync').addEventListener('click', () => {
    if(currentMode !== 'file') return alert(window.t('alert_no_audio'));
    if (lyricsManager.isSyncing) { 
        audioPlayer.pause(); lyricsManager.stopSync();
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_start');
        document.getElementById('btnMarkTime').disabled = true;
        document.getElementById('currentSyncLine').innerText = window.t('sync_end');
        return; 
    }
    const formattedText = lyricsManager.startSync(lyricsInput.value);
    if (!formattedText) return alert(window.t('alert_no_lyrics'));

    lyricsInput.value = formattedText;
    document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_pause');
    document.getElementById('btnMarkTime').disabled = false;
    document.getElementById('currentSyncLine').innerText = lyricsManager.rawLines[0];
    
    const overlay = document.getElementById('canvasOverlay');
    if (overlay && overlay.style.display !== 'none') {
        overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
    audioPlayer.currentTime = 0; audioPlayer.play();
});

document.getElementById('btnMarkTime').addEventListener('click', () => {
    const result = lyricsManager.markNext(lyricsInput.value, audioPlayer.currentTime);
    if (!result) return;
    
    lyricsInput.value = result.newText;
    
    if (result.isFinished) {
        document.getElementById('currentSyncLine').innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        lyricsManager.stopSync();
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_restart');
        document.getElementById('btnMarkTime').disabled = true;
    } else {
        document.getElementById('currentSyncLine').innerText = result.nextLine;
    }
});

window.addEventListener('keydown', (e) => { 
    if(lyricsManager.isSyncing && e.code === 'Space' && document.activeElement !== lyricsInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { 
        e.preventDefault(); document.getElementById('btnMarkTime').click(); 
    }
});

// 🌟 匯出 LRC/SRT 事件綁定
document.getElementById('btnExportLRC')?.addEventListener('click', () => {
    const topic = document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Lyrics';
    const success = lyricsManager.exportLRC(lyricsInput.value.trim(), topic);
    if (!success) alert(window.t('alert_no_lyrics'));
});

document.getElementById('btnExportSRT')?.addEventListener('click', () => {
    const topic = document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Subtitle';
    const success = lyricsManager.exportSRT(lyricsInput.value.trim(), topic);
    if (!success) alert(window.t('alert_no_lyrics'));
});

// ==========================================
// 模組化 - 錄影引擎事件
// ==========================================
btnRecord.addEventListener('click', () => {
    const success = videoRecorder.start(streamDestination, (videoUrl) => {
        document.getElementById('recordedVideo').src = videoUrl;
        document.getElementById('downloadLink').href = videoUrl;
        document.getElementById('downloadLink').download = `CyberSentinel_Record_${Date.now()}.webm`; 
        document.getElementById('resultModal').classList.remove('hidden');
        document.getElementById('resultModal').classList.add('flex'); 
        document.getElementById('recordingStatus').classList.add('hidden');
        btnRecord.disabled = false; btnStopRecord.disabled = true;
    }, () => { alert(window.t('alert_no_record')); });

    if (success) {
        const overlay = document.getElementById('canvasOverlay');
        if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
        if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
        if(currentMode === 'file') { audioPlayer.currentTime = 0; audioPlayer.play(); }
        document.getElementById('recordingStatus').classList.remove('hidden');
        btnRecord.disabled = true; btnStopRecord.disabled = false;
    }
});

btnStopRecord.addEventListener('click', () => {
    videoRecorder.stop();
    if (currentMode === 'file') audioPlayer.pause();
    isDrawing = false;
});

// ==========================================
// 檔案匯入與其他 UI 事件
// ==========================================
async function handleFileImport(file) {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/') && file.type !== "") return alert(window.t('alert_invalid_file'));
    try {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        if (fileName.includes(" - ")) {
            const parts = fileName.split(" - ");
            document.getElementById('topicTitle').value = parts[1].trim();
            document.getElementById('speakerInfo').value = `Artist: ${parts[0].trim()}`;
        } else document.getElementById('topicTitle').value = fileName;

        audioPlayer.src = URL.createObjectURL(file); await audio.init(audioPlayer);
        if (!streamDestination) { streamDestination = audio.audioCtx.createMediaStreamDestination(); audio.analyser.connect(streamDestination); }
        drawStaticWaveform(await audio.getStaticWaveform(file));
        const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_audio_loaded');
        const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'file'; applyResolution(1920, 1080); 
    } catch (e) { alert(window.t('alert_load_fail')); }
}

function drawStaticWaveform(data) {
    const container = document.getElementById('waveformPreview'); if (!container) return; 
    container.innerHTML = ''; const max = Math.max(...data);
    data.forEach((val, i) => {
        const bar = document.createElement('div');
        bar.className = 'w-1 bg-gray-600 rounded-full transition-all hover:bg-blue-400 cursor-pointer';
        bar.style.height = `${Math.max(10, (val / max) * 100)}%`;
        bar.onclick = () => audioPlayer.currentTime = audioPlayer.duration * (i / data.length);
        container.appendChild(bar);
    });
}

window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('bg-blue-900/20'); });
window.addEventListener('dragleave', () => document.body.classList.remove('bg-blue-900/20'));
window.addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('bg-blue-900/20'); if (e.dataTransfer.files[0]) handleFileImport(e.dataTransfer.files[0]); });
document.getElementById('resSelector').addEventListener('change', (e) => { document.getElementById('resSelectorMobile').value = e.target.value; applyResolution(...e.target.value.split('x').map(Number)); });
document.getElementById('resSelectorMobile').addEventListener('change', (e) => { document.getElementById('resSelector').value = e.target.value; applyResolution(...e.target.value.split('x').map(Number)); });
document.getElementById('btnCloseResult').addEventListener('click', () => { document.getElementById('resultModal').classList.add('hidden'); document.getElementById('resultModal').classList.remove('flex'); });

vfxSelector.addEventListener('change', (e) => {
    ['panel3D', 'panelNebula', 'panelParticle', 'panelCircular', 'panelEq', 'panelWaveform'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    const panel = document.getElementById('panel' + e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1));
    if (panel) panel.classList.remove('hidden'); else if (e.target.value === 'aurora') document.getElementById('panel3D').classList.remove('hidden');
    if (audio.analyser) audio.analyser.fftSize = (e.target.value === 'waveform' || e.target.value === 'aurora' || e.target.value === 'nebula') ? 2048 : 256;
    forceRenderFrame();
});

['slCircAmp', 'slCircColor', 'slCircSpin', 'slCircCount', 'slEqCount', 'slEqAmp', 'slEqColor', 'slEqGravity', 'slWaveAmp', 'slWaveColor', 'slWaveGlow', 'slWaveThick', 'slTransmission', 'slRotation', 'slParticleAmount', 'slParticleSpeed', 'slNebViscosity', 'slNebColor'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => {
        const label = document.getElementById(id.replace('sl', 'val'));
        if(label) label.textContent = (id.includes('Count') || id.includes('Thick')) ? e.target.value : parseFloat(e.target.value).toFixed(2) + 'x';
    });
});

document.getElementById('btnMic').addEventListener('click', async () => {
    try {
        await audio.init(await navigator.mediaDevices.getUserMedia({ audio: true }));
        if (!streamDestination) { streamDestination = audio.audioCtx.createMediaStreamDestination(); audio.analyser.connect(streamDestination); }
        const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_mic_ready');
        const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'mic'; applyResolution(1920, 1080); if (!isDrawing) drawLayout();
    } catch(e) { alert(window.t('alert_mic_fail')); }
});

document.getElementById('btnToggleSync').addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel'); panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) {
        lyricsManager.stopSync();
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_start');
        document.getElementById('btnMarkTime').disabled = true;
        document.getElementById('currentSyncLine').innerText = window.t('sync_end');
    }
});

document.getElementById('audioUpload').addEventListener('change', (e) => { if(e.target.files.length) handleFileImport(e.target.files[0]); });
document.getElementById('channelLogo').addEventListener('change', function(e) {
    if(this.files.length) {
        logoImg.onload = () => { 
            const logoLabel = document.getElementById('logoLabel'); if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded'); 
            const scaleWrapper = document.getElementById('logoScaleWrapper'); if (scaleWrapper) scaleWrapper.classList.remove('hidden');
            forceRenderFrame(); 
        };
        logoImg.src = URL.createObjectURL(this.files[0]);
    }
});

['channelName', 'topicTitle', 'speakerInfo'].forEach(id => { document.getElementById(id).addEventListener('input', () => forceRenderFrame()); });
document.getElementById('langSelect').addEventListener('change', (e) => updateLanguage(e.target.value));

// ==========================================
// 🌐 語言選單自動生成與更新引擎
// ==========================================
const langNames = { "en-US": "English", "zh-TW": "繁體中文", "zh-CN": "简体中文", "es-ES": "Español", "ja-JP": "日本語", "de-DE": "Deutsch", "fr-FR": "Français", "ko-KR": "한국어" };
function initLanguageSelect() {
    const langSelect = document.getElementById('langSelect'); if (!langSelect) return;
    langSelect.innerHTML = '';
    for (const [code, name] of Object.entries(langNames)) {
        if (translations[code]) { const opt = document.createElement('option'); opt.value = code; opt.textContent = name; langSelect.appendChild(opt); }
    }
    langSelect.value = localStorage.getItem('preferredLang') || 'zh-TW';
}
function updateLanguage(lang) {
    const dict = translations[lang] || translations['en-US']; if (!dict) return;
    document.querySelectorAll('[data-i18n]').forEach(el => el.innerHTML = dict[el.getAttribute('data-i18n')] || el.innerHTML);
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = dict[el.getAttribute('data-i18n-placeholder')] || el.placeholder);
    localStorage.setItem('preferredLang', lang);
    if (currentMode === 'file') document.getElementById('overlayText').innerText = window.t('msg_audio_loaded');
    else if (currentMode === 'mic') document.getElementById('overlayText').innerText = window.t('msg_mic_ready');
    if (logoImg.src && logoImg.complete) document.getElementById('logoLabel').innerText = window.t('btn_logo_loaded');
    const syncLine = document.getElementById('currentSyncLine');
    if (syncLine) {
        if (lyricsManager.isSyncing) document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_pause');
        else if (lyricsManager.syncIndex > 0 && lyricsManager.syncIndex < lyricsManager.rawLines.length) { document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_restart'); syncLine.innerText = lyricsManager.rawLines[lyricsManager.syncIndex]; }
        else if (lyricsManager.syncIndex >= lyricsManager.rawLines.length && lyricsManager.rawLines.length > 0) syncLine.innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        else { document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_start'); syncLine.innerText = window.t('sync_init'); }
    }
    forceRenderFrame();
}

setup3D();
setTimeout(() => applyResolution(1920, 1080), 500);
initLanguageSelect(); updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
setTimeout(() => { showPrivacyToast(); }, 1000); initESGMode();
document.addEventListener("visibilitychange", () => { if (rm) rm.isActive = !document.hidden; });