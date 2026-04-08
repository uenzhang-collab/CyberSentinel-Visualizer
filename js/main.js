import { AudioEngine } from './AudioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';
// 🌟 匯入 Shader 模組
import { initNebulaShader, renderNebulaShader } from './vfx/NebulaShader.js';

/**
 * ==========================================
 * 核心字典與多國語系 (i18n System)
 * 確保全球使用者皆能無縫操作 CyberSentinel
 * ==========================================
 */
const translations = {
    "zh-TW": {
        "nav_brand": "CyberSentinel 黑核核心",
        "creator_label": "CS-Founder 2026.04.06",
        "step1_title": "1️⃣ 匯入素材 (音源與排版)",
        "btn_mic": "🎙️ 啟用麥克風",
        "btn_upload": "🎵 上傳音樂",
        "step2_title": "2️⃣ 動態歌詞 (LRC 打軸)",
        "step3_title": "3️⃣ 視覺特效與微調",
        "step4_title": "4️⃣ 即時預覽與錄製 (大視窗)",
        "btn_record": "🔴 開始錄影",
        "vfx_mod_aurora": "極光水晶柱",
        "vfx_mod_sun": "核心太陽",
        "vfx_transmission": "💎 透光度",
        "vfx_speed": "🔄 旋轉速度",
        "vfx_a11y": "🔒 視覺保護模式",
        "energy_msg": "🌱 節能模式",
        "vfx_p_amount": "☄️ 噴發數量 (Density)",
        "vfx_p_speed": "🚀 飛行速度 (Speed)",
        "vfx_c_count": "📊 能量柱數量 (Bar Count)",
        "vfx_c_amp": "💥 光譜爆發力 (Amplitude)",
        "vfx_c_color": "🌈 色彩流轉 (Color Flow)",
        "vfx_c_spin": "💿 唱盤轉速 (Spin Speed)",
        "vfx_e_count": "📊 能量柱數量 (Bar Count)",
        "vfx_e_amp": "💥 光譜爆發力 (Amplitude)",
        "vfx_e_color": "🌈 色彩流轉 (Color Flow)",
        "vfx_e_gravity": "☄️ 懸浮重力 (Cap Gravity)",
        "vfx_w_amp": "💥 波幅張力 (Amplitude)",
        "vfx_w_color": "🌈 色彩流轉 (Color Flow)",
        "vfx_w_glow": "✨ 霓虹殘影 (Neon Trails)",
        "vfx_w_thick": "📏 線條粗細 (Line Thickness)",
        "vfx_n_viscosity": "🧪 流體黏滯度 (Viscosity)",
        "vfx_n_color": "🎨 異星色調偏移 (Color Shift)",
        "convert_title": "進階：需要轉檔為 MP4 嗎？",
        "convert_desc": "由於瀏覽器技術限制，錄影原生輸出為 WebM 格式。若您需要傳送至 iPhone、LINE 或 Instagram 等平台，建議使用以下安全免費的線上轉檔工具：",
        "convert_free": "🌐 前往 FreeConvert 轉檔",
        "convert_cloud": "☁️ 前往 CloudConvert 轉檔",
        "privacy_notice": "🛡️ 隱私主權承諾：本系統採 100% 本地端邊緣運算，您的音訊絕不上傳雲端，完美保障資料安全。",
        "esg_eco_mode": "🌱 ESG 節能模式啟動 (低電量)"
    },
    "en-US": {
        "nav_brand": "CyberSentinel Core",
        "creator_label": "CS-Founder 2026.04.06",
        "step1_title": "1️⃣ Import Materials",
        "btn_mic": "🎙️ Enable Mic",
        "btn_upload": "🎵 Upload Audio",
        "step2_title": "2️⃣ Dynamic Lyrics",
        "step3_title": "3️⃣ Visual Effects",
        "step4_title": "4️⃣ Preview & Record",
        "btn_record": "🔴 Start Recording",
        "vfx_mod_aurora": "Aurora Bars",
        "vfx_mod_sun": "Core Sun",
        "vfx_transmission": "💎 Transmission",
        "vfx_speed": "🔄 Rotation Speed",
        "vfx_a11y": "🔒 Visual Protection",
        "energy_msg": "🌱 Power Saving",
        "vfx_p_amount": "☄️ Particle Density",
        "vfx_p_speed": "🚀 Flying Speed",
        "vfx_c_count": "📊 Bar Count",
        "vfx_c_amp": "💥 Amplitude",
        "vfx_c_color": "🌈 Color Flow",
        "vfx_c_spin": "💿 Spin Speed",
        "vfx_e_count": "📊 Bar Count",
        "vfx_e_amp": "💥 Amplitude",
        "vfx_e_color": "🌈 Color Flow",
        "vfx_e_gravity": "☄️ Cap Gravity",
        "vfx_w_amp": "💥 Amplitude",
        "vfx_w_color": "🌈 Color Flow",
        "vfx_w_glow": "✨ Neon Trails",
        "vfx_w_thick": "📏 Line Thickness",
        "vfx_n_viscosity": "🧪 Fluid Viscosity",
        "vfx_n_color": "🎨 Alien Color Shift",
        "convert_title": "Need MP4 Format?",
        "convert_desc": "Native output is WebM. If you need to share to iPhone, LINE, or Instagram, use these free tools:",
        "convert_free": "🌐 Convert via FreeConvert",
        "convert_cloud": "☁️ Convert via CloudConvert",
        "privacy_notice": "🛡️ Privacy Pledge: 100% local edge computing. Your audio never leaves your device.",
        "esg_eco_mode": "🌱 ESG Eco Mode (Low Battery)"
    }
};

