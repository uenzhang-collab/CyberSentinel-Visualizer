import { AudioEngine } from './audioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';

// ==========================================
// 核心字典與多國語系
// ==========================================
const translations = {
    "zh-TW": {
        "nav_brand": "CyberSentinel 黑核核心",
        "creator_label": "研發者：張承偉",
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
        "convert_title": "進階：需要轉檔為 MP4 嗎？",
        "convert_desc": "由於瀏覽器技術限制，錄影原生輸出為 WebM 格式。若您需要傳送至 iPhone、LINE 或 Instagram 等平台，建議使用以下安全免費的線上轉檔工具：",
        "convert_free": "🌐 前往 FreeConvert 轉檔",
        "convert_cloud": "☁️ 前往 CloudConvert 轉檔"
    },
    "en-US": {
        "nav_brand": "CyberSentinel Core",
        "creator_label": "Developer: Zhang Cheng-wei",
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
        "convert_title": "Need MP4 Format?",
        "convert_desc": "Native output is WebM. If you need to share to iPhone, LINE, or Instagram, use these free tools:",
        "convert_free": "🌐 Convert via FreeConvert",
        "convert_cloud": "☁️ Convert via CloudConvert"
    }
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

// --- 初始化 3D 引擎 ---
function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm;
    vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora;
    sun = auroraSystem.sun;
}

// --- 畫布解析度同步 ---
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
    if (!isDrawing) drawLayout();
}

function getScale() { 
    return canvas2D.width / 1920; 
}

// ==========================================
// 總渲染迴圈 (Master Render Loop)
// ==========================================
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

    // 將 UI 數值封裝為 config 物件傳入特效模組
    const config = {
        aurora: {
            rotSpeed: parseFloat(document.getElementById('slRotation').value) || 0.2,
            transmission: parseFloat(document.getElementById('slTransmission').value) || 0.9,
            showAurora: document.getElementById('chkAurora').checked,
            showSun: document.getElementById('chkSun').checked,
        },
        particle: {
            amountMult: parseFloat(document.getElementById('slParticleAmount').value) || 1.0,
            speedMult: parseFloat(document.getElementById('slParticleSpeed').value) || 1.0,
        },
        circular: {
            count: parseInt(document.getElementById('slCircCount').value) || 360,
            ampMult: parseFloat(document.getElementById('slCircAmp').value) || 1.0,
            colorMult: parseFloat(document.getElementById('slCircColor').value) || 1.0,
            spinMult: parseFloat(document.getElementById('slCircSpin').value) || 1.0,
        },
        eq: {
            count: parseInt(document.getElementById('slEqCount').value) || 128,
            ampMult: parseFloat(document.getElementById('slEqAmp').value) || 1.0,
            colorMult: parseFloat(document.getElementById('slEqColor').value) || 1.0,
            gravityMult: parseFloat(document.getElementById('slEqGravity').value) || 1.0,
        },
        waveform: {
            ampMult: parseFloat(document.getElementById('slWaveAmp').value) || 1.0,
            colorMult: parseFloat(document.getElementById('slWaveColor').value) || 1.0,
            glowMult: parseFloat(document.getElementById('slWaveGlow').value) || 1.0,
            thick: parseFloat(document.getElementById('slWaveThick').value) || 5.0,
        }
    };

    // 依照選擇的特效，呼叫對應的渲染引擎
    switch (activeVfx) {
        case 'aurora':
            renderAurora3D(ctx2D, canvas2D, canvas3D, rm, vfxManager, aurora, sun, dataArray, safePulse, config.aurora);
            break;
        case 'particle':
            renderParticles(ctx2D, canvas2D, particleCanvas, pCtx, dataArray, scale, isA11y, config.particle);
            break;
        case 'circular':
            renderCircular(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config.circular);
            break;
        case 'eq':
            renderEq(ctx2D, canvas2D, dataArray, scale, safePulse, isA11y, config.eq);
            break;
        case 'waveform':
            renderWaveform(ctx2D, canvas2D, audio.analyser, scale, safePulse, isA11y, config.waveform);
            break;
    }

    drawLayout();
    drawLyrics();
}

