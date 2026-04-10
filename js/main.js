import { AudioEngine } from './AudioEngine.js';
import { VideoRecorder } from './modules/VideoRecorder.js';
import { LyricsManager } from './modules/LyricsManager.js';
import { BackgroundManager } from './modules/BackgroundManager.js';
import { State, stateManager } from './modules/StateManager.js'; 
import { UIManager } from './modules/UIManager.js'; 
import { 
    canvas2D, initRenderPipeline, forceRenderFrame, applyResolution, 
    recalculateLayoutCache, setUserHasDragged, setIsDrawing, 
    getIsDrawing, drawMasterLoop 
} from './modules/RenderPipeline.js';

// ==========================================
// ⚙️ 系統實例與變數初始化
// ==========================================
const audioPlayer = document.getElementById('audioPlayer');
const btnRecord = document.getElementById('btnRecord');
const btnStopRecord = document.getElementById('btnStopRecord');
const lyricsInput = document.getElementById('lyricsInput');

let audio = new AudioEngine();
let currentMode = null; 
let currentLogoUrl = null; 
let logoImg = new Image();

const videoRecorder = new VideoRecorder(canvas2D);
const lyricsManager = new LyricsManager();
const bgManager = new BackgroundManager();

// 🌟 注入 UI 介面依賴
const uiManager = new UIManager({
    getLogoImg: () => logoImg,
    getBgManager: () => bgManager,
    getLyricsManager: () => lyricsManager,
    getCurrentMode: () => currentMode,
    forceRenderFrame: () => forceRenderFrame(),
    applyResolution: (w, h) => applyResolution(w, h),
    recalculateLayoutCache: () => recalculateLayoutCache(),
    setUserHasDragged: (val) => setUserHasDragged(val)
});

// 🌟 注入圖形渲染管線依賴 (實現徹底的 MVC 解耦)
initRenderPipeline({
    audio: audio,
    audioPlayer: audioPlayer,
    bgManager: bgManager,
    lyricsManager: lyricsManager,
    getLogoImg: () => logoImg,
    getCurrentMode: () => currentMode,
    uiManager: uiManager,
    onLayoutChange: (type, data) => {
        if (type === 'wheel') {
            const slider = document.getElementById('slLogoScale');
            if (slider) {
                slider.value = Math.max(0.2, Math.min(5.0, parseFloat(slider.value) - data * 0.002));
                slider.dispatchEvent(new Event('input')); 
            }
        } else {
            const ps = document.getElementById('presetSelector');
            if(ps) ps.value = 'custom';
            stateManager.save();
        }
    }
});

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ==========================================
// 🎵 歌詞打軸與時間軸同步事件
// ==========================================
lyricsInput.addEventListener('input', () => {
    lyricsManager.parse(lyricsInput.value);
    updateWaveformMarkers(); 
});

audioPlayer.addEventListener('timeupdate', () => {
    const timeDisplay = document.getElementById('currentTimeDisplay');
    if (timeDisplay) timeDisplay.innerText = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
});

audioPlayer.addEventListener('loadedmetadata', () => updateWaveformMarkers());

audioPlayer.addEventListener('ended', () => {
    if (lyricsManager.isSyncing) {
        lyricsManager.stopSync();
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_start');
        document.getElementById('btnMarkTime').disabled = true;
        document.getElementById('currentSyncLine').innerText = window.t('sync_end');
    }
});

function updateWaveformMarkers() {
    const container = document.getElementById('waveformPreview');
    if (!container || !audioPlayer || isNaN(audioPlayer.duration) || audioPlayer.duration === 0) return;
    
    container.querySelectorAll('.lyric-marker').forEach(el => el.remove());
    container.classList.add('relative');
    
    lyricsManager.parsedLyrics.forEach(lyric => {
        const pct = lyric.time / audioPlayer.duration;
        if (pct >= 0 && pct <= 1) {
            const marker = document.createElement('div');
            marker.className = 'lyric-marker absolute top-0 w-[2px] h-full bg-yellow-400 z-10 pointer-events-none shadow-[0_0_5px_#facc15] opacity-80';
            marker.style.left = `${pct * 100}%`;
            container.appendChild(marker);
        }
    });
}