// ==========================================
// 全域狀態與 DOM 宣告
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
// 1. 初始化與解析度控制
// ==========================================
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
    if (!isDrawing) drawLayout();
}

function getScale() { return canvas2D.width / 1920; }

// ==========================================
// 2. ESG 節能與環境偵測
// ==========================================
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
                        notice.innerHTML = '<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> <span data-i18n="esg_eco_mode">🌱 ESG 節能模式啟動</span>';
                        notice.style.display = 'flex';
                        updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
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
            console.warn("Battery API not supported.");
        }
    }
}

// ==========================================
// 3. 總渲染迴圈 (Master Render Loop)
// ==========================================
function drawMasterLoop() {
    if (!isDrawing) return;
    requestAnimationFrame(drawMasterLoop);
    
    if (!audio.analyser) return;
    const dataArray = new Uint8Array(audio.analyser.frequencyBinCount);
    audio.analyser.getByteFrequencyData(dataArray);
    
    const activeVfx = vfxSelector.value;
    const scale = getScale(); 
    const bassSum = dataArray.slice(0, 6).reduce((a, b) => a + b, 0);
    const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
    const isA11y = document.getElementById('chkA11y').checked;
    const safePulse = isA11y ? Math.min(orbPulse, 0.15) : orbPulse;

    // 讀取 UI 設定值
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

    // ESG 低碳降載
    if (window.ESG_ECO_MODE) {
        config.particle.amountMult *= 0.3;
        config.nebula.viscosity *= 0.5;
        config.circular.count = Math.min(config.circular.count, 90);
    }

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
            // 🎯 關鍵轉印：將 GPU 繪製內容拍給 2D 畫布以便 MediaRecorder 捕捉
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

    drawLayout();
    drawLyrics();
}