// ==========================================
// 排版與 LRC 工具
// ==========================================
function drawLayout() {
    const cName = document.getElementById('channelName').value.trim();
    const topic = document.getElementById('topicTitle').value.trim();
    const speaker = document.getElementById('speakerInfo').value.trim();
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    const scale = getScale();

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = 12 * scale;
    
    const isLeftAlign = (vfxSelector.value === 'circular');
    const align = isLeftAlign ? 'left' : 'center';
    const tx = isLeftAlign ? 80 * scale : canvas2D.width / 2;
    const ty = isLeftAlign ? canvas2D.height * 0.40 : canvas2D.height * 0.15;
    const sx = isLeftAlign ? 80 * scale : canvas2D.width / 2;
    const sy = isLeftAlign ? canvas2D.height * 0.50 : canvas2D.height * 0.23;

    if (cName) {
        ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'top';
        const lines = cName.split('\n');
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx2D.font = `bold ${42*scale}px ${font}`;
        ctx2D.fillText(lines[0], 60*scale, 60*scale);
        if (lines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx2D.font = `${24*scale}px ${font}`;
            for (let i = 1; i < lines.length; i++) ctx2D.fillText(lines[i], 60*scale, (60 + 48 + (i-1)*32)*scale);
        }
    }
    
    if (topic) {
        ctx2D.textAlign = align; ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#ffffff'; ctx2D.font = `bold ${(align === 'center' ? 64 : 72) * scale}px ${font}`;
        ctx2D.shadowBlur = 20 * scale; ctx2D.fillText(topic, tx, ty); ctx2D.shadowBlur = 12 * scale; 
    }
    
    if (speaker) {
        ctx2D.textAlign = align; ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#a0aec0'; ctx2D.font = `${26*scale}px ${font}`;
        ctx2D.fillText(speaker, sx, sy);
    }
    
    ctx2D.shadowBlur = 0;
    if (logoImg.src && logoImg.complete) {
        const maxW = 120 * scale; const aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW;
        const dh = aspect < 1 ? maxW : maxW / aspect;
        ctx2D.drawImage(logoImg, canvas2D.width - dw - 60*scale, 60*scale, dw, dh);
    }
}

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
    if (currentMode !== 'file' || parsedLyrics.length === 0 || audioPlayer.paused) return;
    const ct = audioPlayer.currentTime;
    let active = "";
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (ct >= parsedLyrics[i].time) active = parsedLyrics[i].text;
        else break; 
    }
    if (active) {
        const scale = getScale();
        const activeVfx = vfxSelector.value;
        ctx2D.textAlign = activeVfx === 'circular' ? 'left' : 'center'; 
        ctx2D.textBaseline = 'middle';
        ctx2D.fillStyle = '#ffde2a'; 
        ctx2D.font = `bold ${46*scale}px "Microsoft JhengHei", sans-serif`;
        ctx2D.shadowColor = 'rgba(0,0,0,1)'; ctx2D.shadowBlur = 15 * scale;
        const lx = activeVfx === 'circular' ? 80*scale : canvas2D.width/2;
        const ly = activeVfx === 'circular' ? canvas2D.height * 0.88 : canvas2D.height * 0.90;
        ctx2D.fillText(active, lx, ly);
        ctx2D.shadowBlur = 0;
    }
}

function stopSyncing() {
    isSyncing = false;
    document.getElementById('btnStartSync').innerHTML = '▶️ 開始播放';
    document.getElementById('btnMarkTime').disabled = true;
    document.getElementById('currentSyncLine').innerText = '-- 已結束或取消 --';
}

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

// 切換特效面板
vfxSelector.addEventListener('change', (e) => {
    const v = e.target.value;
    ['panel3D', 'panelParticle', 'panelCircular', 'panelEq', 'panelWaveform'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    if (v === 'aurora') document.getElementById('panel3D').classList.remove('hidden');
    else if (v === 'particle') document.getElementById('panelParticle').classList.remove('hidden');
    else if (v === 'circular') document.getElementById('panelCircular').classList.remove('hidden');
    else if (v === 'eq') document.getElementById('panelEq').classList.remove('hidden');
    else if (v === 'waveform') document.getElementById('panelWaveform').classList.remove('hidden');

    if (audio.analyser) {
        audio.analyser.fftSize = (v === 'waveform' || v === 'aurora') ? 2048 : 256;
    }
    if (!isDrawing) drawLayout();
});

// UI 滑桿數值連動
['slCircAmp', 'slCircColor', 'slCircSpin', 'slCircCount', 'slEqCount', 'slEqAmp', 'slEqColor', 'slEqGravity', 'slWaveAmp', 'slWaveColor', 'slWaveGlow', 'slWaveThick', 'slTransmission', 'slRotation', 'slParticleAmount', 'slParticleSpeed'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const label = document.getElementById(id.replace('sl', 'val'));
            if(label) {
                label.textContent = (id.includes('Count') || id.includes('Thick')) ? val : val.toFixed(2) + 'x';
            }
        });
    }
});