document.getElementById('btnStartSync').addEventListener('click', async () => {
    if(currentMode !== 'file' && currentMode !== 'dual') return alert(window.t('alert_no_audio'));
    await audio.resumeContext();

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
    if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
    audioPlayer.currentTime = 0; audioPlayer.play();
});

document.getElementById('btnMarkTime').addEventListener('click', () => {
    const result = lyricsManager.markNext(lyricsInput.value, audioPlayer.currentTime);
    if (!result) return;
    
    lyricsInput.value = result.newText;
    updateWaveformMarkers(); 
    
    if (result.isFinished) {
        document.getElementById('currentSyncLine').innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        lyricsManager.stopSync();
        document.getElementById('btnStartSync').innerHTML = window.t('btn_sync_restart');
        document.getElementById('btnMarkTime').disabled = true;
    } else {
        document.getElementById('currentSyncLine').innerText = result.nextLine;
    }
});

// ==========================================
// 🌟 快速鍵防呆與匯出功能
// ==========================================
window.addEventListener('keydown', (e) => { 
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (lyricsManager.isSyncing && e.code === 'Space') { 
        e.preventDefault(); document.getElementById('btnMarkTime').click(); 
    }
    if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault(); uiManager.toggleOBSMode();
    }
});

document.getElementById('btnExportLRC')?.addEventListener('click', () => {
    const success = lyricsManager.exportLRC(lyricsInput.value.trim(), document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Lyrics');
    if (!success) alert(window.t('alert_no_lyrics'));
});

document.getElementById('btnExportSRT')?.addEventListener('click', () => {
    const success = lyricsManager.exportSRT(lyricsInput.value.trim(), document.getElementById('topicTitle').value.trim() || 'CyberSentinel_Subtitle');
    if (!success) alert(window.t('alert_no_lyrics'));
});

// ==========================================
// 🎥 錄影引擎事件
// ==========================================
btnRecord.addEventListener('click', async () => {
    await audio.resumeContext();

    const success = videoRecorder.start(audio.streamDestination, (videoUrl) => {
        document.getElementById('recordedVideo').src = videoUrl;
        document.getElementById('downloadLink').href = videoUrl;
        document.getElementById('downloadLink').download = `CyberSentinel_Record_${Date.now()}.webm`; 
        document.getElementById('resultModal').classList.replace('hidden', 'flex'); 
        document.getElementById('recordingStatus').classList.add('hidden');
        btnRecord.disabled = false; btnStopRecord.disabled = true;
    }, () => { alert(window.t('alert_no_record')); });

    if (success) {
        const overlay = document.getElementById('canvasOverlay');
        if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
        if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
        if(currentMode === 'file' || currentMode === 'dual') { audioPlayer.currentTime = 0; audioPlayer.play(); }
        document.getElementById('recordingStatus').classList.remove('hidden');
        btnRecord.disabled = true; btnStopRecord.disabled = false;
    }
});

btnStopRecord.addEventListener('click', () => {
    videoRecorder.stop();
    if (currentMode === 'file' || currentMode === 'dual') audioPlayer.pause();
    setIsDrawing(false);
});

// ==========================================
// 🎚️ 檔案匯入與雙軌混音 UI 事件
// ==========================================
async function handleFileImport(file) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/') && file.type !== "") return alert(window.t('alert_invalid_file'));
    
    try {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        if (fileName.includes(" - ")) {
            const parts = fileName.split(" - ");
            const topicEl = document.getElementById('topicTitle'); if(topicEl) topicEl.value = parts[1].trim(); 
            State.ui.topicTitle = parts[1].trim();
            const speakerEl = document.getElementById('speakerInfo'); if(speakerEl) speakerEl.value = `Artist: ${parts[0].trim()}`; 
            State.ui.speakerInfo = `Artist: ${parts[0].trim()}`;
        } else {
            const topicEl = document.getElementById('topicTitle'); if(topicEl) topicEl.value = fileName; 
            State.ui.topicTitle = fileName;
        }
        recalculateLayoutCache(); stateManager.save();

        audioPlayer.src = URL.createObjectURL(file); 
        await audio.initBGM(audioPlayer); 
        
        try {
            const waveData = await audio.getStaticWaveform(file);
            drawStaticWaveform(waveData); updateWaveformMarkers(); 
        } catch (waveErr) { console.warn("Waveform skipped:", waveErr); }
        
        currentMode = (currentMode === 'mic') ? 'dual' : 'file';
        
        const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_audio_loaded');
        const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white');
        applyResolution(1920, 1080); 
    } catch (e) { 
        console.error("載入失敗詳細錯誤:", e); alert(window.t('alert_load_fail') + "\n" + (e.message || "請確認檔案格式是否受支援")); 
    }
}