// ==========================================
// 4. 🎨 排版系統 (美學優化：黃金比例版)
// ==========================================
function drawLayout() {
    const cName = document.getElementById('channelName').value.trim();
    const topic = document.getElementById('topicTitle').value.trim();
    const speaker = document.getElementById('speakerInfo').value.trim();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    const scale = getScale();

    // 🏆 黃金比例加固：38.2% 垂直位置
    const shadowIntensity = (vfxSelector.value === 'nebula' || vfxSelector.value === 'aurora') ? 45 : 15;
    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = shadowIntensity * scale;
    
    const isLeftAlign = (vfxSelector.value === 'circular');
    const align = isLeftAlign ? 'left' : 'center';
    
    // 🎯 校準 Y 軸：大標題鎖定在 38.2% 的視覺黃金點
    const tx = isLeftAlign ? 80 * scale : canvas2D.width / 2;
    const ty = isLeftAlign ? canvas2D.height * 0.45 : canvas2D.height * 0.382; 
    
    // 🎯 校準副標題：標題高度 + 黃金呼吸空間 (95px * scale)
    const sx = tx;
    const sy = ty + (95 * scale);

    // 4.1 左上角頻道資訊
    if (cName) {
        ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'top';
        const lines = cName.split('\n');
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)'; 
        ctx2D.font = `bold ${42*scale}px ${font}`;
        ctx2D.fillText(lines[0], 60*scale, 60*scale);
        if (lines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.55)'; 
            ctx2D.font = `${24*scale}px ${font}`;
            for (let i = 1; i < lines.length; i++) {
                ctx2D.fillText(lines[i], 60*scale, (60 + 55 + (i-1)*35)*scale);
            }
        }
    }
    
    // 4.2 主標題
    if (topic) {
        ctx2D.textAlign = align; ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#ffffff'; 
        ctx2D.font = `bold ${(align === 'center' ? 76 : 82) * scale}px ${font}`;
        ctx2D.shadowBlur = (shadowIntensity * 1.5) * scale; 
        ctx2D.fillText(topic, tx, ty); 
        ctx2D.shadowBlur = shadowIntensity * scale; 
    }
    
    // 4.3 副標題
    if (speaker) {
        ctx2D.textAlign = align; ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#cbd5e1'; 
        ctx2D.font = `${32*scale}px ${font}`;
        ctx2D.fillText(speaker, sx, sy);
    }
    
    ctx2D.shadowBlur = 0;
    // 4.4 右上角 Logo
    if (logoImg.src && logoImg.complete) {
        const maxW = 120 * scale; const aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW;
        const dh = aspect < 1 ? maxW : maxW / aspect;
        ctx2D.drawImage(logoImg, canvas2D.width - dw - 60*scale, 60*scale, dw, dh);
    }
}

// ==========================================
// 5. 🛡️ 隱私權提示系統
// ==========================================
function showPrivacyToast() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-gray-900/95 backdrop-blur-md border border-blue-500/50 text-blue-300 px-5 py-4 rounded-xl text-sm shadow-2xl z-[100] flex items-center gap-4 transform transition-all duration-700 translate-y-24 opacity-0 max-w-sm';
    toast.innerHTML = `
        <span class="text-2xl drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">🛡️</span> 
        <p data-i18n="privacy_notice" class="leading-relaxed">隱私主權承諾：本系統採 100% 本地端邊緣運算，您的音訊絕不上傳雲端，完美保障資料安全。</p> 
        <button class="text-gray-500 hover:text-white text-xl leading-none transition-colors" id="closeToast">&times;</button>
    `;
    document.body.appendChild(toast);
    document.getElementById('closeToast').onclick = () => toast.remove();
    
    updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
    requestAnimationFrame(() => { setTimeout(() => { toast.classList.remove('translate-y-24', 'opacity-0'); }, 100); });
    setTimeout(() => { if(document.body.contains(toast)) { toast.classList.add('translate-y-24', 'opacity-0'); setTimeout(() => toast.remove(), 700); } }, 8000);
}

// ==========================================
// 6. 🎵 歌詞、打軸與音訊處理
// ==========================================
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

function drawLyrics() {
    if (currentMode !== 'file' || parsedLyrics.length === 0 || audioPlayer.paused) return;
    const ct = audioPlayer.currentTime;
    let active = "";
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (ct >= parsedLyrics[i].time) active = parsedLyrics[i].text;
        else break; 
    }
    if (active) {
        const scale = getScale();
        ctx2D.textAlign = vfxSelector.value === 'circular' ? 'left' : 'center'; 
        ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#ffde2a'; 
        ctx2D.font = `bold ${48*scale}px "Microsoft JhengHei", sans-serif`;
        ctx2D.shadowColor = 'rgba(0,0,0,1)'; ctx2D.shadowBlur = 15 * scale;
        const lx = vfxSelector.value === 'circular' ? 80*scale : canvas2D.width/2;
        const ly = vfxSelector.value === 'circular' ? canvas2D.height * 0.88 : canvas2D.height * 0.90;
        ctx2D.fillText(active, lx, ly);
    }
}

