/**
 * Black Core Sentinel - Render Pipeline Engine
 * 負責所有 Canvas 2D/3D 的渲染疊加、效能迴圈 (RequestAnimationFrame)、以及畫布拖曳互動。
 */
import { initAurora3D, renderAurora3D } from '../vfx/Aurora3D.js';
import { renderParticles } from '../vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from '../vfx/AudioSpectrums.js';
import { initNebulaShader, renderNebulaShader } from '../vfx/NebulaShader.js';
import { renderInkGlow } from '../vfx/InkGlow.js';
import { renderBokeh } from '../vfx/Bokeh.js';
import { renderRetroGrid } from '../vfx/RetroGrid.js'; /* 🌟 引入復古網格特效 */
import { State } from './StateManager.js';

/* 依賴注入環境變數 */
let audio, audioPlayer, bgManager, lyricsManager, getLogoImg, getCurrentMode, uiManager;
let onLayoutChangeCallback = null;

/* 畫布與 Context 初始化 */
export const canvas2D = document.getElementById('visualizer2D');
export const ctx2D = canvas2D.getContext('2d');
const canvas3D = document.getElementById('visualizer3D'); 
const particleCanvas = document.createElement('canvas');
const pCtx = particleCanvas.getContext('2d');
const vfxCanvas = document.createElement('canvas');
const vfxCtx = vfxCanvas.getContext('2d');

let rm, vfxManager, aurora, sun, nebulaSystem; 

export let hitboxes = { channel: {x:0,y:0,w:0,h:0}, titles: {x:0,y:0,w:0,h:0}, logo: {x:0,y:0,w:0,h:0}, lyrics: {x:0,y:0,w:0,h:0}, vfx: {x:0,y:0,w:0,h:0} };
let dragTarget = null, hoverTarget = null, dragOffsetX = 0, dragOffsetY = 0;
let userHasDragged = false; 

let isDrawing = false;
let animationFrameId = null;
let sharedDataArray = null; 
let renderPending = false;

/* 狀態控制外部介面 */
export function getIsDrawing() { return isDrawing; }
export function setIsDrawing(val) { isDrawing = val; }
export function setUserHasDragged(val) { userHasDragged = val; }

export function initRenderPipeline(context) {
    audio = context.audio;
    audioPlayer = context.audioPlayer;
    bgManager = context.bgManager;
    lyricsManager = context.lyricsManager;
    getLogoImg = context.getLogoImg;
    getCurrentMode = context.getCurrentMode;
    uiManager = context.uiManager;
    onLayoutChangeCallback = context.onLayoutChange;

    setup3D();
    initCanvasInteractions();
}

/* 🌟 特效分派中心 */
const VFXRegistry = {
    aurora: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            canvas3D.style.display = 'block';
            renderAurora3D(ctx, canvas2D, canvas3D, rm, vfxManager, aurora, sun, dataArray, safePulse, State.vfx.aurora);
            ctx.drawImage(canvas3D, 0, 0, canvas2D.width, canvas2D.height);
        }
    },
    nebula: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            canvas3D.style.display = 'block';
            const cfg = { ...State.vfx.nebula };
            if (window.ESG_ECO_MODE) cfg.viscosity = Math.min(cfg.viscosity, 0.1);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas2D.width, canvas2D.height);
            renderNebulaShader(nebulaSystem, canvas2D.width, canvas2D.height, safePulse, cfg);
            ctx.drawImage(canvas3D, 0, 0, canvas2D.width, canvas2D.height);
        }
    },
    retrogrid: { /* 🌟 註冊復古網格路由 */
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.retrogrid };
            renderRetroGrid(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        }
    },
    ink: { 
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.ink };
            if (window.ESG_ECO_MODE) { cfg.spreadMult = Math.min(cfg.spreadMult, 0.5); cfg.persistence = Math.min(cfg.persistence, 0.7); }
            renderInkGlow(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        }
    },
    bokeh: { 
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.bokeh };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 15);
            renderBokeh(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        }
    },
    particle: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.particle };
            if (window.ESG_ECO_MODE) cfg.amountMult = Math.min(cfg.amountMult, 0.25);
            renderParticles(ctx, canvas2D, particleCanvas, pCtx, dataArray, scale, State.ui.isA11y, cfg);
        }
    },
    circular: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.circular };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 90);
            renderCircular(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        }
    },
    eq: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.eq };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 64);
            renderEq(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        }
    },
    waveform: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.waveform };
            if (window.ESG_ECO_MODE) cfg.glowMult = Math.min(cfg.glowMult, 0.3);
            renderWaveform(ctx, canvas2D, audio.analyser, scale, safePulse, State.ui.isA11y, cfg);
        }
    }
};