document.getElementById('btnMic').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await audio.initMic(stream); 
        currentMode = (currentMode === 'file') ? 'dual' : 'mic';

        const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_mic_ready');
        const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white');
        applyResolution(1920, 1080); if (!getIsDrawing()) forceRenderFrame();
    } catch(e) { alert(window.t('alert_mic_fail')); }
});

document.getElementById('slVolBGM')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value); audio.setBGMVolume(val); State.ui.volBGM = val;
    const label = document.getElementById('valVolBGM'); if(label) label.textContent = val.toFixed(2);
    stateManager.save();
});

document.getElementById('slVolMic')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value); audio.setMicVolume(val); State.ui.volMic = val;
    const label = document.getElementById('valVolMic'); if(label) label.textContent = val.toFixed(2);
    stateManager.save();
});

document.getElementById('bgUpload')?.addEventListener('change', function(e) {
    if (this.files.length) {
        if (uiManager.isUnsupportedFormat(this.files[0])) { alert(window.t('alert_heic_unsupported')); this.value = ''; return; }
        bgManager.load(this.files[0], () => {
            const bgLabel = document.getElementById('bgLabel'); if (bgLabel) bgLabel.innerText = window.t('btn_bg_loaded'); 
            uiManager.updateButtonVisualState('bgLabel', true);
            const bgDimWrapper = document.getElementById('bgDimWrapper'); if (bgDimWrapper) bgDimWrapper.classList.remove('hidden');
            forceRenderFrame();
        });
    }
});

document.getElementById('slBgDim')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value); State.ui.bgDim = val;
    const label = document.getElementById('valBgDim'); if (label) label.textContent = val.toFixed(2);
    stateManager.save(); forceRenderFrame();
});

function drawStaticWaveform(data) {
    const container = document.getElementById('waveformPreview'); if (!container) return; 
    container.querySelectorAll('div:not(.lyric-marker)').forEach(el => el.remove());
    const max = Math.max(...data);
    data.forEach((val, i) => {
        const bar = document.createElement('div');
        bar.className = 'w-1 bg-gray-600 rounded-full transition-all hover:bg-blue-400 cursor-pointer';
        bar.style.height = `${Math.max(10, (val / max) * 100)}%`;
        bar.onclick = async () => {
            await audio.resumeContext(); 
            audioPlayer.currentTime = audioPlayer.duration * (i / data.length);
            if (audioPlayer.paused) audioPlayer.play().catch(e => console.warn(e));
            if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
            const overlay = document.getElementById('canvasOverlay');
            if (overlay && overlay.style.display !== 'none') { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
        };
        container.appendChild(bar);
    });
}

// ==========================================
// 👆 拖放與介面雜項事件
// ==========================================
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('bg-blue-900/20'); });
window.addEventListener('dragleave', () => document.body.classList.remove('bg-blue-900/20'));
window.addEventListener('drop', (e) => { 
    e.preventDefault(); document.body.classList.remove('bg-blue-900/20'); 
    if (e.dataTransfer.files[0]) {
        if (uiManager.isUnsupportedFormat(e.dataTransfer.files[0])) return alert(window.t('alert_heic_unsupported'));
        handleFileImport(e.dataTransfer.files[0]); 
    }
});