async function handleFileImport(file) {
    if (!file.type.startsWith('audio/')) return alert('請匯入有效的音訊檔案！');
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
        document.getElementById('overlayText').innerText = '🎵 音樂已載入，請點選「開始錄影」';
        document.getElementById('canvasOverlay').style.display = 'flex';
        btnRecord.disabled = false;
        btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
        btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'file';
        applyResolution(1920, 1080); 
        if (!isDrawing) drawLayout();
    } catch (e) { console.error("Load failed:", e); }
}

function drawStaticWaveform(data) {
    const container = document.getElementById('waveformPreview');
    if (!container) return; 
    container.innerHTML = ''; 
    const max = Math.max(...data);
    data.forEach((val, i) => {
        const bar = document.createElement('div');
        const h = (val / max) * 100;
        bar.className = 'w-1 bg-gray-600 rounded-full transition-all hover:bg-blue-400 cursor-pointer';
        bar.style.height = `${Math.max(10, h)}%`;
        bar.onclick = () => { audioPlayer.currentTime = audioPlayer.duration * (i / data.length); };
        container.appendChild(bar);
    });
}

// ==========================================
// 7. 🖱️ UI 事件綁定 (全面展開無縮水版)
// ==========================================
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('bg-blue-900/20'); });
window.addEventListener('dragleave', () => { document.body.classList.remove('bg-blue-900/20'); });
window.addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('bg-blue-900/20'); const file = e.dataTransfer.files[0]; if (file) handleFileImport(file); });

// 7.1 打軸工具監聽器
document.getElementById('btnToggleSync').addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel');
    panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) stopSyncing();
});

document.getElementById('btnStartSync').addEventListener('click', () => {
    if(currentMode !== 'file') return alert('請先上傳音樂！');
    if (isSyncing) { audioPlayer.pause(); stopSyncing(); return; }
    const text = lyricsInput.value.trim();
    if (!text) return alert('請貼上純文字歌詞！');
    rawLines = text.split('\n').map(l=>l.trim()).filter(l=>l);
    syncIndex = 0; isSyncing = true;
    lyricsInput.value = rawLines.join('\n');
    document.getElementById('btnStartSync').innerHTML = '⏸️ 停止打軸';
    document.getElementById('btnMarkTime').disabled = false;
    document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
    audioPlayer.currentTime = 0; audioPlayer.play();
});

document.getElementById('btnMarkTime').addEventListener('click', () => {
    if(!isSyncing || syncIndex >= rawLines.length) return;
    const ct = audioPlayer.currentTime;
    const tag = `[${Math.floor(ct/60).toString().padStart(2,'0')}:${Math.floor(ct%60).toString().padStart(2,'0')}.${Math.floor((ct%1)*100).toString().padStart(2,'0')}]`;
    let lines = lyricsInput.value.split('\n');
    for(let i=0; i<lines.length; i++){ if(lines[i] === rawLines[syncIndex]){ lines[i] = tag + rawLines[syncIndex]; break; } }
    lyricsInput.value = lines.join('\n');
    parseLRC(lyricsInput.value);
    syncIndex++;
    if (syncIndex >= rawLines.length) {
        document.getElementById('currentSyncLine').innerHTML = '<span class="text-green-400">🎉 標記完成！</span>';
        isSyncing = false; document.getElementById('btnStartSync').innerHTML = '▶️ 重新開始';
    } else {
        document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    }
});

// 7.2 滑桿與數值更新監聽 (展開)
const sliders = [
    'slCircAmp', 'slCircColor', 'slCircSpin', 'slCircCount', 
    'slEqCount', 'slEqAmp', 'slEqColor', 'slEqGravity', 
    'slWaveAmp', 'slWaveColor', 'slWaveGlow', 'slWaveThick', 
    'slTransmission', 'slRotation', 'slParticleAmount', 
    'slParticleSpeed', 'slNebViscosity', 'slNebColor'
];
sliders.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const label = document.getElementById(id.replace('sl', 'val'));
            if(label) label.textContent = (id.includes('Count') || id.includes('Thick')) ? val : val.toFixed(2) + 'x';
        });
    }
});