function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm; vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora; sun = auroraSystem.sun;
    nebulaSystem = initNebulaShader(canvas3D);
}

export function applyResolution(width, height) {
    canvas2D.width = width; canvas2D.height = height;
    canvas3D.width = width; canvas3D.height = height;
    particleCanvas.width = width; particleCanvas.height = height;
    vfxCanvas.width = width; vfxCanvas.height = height; 

    if (rm && rm.renderer) { rm.renderer.setSize(width, height, false); rm.camera.aspect = width / height; rm.camera.updateProjectionMatrix(); }
    if (nebulaSystem && nebulaSystem.renderer) nebulaSystem.renderer.setSize(width, height, false);
    forceRenderFrame();
}

export function getScale() { return canvas2D.width / 1920; }

export function recalculateLayoutCache() {
    const scale = getScale();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    State.cache.lastScale = scale;

    if (State.ui.channelName) {
        State.cache.cNameLines = State.ui.channelName.split('\n');
        ctx2D.font = `bold ${32*scale}px ${font}`;
        State.cache.cNameMaxWidth = ctx2D.measureText(State.cache.cNameLines[0]).width;
        if (State.cache.cNameLines.length > 1) {
            ctx2D.font = `${18*scale}px ${font}`;
            for (let i = 1; i < State.cache.cNameLines.length; i++) State.cache.cNameMaxWidth = Math.max(State.cache.cNameMaxWidth, ctx2D.measureText(State.cache.cNameLines[i]).width);
        }
    } else { State.cache.cNameMaxWidth = 0; }

    if (State.ui.topicTitle) { ctx2D.font = `bold ${64 * scale}px ${font}`; State.cache.topicWidth = ctx2D.measureText(State.ui.topicTitle).width; } else State.cache.topicWidth = 0;
    if (State.ui.speakerInfo) { ctx2D.font = `${26 * scale}px ${font}`; State.cache.speakerWidth = ctx2D.measureText(State.ui.speakerInfo).width; } else State.cache.speakerWidth = 0;
}