document.getElementById('audioUpload')?.addEventListener('change', (e) => { if(e.target.files.length) handleFileImport(e.target.files[0]); });

document.getElementById('channelLogo')?.addEventListener('change', function(e) {
    if (this.files.length) {
        if (uiManager.isUnsupportedFormat(this.files[0])) { alert(window.t('alert_heic_unsupported')); this.value = ''; return; }
        if (currentLogoUrl) URL.revokeObjectURL(currentLogoUrl); 
        currentLogoUrl = URL.createObjectURL(this.files[0]);
        logoImg.onload = () => { 
            const logoLabel = document.getElementById('logoLabel'); if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded'); 
            uiManager.updateButtonVisualState('logoLabel', true);
            const scaleWrapper = document.getElementById('logoScaleWrapper'); if (scaleWrapper) scaleWrapper.classList.remove('hidden');
            forceRenderFrame(); 
        };
        logoImg.src = currentLogoUrl;
    }
});

document.getElementById('resSelector')?.addEventListener('change', (e) => { 
    const mobileSel = document.getElementById('resSelectorMobile'); if(mobileSel) mobileSel.value = e.target.value; 
    applyResolution(...e.target.value.split('x').map(Number)); 
});
document.getElementById('resSelectorMobile')?.addEventListener('change', (e) => { 
    const deskSel = document.getElementById('resSelector'); if(deskSel) deskSel.value = e.target.value; 
    applyResolution(...e.target.value.split('x').map(Number)); 
});
document.getElementById('btnCloseResult')?.addEventListener('click', () => { 
    const modal = document.getElementById('resultModal');
    if(modal) modal.classList.replace('flex', 'hidden'); 
});

document.getElementById('presetSelector')?.addEventListener('change', (e) => uiManager.applyPreset(e.target.value));

['channelName', 'topicTitle', 'speakerInfo'].forEach(id => { 
    document.getElementById(id)?.addEventListener('input', (e) => {
        State.ui[id] = e.target.value; recalculateLayoutCache(); stateManager.save(); forceRenderFrame();
    }); 
});

document.getElementById('slLogoScale')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value); State.ui.logoScale = val;
    const label = document.getElementById('valLogoScale'); if(label) label.textContent = val.toFixed(1) + 'x';
    stateManager.save(); forceRenderFrame();
});

document.getElementById('chkA11y')?.addEventListener('change', (e) => { State.ui.isA11y = e.target.checked; stateManager.save(); forceRenderFrame(); });
document.getElementById('btnToggleSync')?.addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel'); if(panel) panel.classList.toggle('hidden');
    if (panel && panel.classList.contains('hidden')) {
        lyricsManager.stopSync();
        const btnSync = document.getElementById('btnStartSync'); if(btnSync) btnSync.innerHTML = window.t('btn_sync_start');
        const btnMark = document.getElementById('btnMarkTime'); if(btnMark) btnMark.disabled = true;
        const currentLine = document.getElementById('currentSyncLine'); if(currentLine) currentLine.innerText = window.t('sync_end');
    }
});

// ==========================================
// 🚀 系統入口
// ==========================================
function initSystem() {
    uiManager.upgradeUIToMultiLayer(); 
    uiManager.initLanguageSelect(); 
    uiManager.injectOBSButton(); 
    uiManager.updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
    
    stateManager.load(); 
    if (State.cache.userHasDragged) setUserHasDragged(true); 
    uiManager.syncUIToState();     

    uiManager.initVfxToggles();
    uiManager.buildDynamicUI(); 
    setTimeout(() => applyResolution(1920, 1080), 500);
    setTimeout(() => { uiManager.showPrivacyToast(); }, 1000); 
    uiManager.initESGMode();
}

// 啟動專案
initSystem();