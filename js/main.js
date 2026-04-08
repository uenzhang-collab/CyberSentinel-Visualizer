import { AudioEngine } from './AudioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';
import { initNebulaShader, renderNebulaShader } from './vfx/NebulaShader.js';
import { translations } from './i18n.js';

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

// --- 初始化 3D 與 Shader 引擎 ---
function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm;
    vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora;
    sun = auroraSystem.sun;
    nebulaSystem = initNebulaShader(canvas3D);
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
    
    if (nebulaSystem && nebulaSystem.renderer) {
        nebulaSystem.renderer.setSize(width, height, false);
    }
    if (!isDrawing) drawLayout();
}

function getScale() { 
    return canvas2D.width / 1920; 
}

// ==========================================
// ESG 節能引擎與電池偵測
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
            console.log('Battery Status API not fully supported.');
        }
    }
}

// ==========================================
// 總渲染迴圈
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

    drawLayout();
    drawLyrics();
}

// ==========================================
// 隱私權與排版 UI 系統
// ==========================================
function showPrivacyToast() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-gray-900/95 backdrop-blur-md border border-blue-500/50 text-blue-300 px-5 py-4 rounded-xl text-sm shadow-2xl z-[100] flex items-center gap-4 transform transition-all duration-700 translate-y-24 opacity-0 max-w-sm';
    toast.innerHTML = `
        <span class="text-2xl drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">🛡️</span> 
        <p data-i18n="privacy_notice" class="leading-relaxed">隱私主權承諾：本系統採 100% 本地端邊緣運算，您的音訊絕不上傳雲端，完美保障資料安全。</p> 
        <button class="text-gray-500 hover:text-white text-xl leading-none transition-colors" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);
    updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
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
    const shadowIntensity = (vfxSelector.value === 'nebula') ? 30 : 12;

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = shadowIntensity * scale;
    
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
        ctx2D.shadowBlur = (shadowIntensity * 1.5) * scale; ctx2D.fillText(topic, tx, ty); ctx2D.shadowBlur = shadowIntensity * scale; 
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
// 檔案匯入邏輯
// ==========================================
async function handleFileImport(file) {
    if (!file.type.startsWith('audio/')) {
        alert('請匯入有效的音訊檔案！');
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
        if(overlayText) overlayText.innerText = '🎵 音樂已載入，請點選「開始錄影」';
        const overlay = document.getElementById('canvasOverlay');
        if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false;
        btnRecord.classList.replace('bg-gray-700', 'bg-red-600');
        btnRecord.classList.replace('text-gray-400', 'text-white');
        currentMode = 'file';
        applyResolution(1920, 1080); 
        if (!isDrawing) drawLayout();
    } catch (e) {
        alert("載入失敗！");
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
    if(currentMode !== 'file') return alert('請先上傳音樂！');
    if (isSyncing) { audioPlayer.pause(); stopSyncing(); return; }
    
    const text = lyricsInput.value.trim();
    if (!text) return alert('請貼上純文字歌詞！');

    rawLines = text.split('\n').map(l=>l.trim()).filter(l=>l);
    syncIndex = 0; isSyncing = true;
    lyricsInput.value = rawLines.join('\n');

    document.getElementById('btnStartSync').innerHTML = '⏸️ 停止打軸';
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
        document.getElementById('currentSyncLine').innerHTML = '<span class="text-green-400">🎉 全部標記完成！</span>';
        isSyncing = false;
        document.getElementById('btnStartSync').innerHTML = '▶️ 重新開始';
        document.getElementById('btnMarkTime').disabled = true;
    } else {
        document.getElementById('currentSyncLine').innerText = rawLines[syncIndex];
    }
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
            document.getElementById('logoLabel').innerText = "✅ 已載入 Logo"; 
            if (!isDrawing) drawLayout(); 
        };
        logoImg.src = URL.createObjectURL(this.files[0]);
    }
});

['channelName', 'topicTitle', 'speakerInfo'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        if (!isDrawing) drawLayout();
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
        alert('不支援此格式。'); return; 
    }
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    
    // --- 優化：錄影停止後的 IndexedDB 自動暫存邏輯 ---
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        
        // 核心改進：等待影片暫存至本地資料庫，防止瀏覽器崩潰丟失檔案
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

// ==========================================
// 其餘事件監聽
// ==========================================
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
    if (!isDrawing) drawLayout();
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
        btnRecord.disabled = false;
        currentMode = 'mic';
        applyResolution(1920, 1080); if (!isDrawing) drawLayout();
    } catch(e) { alert("存取失敗！"); }
});

document.getElementById('langSelect').addEventListener('change', (e) => updateLanguage(e.target.value));

function updateLanguage(lang) {
    const dict = translations[lang];
    if (!dict) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = dict[el.getAttribute('data-i18n')] || el.textContent;
    });
    localStorage.setItem('preferredLang', lang);
}

// 啟動
setup3D();
setTimeout(() => applyResolution(1920, 1080), 500);
updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
setTimeout(() => { showPrivacyToast(); }, 1000);
initESGMode();

document.addEventListener("visibilitychange", () => {
    if (rm) rm.isActive = !document.hidden;
});