/* ========================================== */
/* 🎨 完美渲染管線核心                          */
/* ========================================== */
function renderCore(dataArray, safePulse) {
    try {
        ctx2D.globalCompositeOperation = 'source-over';
        ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
        
        let renderCameraShake = State.ui.cameraShake;
        let vfxPulse = safePulse;
        
        if (State.ui.autoVJ) {
            const isDrop = safePulse > 0.08; 
            renderCameraShake = isDrop;
            vfxPulse = isDrop ? safePulse * 1.5 : safePulse; 
        }

        const hasBg = bgManager && bgManager.media;
        if (hasBg) {
            const bgScale = 1 + (vfxPulse * 0.05); 
            ctx2D.save();
            ctx2D.translate(canvas2D.width / 2, canvas2D.height / 2);
            ctx2D.scale(bgScale, bgScale);
            ctx2D.translate(-canvas2D.width / 2, -canvas2D.height / 2);
            bgManager.draw(ctx2D, canvas2D.width, canvas2D.height);
            
            const baseDim = State.ui.bgDim !== undefined ? State.ui.bgDim : 0.85;
            const dynamicOpacity = Math.max(0.0, baseDim - (vfxPulse * 0.5));
            ctx2D.fillStyle = `rgba(0, 0, 0, ${dynamicOpacity})`;
            ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);
            ctx2D.restore();
        } else {
            ctx2D.fillStyle = '#000000';
            ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);
        }

        vfxCtx.clearRect(0, 0, vfxCanvas.width, vfxCanvas.height);
        
        /* 1. 繪製 3D 底層 */
        ['aurora', 'nebula'].forEach(id => {
            if (State.activeVFX.includes(id) && VFXRegistry[id]) VFXRegistry[id].render(vfxCtx, vfxCanvas, canvas3D, dataArray, vfxPulse, getScale());
        });

        /* 2. 繪製 2D 疊加層 (包含全新 RetroGrid) */
        ['retrogrid', 'particle', 'ink', 'bokeh', 'circular', 'eq', 'waveform'].forEach(id => {
            if (State.activeVFX.includes(id) && VFXRegistry[id]) VFXRegistry[id].render(vfxCtx, vfxCanvas, canvas3D, dataArray, vfxPulse, getScale());
        });

        let camOffsetX = 0, camOffsetY = 0, chromaticOffset = 0; 

        if (renderCameraShake) {
            const time = Date.now() * 0.001;
            camOffsetX = Math.sin(time * 0.5) * 0.01 * canvas2D.width;
            camOffsetY = Math.cos(time * 0.3) * 0.01 * canvas2D.height;
            if (vfxPulse > 0.05) {
                camOffsetX += (Math.random() - 0.5) * vfxPulse * 60;
                camOffsetY += (Math.random() - 0.5) * vfxPulse * 60;
                chromaticOffset = vfxPulse * 25 * getScale(); 
            }
        }

        const dx = (State.layoutOffsets.vfx.px - 0.5) * canvas2D.width + camOffsetX;
        const dy = (State.layoutOffsets.vfx.py - 0.5) * canvas2D.height + camOffsetY;
        
        /* 電影級色散後處理 */
        if (chromaticOffset > 2) {
            ctx2D.globalCompositeOperation = hasBg ? 'screen' : 'lighter';
            ctx2D.save(); ctx2D.globalAlpha = 0.6; ctx2D.drawImage(vfxCanvas, dx - chromaticOffset, dy); ctx2D.restore();
            ctx2D.save(); ctx2D.globalAlpha = 0.6; ctx2D.drawImage(vfxCanvas, dx + chromaticOffset, dy); ctx2D.restore();
            ctx2D.globalAlpha = 1.0; ctx2D.drawImage(vfxCanvas, dx, dy);
        } else {
            ctx2D.globalCompositeOperation = hasBg ? 'screen' : 'source-over';
            ctx2D.drawImage(vfxCanvas, dx, dy);
        }
        
        ctx2D.globalCompositeOperation = 'source-over';
        drawLayout(); 
        drawLyrics(); 
        if (!State.ui.obsMode) drawInteractions(); 
    } catch (e) {
        console.error("[Black Core Sentinel] Render Core 崩潰:", e);
        throw e; 
    }
}

function extractAudioPulse() {
    let safePulse = 0;
    if (audio && audio.analyser) {
        if (!sharedDataArray || sharedDataArray.length !== audio.analyser.frequencyBinCount) sharedDataArray = new Uint8Array(audio.analyser.frequencyBinCount);
        audio.analyser.getByteFrequencyData(sharedDataArray);
        const bassSum = sharedDataArray[0] + sharedDataArray[1] + sharedDataArray[2] + sharedDataArray[3] + sharedDataArray[4] + sharedDataArray[5];
        const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
        safePulse = State.ui.isA11y ? Math.min(orbPulse, 0.15) : orbPulse;
    }
    return safePulse;
}

export function forceRenderFrame() {
    if (isDrawing || renderPending) return; 
    renderPending = true;
    requestAnimationFrame(() => {
        try { renderCore(sharedDataArray || new Uint8Array(256), extractAudioPulse()); } 
        catch (e) { console.error("Force Render Crashed", e); } 
        finally { renderPending = false; }
    });
}

export function drawMasterLoop() {
    if (!isDrawing) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    try {
        renderCore(sharedDataArray || new Uint8Array(256), extractAudioPulse());
        animationFrameId = requestAnimationFrame(drawMasterLoop);
    } catch (error) {
        console.error("[Black Core Sentinel] Master Loop 嚴重崩潰，安全停機", error);
        isDrawing = false;
        if(uiManager) uiManager.showToast("⚠️ 渲染引擎發生異常，已啟動安全保護機制停機", "red");
    }
}