// 7.3 VFX 切換邏輯
vfxSelector.addEventListener('change', (e) => {
    const v = e.target.value;
    ['panel3D', 'panelNebula', 'panelParticle', 'panelCircular', 'panelEq', 'panelWaveform'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    const activePanel = 'panel' + v.charAt(0).toUpperCase() + v.slice(1);
    const p = document.getElementById(v === 'aurora' ? 'panel3D' : activePanel);
    if(p) p.classList.remove('hidden');
    if (audio.analyser) audio.analyser.fftSize = (v === 'waveform' || v === 'aurora' || v === 'nebula') ? 2048 : 256;
    if (!isDrawing) drawLayout();
});

// 7.4 錄影引擎 (無損 MediaRecorder)
btnRecord.addEventListener('click', () => {
    recordedChunks = [];
    const canvasStream = canvas2D.captureStream(30);
    const combinedStream = new MediaStream([...canvasStream.getTracks(), ...streamDestination.stream.getTracks()]);
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
    try { mediaRecorder = new MediaRecorder(combinedStream, options); } catch (e) { return; }
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        document.getElementById('recordedVideo').src = videoUrl;
        document.getElementById('downloadLink').href = videoUrl;
        document.getElementById('downloadLink').download = `CyberSentinel_${Date.now()}.webm`; 
        document.getElementById('resultModal').classList.replace('hidden', 'flex'); 
        document.getElementById('recordingStatus').classList.add('hidden');
        btnRecord.disabled = false; btnStopRecord.disabled = true;
    };
    mediaRecorder.start();
    document.getElementById('canvasOverlay').style.display = 'none';
    if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
    if(currentMode === 'file') { audioPlayer.currentTime = 0; audioPlayer.play(); }
    document.getElementById('recordingStatus').classList.remove('hidden');
    btnRecord.disabled = true; btnStopRecord.disabled = false;
});

btnStopRecord.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (currentMode === 'file') audioPlayer.pause();
    isDrawing = false;
});

// 7.5 其他 UI 事件
document.getElementById('langSelect').addEventListener('change', (e) => updateLanguage(e.target.value));
document.getElementById('btnCloseResult').addEventListener('click', () => document.getElementById('resultModal').classList.replace('flex', 'hidden'));
document.getElementById('btnMic').addEventListener('click', async () => {
    try {
        await audio.init(await navigator.mediaDevices.getUserMedia({ audio: true }));
        if (!streamDestination) { streamDestination = audio.audioCtx.createMediaStreamDestination(); audio.analyser.connect(streamDestination); }
        document.getElementById('overlayText').innerText = '🎙️ 麥克風就緒，請點選「開始錄影」';
        document.getElementById('canvasOverlay').style.display = 'flex';
        btnRecord.disabled = false; currentMode = 'mic';
        applyResolution(1920, 1080); if (!isDrawing) drawLayout();
    } catch(e) { alert("音源失敗。"); }
});
document.getElementById('audioUpload').addEventListener('change', (e) => { if(e.target.files.length) handleFileImport(e.target.files[0]); });
document.getElementById('channelLogo').addEventListener('change', function(e) { if(this.files.length) { logoImg.onload = () => { if (!isDrawing) drawLayout(); }; logoImg.src = URL.createObjectURL(this.files[0]); } });
['channelName', 'topicTitle', 'speakerInfo'].forEach(id => { document.getElementById(id).addEventListener('input', () => { if (!isDrawing) drawLayout(); }); });

// ==========================================
// 8. 啟動與環境監聽
// ==========================================
setup3D();
setTimeout(() => applyResolution(1920, 1080), 500);
updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
initESGMode();
setTimeout(() => { showPrivacyToast(); }, 1500);

document.addEventListener("visibilitychange", () => {
    if (!window.ESG_ECO_MODE) document.getElementById('energyNotice').style.display = document.hidden ? "flex" : "none";
    if (rm) rm.isActive = !document.hidden;
});

window.addEventListener('keydown', (e) => { 
    if(isSyncing && e.code === 'Space' && document.activeElement !== lyricsInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { 
        e.preventDefault(); document.getElementById('btnMarkTime').click(); 
    }
});