// 動態歌詞工具展開
document.getElementById('btnToggleSync').addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel');
    panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) {
        stopSyncing();
    }
});

// 開始打軸
document.getElementById('btnStartSync').addEventListener('click', () => {
    if(currentMode !== 'file') return alert('請先上傳音樂！');
    if (isSyncing) { audioPlayer.pause(); stopSyncing(); return; }
    
    // 【修復】統一變數名稱為 lyricsInput
    const text = lyricsInput.value.trim();
    if (!text) return alert('請貼上純文字歌詞！');

    rawLines = text.split('\n').map(l=>l.trim()).filter(l=>l);
    syncIndex = 0; isSyncing = true;
    lyricsInput.value = rawLines.join('\n');

    document.getElementById('btnStartSync').innerHTML = '⏸️ 停止打軸';
    const btnMarkTime = document.getElementById('btnMarkTime');
    btnMarkTime.disabled = false;
    document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    
    audioPlayer.currentTime = 0; audioPlayer.play();
});

// 標記時間
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
        document.getElementById('currentSyncLine').innerHTML = '<span class="text-green-400">🎉 全部標記完成！</span>';
        isSyncing = false;
        document.getElementById('btnStartSync').innerHTML = '▶️ 重新開始';
        document.getElementById('btnMarkTime').disabled = true;
    } else {
        document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    }
});

// 空白鍵快捷鍵
window.addEventListener('keydown', (e) => { 
    if(isSyncing && e.code === 'Space' && document.activeElement !== lyricsInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { 
        e.preventDefault(); 
        document.getElementById('btnMarkTime').click(); 
    }
});

// 麥克風與音樂檔上傳
document.getElementById('btnMic').addEventListener('click', async () => {
    try {
        await audio.init(await navigator.mediaDevices.getUserMedia({ audio: true }));
        if (!streamDestination) { 
            streamDestination = audio.audioCtx.createMediaStreamDestination(); 
            audio.analyser.connect(streamDestination); 
        }
        document.getElementById('canvasOverlay').style.display = 'none';
        btnRecord.disabled = false;
        btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
        btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'mic';
        applyResolution(1920, 1080); 
        if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
    } catch(e) { 
        alert("音源存取失敗，請確認麥克風權限。"); 
    }
});

document.getElementById('audioUpload').addEventListener('change', (e) => {
    if(e.target.files.length) {
        audioPlayer.src = URL.createObjectURL(e.target.files[0]);
        audio.init(audioPlayer).then(() => {
            if (!streamDestination) { 
                streamDestination = audio.audioCtx.createMediaStreamDestination(); 
                audio.analyser.connect(streamDestination); 
            }
            document.getElementById('canvasOverlay').style.display = 'none';
            btnRecord.disabled = false;
            btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
            btnRecord.classList.replace('text-gray-400', 'text-white');
            currentMode = 'file';
            applyResolution(1920, 1080); 
            if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
        });
    }
});

// Logo 上傳
document.getElementById('channelLogo').addEventListener('change', function(e) {
    if(this.files.length) {
        logoImg.onload = () => { 
            document.getElementById('logoLabel').innerText = "✅ 已載入 Logo"; 
            if (!isDrawing) drawLayout(); 
        };
        logoImg.src = URL.createObjectURL(this.files[0]);
    }
});

// 文字排版即時更新
['channelName', 'topicTitle', 'speakerInfo'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        if (!isDrawing) drawLayout();
    });
});

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
        alert('您的瀏覽器不支援錄製此格式影片。'); 
        return; 
    }

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
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
    if(currentMode === 'file') { 
        audioPlayer.currentTime = 0; 
        audioPlayer.play(); 
    }
    
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

// ==========================================
// 語系切換 (i18n)
// ==========================================
function updateLanguage(lang) {
    const dict = translations[lang];
    if (!dict) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = dict[el.getAttribute('data-i18n')] || el.textContent;
    });
    localStorage.setItem('preferredLang', lang);
}

document.getElementById('langSelect').addEventListener('change', (e) => updateLanguage(e.target.value));

// 啟動初始化
setup3D();
setTimeout(() => applyResolution(1920, 1080), 500);
updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');

// 節能模式偵測
document.addEventListener("visibilitychange", () => {
    document.getElementById('energyNotice').style.display = document.hidden ? "flex" : "none";
    if (rm) rm.isActive = !document.hidden;
});