function drawLayout() {
    const scale = getScale();
    if (scale !== State.cache.lastScale) recalculateLayoutCache();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = (State.activeVFX.includes('nebula') || State.activeVFX.includes('aurora')) ? 30 * scale : 15 * scale;

    if (!userHasDragged) {
        const isLeftAlign = (State.activeVFX.includes('circular'));
        State.layoutOffsets.titles.px = isLeftAlign ? 0.08 : 0.50; 
        State.layoutOffsets.titles.py = isLeftAlign ? 0.35 : 0.16; 
        State.layoutOffsets.lyrics.px = isLeftAlign ? 0.08 : 0.50; 
        State.layoutOffsets.lyrics.py = isLeftAlign ? 0.88 : 0.90; 
        State.layoutOffsets.vfx.px = 0.50; State.layoutOffsets.vfx.py = 0.50;
    }

    const cx = State.layoutOffsets.channel.px * canvas2D.width, cy = State.layoutOffsets.channel.py * canvas2D.height;
    const tx = State.layoutOffsets.titles.px * canvas2D.width, ty = State.layoutOffsets.titles.py * canvas2D.height;
    const lx = State.layoutOffsets.logo.px * canvas2D.width, ly = State.layoutOffsets.logo.py * canvas2D.height;

    if (State.ui.channelName && State.cache.cNameLines.length > 0) {
        ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'top';
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx2D.font = `bold ${32*scale}px ${font}`;
        ctx2D.fillText(State.cache.cNameLines[0], cx, cy);
        let currentY = cy + 40 * scale;
        if (State.cache.cNameLines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx2D.font = `${18*scale}px ${font}`;
            for (let i = 1; i < State.cache.cNameLines.length; i++) {
                ctx2D.fillText(State.cache.cNameLines[i], cx, currentY); currentY += 26 * scale;
            }
        }
        hitboxes.channel = { x: cx, y: cy, w: State.cache.cNameMaxWidth, h: currentY - cy };
    } else hitboxes.channel = { x: 0, y: 0, w: 0, h: 0 };
    
    if (State.ui.topicTitle || State.ui.speakerInfo) {
        const align = (State.layoutOffsets.titles.px < 0.25) ? 'left' : ((State.layoutOffsets.titles.px > 0.75) ? 'right' : 'center');
        ctx2D.textAlign = align; ctx2D.textBaseline = 'top';
        let currentY = ty;
        if (State.ui.topicTitle) {
            ctx2D.fillStyle = '#ffffff'; ctx2D.font = `bold ${64 * scale}px ${font}`; ctx2D.fillText(State.ui.topicTitle, tx, currentY); currentY += 76 * scale;
        }
        if (State.ui.speakerInfo) {
            ctx2D.fillStyle = '#a0aec0'; ctx2D.font = `${26 * scale}px ${font}`; ctx2D.fillText(State.ui.speakerInfo, tx, currentY); currentY += 32 * scale;
        }
        const maxW = Math.max(State.cache.topicWidth, State.cache.speakerWidth);
        let boxX = tx; if (align === 'center') boxX = tx - maxW / 2; if (align === 'right') boxX = tx - maxW;
        hitboxes.titles = { x: boxX, y: ty, w: maxW, h: currentY - ty };
    } else hitboxes.titles = { x: 0, y: 0, w: 0, h: 0 };
    
    ctx2D.shadowBlur = 0;
    const logoImg = getLogoImg ? getLogoImg() : null;
    if (logoImg && logoImg.src && logoImg.complete) {
        const maxW = 120 * scale * State.ui.logoScale, aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW, dh = aspect < 1 ? maxW : maxW / aspect;
        const drawX = lx - dw, drawY = ly;
        ctx2D.drawImage(logoImg, drawX, drawY, dw, dh);
        hitboxes.logo = { x: drawX, y: drawY, w: dw, h: dh };
    } else hitboxes.logo = { x: 0, y: 0, w: 0, h: 0 };

    const vx = State.layoutOffsets.vfx.px * canvas2D.width, vy = State.layoutOffsets.vfx.py * canvas2D.height;
    const vSize = 150 * scale; 
    hitboxes.vfx = { x: vx - vSize/2, y: vy - vSize/2, w: vSize, h: vSize };
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
            
            let hintText = window.t ? window.t('drag_hint') : '⤡ 拖曳自訂位置';
            if (target === 'logo') hintText = window.t ? window.t('drag_hint_logo') : '⤡ 拖曳 / 滾輪縮放';
            if (target === 'vfx') hintText = window.t ? window.t('drag_hint_vfx') : '⤡ 拖曳特效中心';
            
            ctx2D.fillText(hintText, box.x - 10*scale, box.y - 16*scale);
            
            if (target === 'vfx') {
                ctx2D.beginPath();
                ctx2D.moveTo(box.x + box.w/2, box.y + box.h/2 - 15*scale); ctx2D.lineTo(box.x + box.w/2, box.y + box.h/2 + 15*scale);
                ctx2D.moveTo(box.x + box.w/2 - 15*scale, box.y + box.h/2); ctx2D.lineTo(box.x + box.w/2 + 15*scale, box.y + box.h/2);
                ctx2D.stroke();
            }
            ctx2D.restore();
        }
    }
}

function drawLyrics() {
    let active = "";
    const currentMode = getCurrentMode ? getCurrentMode() : null;
    if ((currentMode === 'file' || currentMode === 'dual') && audioPlayer && !audioPlayer.paused) {
        active = lyricsManager.getActiveLyric(audioPlayer.currentTime);
    }
    if (!active && (dragTarget === 'lyrics' || hoverTarget === 'lyrics' || (lyricsManager && lyricsManager.isSyncing))) {
        active = (lyricsManager && lyricsManager.parsedLyrics.length > 0) ? (window.t ? window.t('lyric_preview') : '預覽') : (window.t ? window.t('lyric_placeholder') : '歌詞');
    }

    const scale = getScale(), lx = State.layoutOffsets.lyrics.px * canvas2D.width, ly = State.layoutOffsets.lyrics.py * canvas2D.height;
    const align = (State.layoutOffsets.lyrics.px < 0.25) ? 'left' : ((State.layoutOffsets.lyrics.px > 0.75) ? 'right' : 'center');

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

/* 👆 滑鼠與觸控事件互動處理 */
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let cx = evt.touches?.length ? evt.touches[0].clientX : evt.clientX;
    let cy = evt.touches?.length ? evt.touches[0].clientY : evt.clientY;
    return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
}

function handlePointerMove(e) {
    const pos = getMousePos(canvas2D, e);
    if (dragTarget) {
        let newPx = (pos.x - dragOffsetX) / canvas2D.width;
        let newPy = (pos.y - dragOffsetY) / canvas2D.height;
        State.layoutOffsets[dragTarget].px = Math.max(0.02, Math.min(0.98, newPx));
        State.layoutOffsets[dragTarget].py = Math.max(0.02, Math.min(0.98, newPy));
        
        userHasDragged = true; 
        if (onLayoutChangeCallback) onLayoutChangeCallback('drag', null);
        
        forceRenderFrame(); 
        canvas2D.style.cursor = 'grabbing';
        if(e.cancelable) e.preventDefault(); 
        return;
    }
    hoverTarget = null; const pad = 15 * getScale();
    for (const key of ['vfx', 'channel', 'titles', 'logo', 'lyrics']) {
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
        dragOffsetX = pos.x - State.layoutOffsets[dragTarget].px * canvas2D.width;
        dragOffsetY = pos.y - State.layoutOffsets[dragTarget].py * canvas2D.height;
        canvas2D.style.cursor = 'grabbing'; if (!isDrawing) forceRenderFrame();
    }
}

function handlePointerUp() {
    if (dragTarget) { dragTarget = null; canvas2D.style.cursor = hoverTarget ? 'grab' : 'default'; if (!isDrawing) forceRenderFrame(); }
}

function initCanvasInteractions() {
    canvas2D.addEventListener('mousemove', handlePointerMove); 
    canvas2D.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp); 
    canvas2D.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas2D.addEventListener('touchstart', handlePointerDown); 
    window.addEventListener('touchend', handlePointerUp);

    canvas2D.addEventListener('wheel', (e) => {
        if (hoverTarget === 'logo' || dragTarget === 'logo') {
            e.preventDefault(); 
            if (onLayoutChangeCallback) onLayoutChangeCallback('wheel', e.deltaY);
        }
    }, { passive: false });
    
    document.addEventListener("visibilitychange", () => { if (rm) rm.isActive = !document.hidden; });
}