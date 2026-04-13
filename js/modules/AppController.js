/*
 * Black Core Sentinel - SVR - Application Controller
 * 負責系統所有的事件綁定 (Events)、媒體處理 (Media Import)、錄影控制與歌詞打軸邏輯。
 * 徹底實現 MVC 架構中的 C (Controller) 職責。
 */
import { State, stateManager } from './StateManager.js'; 
import { forceRenderFrame, applyResolution, recalculateLayoutCache, setIsDrawing, getIsDrawing, drawMasterLoop } from './RenderPipeline.js';

export class AppController {
    constructor(context) {
        this.audio = context.audio;
        this.audioPlayer = context.audioPlayer;
        this.videoRecorder = context.videoRecorder;
        this.lyricsManager = context.lyricsManager;
        this.bgManager = context.bgManager;
        this.uiManager = context.uiManager;
        this.logoImg = context.logoImg;
        
        this.getCurrentMode = context.getCurrentMode;
        this.setCurrentMode = context.setCurrentMode;

        this.currentLogoUrl = null;
    }

    /* 啟動所有事件監聽 */
    init() {
        this.bindLyricsEvents();
        this.bindRecordingEvents();
        this.bindMediaEvents();
        this.bindDragAndDrop();
        this.bindUIEvents();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    /* ========================================== */
    /* 🎵 歌詞打軸與時間軸同步事件                  */
    /* ========================================== */
    bindLyricsEvents() {
        const lyricsInput = document.getElementById('lyricsInput');
        const btnStartSync = document.getElementById('btnStartSync');
        const btnMarkTime = document.getElementById('btnMarkTime');

        lyricsInput?.addEventListener('input', () => {
            this.lyricsManager.parse(lyricsInput.value);
            this.updateWaveformMarkers(); 
        });

        this.audioPlayer.addEventListener('timeupdate', () => {
            const timeDisplay = document.getElementById('currentTimeDisplay');
            if (timeDisplay) timeDisplay.innerText = `${this.formatTime(this.audioPlayer.currentTime)} / ${this.formatTime(this.audioPlayer.duration)}`;
        });

        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateWaveformMarkers());

        this.audioPlayer.addEventListener('ended', () => {
            if (this.lyricsManager.isSyncing) {
                this.lyricsManager.stopSync();
                if(btnStartSync) btnStartSync.innerHTML = window.t('btn_sync_start');
                if(btnMarkTime) btnMarkTime.disabled = true;
                const currentLine = document.getElementById('currentSyncLine');
                if(currentLine) currentLine.innerText = window.t('sync_end');
            }
        });

        btnStartSync?.addEventListener('click', async () => {
            const mode = this.getCurrentMode();
            if(mode !== 'file' && mode !== 'dual') return alert(window.t('alert_no_audio'));
            await this.audio.resumeContext();

            if (this.lyricsManager.isSyncing) { 
                this.audioPlayer.pause(); this.lyricsManager.stopSync();
                btnStartSync.innerHTML = window.t('btn_sync_start');
                btnMarkTime.disabled = true;
                const currentLine = document.getElementById('currentSyncLine');
                if(currentLine) currentLine.innerText = window.t('sync_end');
                return; 
            }
            const formattedText = this.lyricsManager.startSync(lyricsInput.value);
            if (!formattedText) return alert(window.t('alert_no_lyrics'));

            lyricsInput.value = formattedText;
            btnStartSync.innerHTML = window.t('btn_sync_pause');
            btnMarkTime.disabled = false;
            const currentLine = document.getElementById('currentSyncLine');
            if(currentLine) currentLine.innerText = this.lyricsManager.rawLines[0];
            
            const overlay = document.getElementById('canvasOverlay');
            if (overlay && overlay.style.display !== 'none') {
                overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300);
            }
            if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
            this.audioPlayer.currentTime = 0; this.audioPlayer.play();
        });

        btnMarkTime?.addEventListener('click', () => {
            const result = this.lyricsManager.markNext(lyricsInput.value, this.audioPlayer.currentTime);
            if (!result) return;
            
            lyricsInput.value = result.newText;
            this.updateWaveformMarkers(); 
            
            const currentLine = document.getElementById('currentSyncLine');
            if (result.isFinished) {
                if(currentLine) currentLine.innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
                this.lyricsManager.stopSync();
                if(btnStartSync) btnStartSync.innerHTML = window.t('btn_sync_restart');
                btnMarkTime.disabled = true;
            } else {
                if(currentLine) currentLine.innerText = result.nextLine;
            }
        });

        window.addEventListener('keydown', (e) => { 
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            if (this.lyricsManager.isSyncing && e.code === 'Space') { 
                e.preventDefault(); btnMarkTime?.click(); 
            }
            if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault(); this.uiManager.toggleOBSMode();
            }
        });

        document.getElementById('btnExportLRC')?.addEventListener('click', () => {
            /* 🌟 品牌升級：匯出檔名改為 BlackCoreSentinel_SVR */
            const success = this.lyricsManager.exportLRC(lyricsInput.value.trim(), document.getElementById('topicTitle').value.trim() || 'BlackCoreSentinel_SVR_Lyrics');
            if (!success) alert(window.t('alert_no_lyrics'));
        });

        document.getElementById('btnExportSRT')?.addEventListener('click', () => {
            /* 🌟 品牌升級：匯出檔名改為 BlackCoreSentinel_SVR */
            const success = this.lyricsManager.exportSRT(lyricsInput.value.trim(), document.getElementById('topicTitle').value.trim() || 'BlackCoreSentinel_SVR_Subtitle');
            if (!success) alert(window.t('alert_no_lyrics'));
        });
    }

    updateWaveformMarkers() {
        const container = document.getElementById('waveformPreview');
        if (!container || !this.audioPlayer || isNaN(this.audioPlayer.duration) || this.audioPlayer.duration === 0) return;
        
        container.querySelectorAll('.lyric-marker').forEach(el => el.remove());
        container.classList.add('relative');
        
        this.lyricsManager.parsedLyrics.forEach(lyric => {
            const pct = lyric.time / this.audioPlayer.duration;
            if (pct >= 0 && pct <= 1) {
                const marker = document.createElement('div');
                marker.className = 'lyric-marker absolute top-0 w-[2px] h-full bg-yellow-400 z-10 pointer-events-none shadow-[0_0_5px_#facc15] opacity-80';
                marker.style.left = `${pct * 100}%`;
                container.appendChild(marker);
            }
        });
    }

    /* ========================================== */
    /* 🎥 錄影引擎事件                              */
    /* ========================================== */
    bindRecordingEvents() {
        const btnRecord = document.getElementById('btnRecord');
        const btnStopRecord = document.getElementById('btnStopRecord');

        btnRecord?.addEventListener('click', async () => {
            await this.audio.resumeContext();

            const success = this.videoRecorder.start(this.audio.streamDestination, (videoUrl) => {
                document.getElementById('recordedVideo').src = videoUrl;
                const dlLink = document.getElementById('downloadLink');
                if(dlLink) { 
                    dlLink.href = videoUrl; 
                    /* 🌟 品牌升級：錄製檔名改為 BlackCoreSentinel_SVR */
                    dlLink.download = `BlackCoreSentinel_SVR_Record_${Date.now()}.webm`; 
                }
                document.getElementById('resultModal')?.classList.replace('hidden', 'flex'); 
                document.getElementById('recordingStatus')?.classList.add('hidden');
                btnRecord.disabled = false; btnStopRecord.disabled = true;
            }, () => { alert(window.t('alert_no_record')); });

            if (success) {
                const overlay = document.getElementById('canvasOverlay');
                if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
                if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
                const mode = this.getCurrentMode();
                if(mode === 'file' || mode === 'dual') { this.audioPlayer.currentTime = 0; this.audioPlayer.play(); }
                document.getElementById('recordingStatus')?.classList.remove('hidden');
                btnRecord.disabled = true; btnStopRecord.disabled = false;
            }
        });

        btnStopRecord?.addEventListener('click', () => {
            this.videoRecorder.stop();
            const mode = this.getCurrentMode();
            if (mode === 'file' || mode === 'dual') this.audioPlayer.pause();
            setIsDrawing(false);
        });
    }

    /* ========================================== */
    /* 🎚️ 檔案匯入與雙軌混音事件                      */
    /* ========================================== */
    bindMediaEvents() {
        document.getElementById('audioUpload')?.addEventListener('change', (e) => { 
            if(e.target.files.length) this.handleFileImport(e.target.files[0]); 
        });

        document.getElementById('btnMic')?.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                await this.audio.initMic(stream); 
                this.setCurrentMode((this.getCurrentMode() === 'file') ? 'dual' : 'mic');

                const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_mic_ready');
                const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
                const btnRecord = document.getElementById('btnRecord');
                if(btnRecord) { btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white'); }
                applyResolution(1920, 1080); 
                if (!getIsDrawing()) forceRenderFrame();
            } catch(e) { alert(window.t('alert_mic_fail')); }
        });

        document.getElementById('slVolBGM')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); this.audio.setBGMVolume(val); State.ui.volBGM = val;
            const label = document.getElementById('valVolBGM'); if(label) label.textContent = val.toFixed(2);
            stateManager.save();
        });

        document.getElementById('slVolMic')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); this.audio.setMicVolume(val); State.ui.volMic = val;
            const label = document.getElementById('valVolMic'); if(label) label.textContent = val.toFixed(2);
            stateManager.save();
        });

        document.getElementById('bgUpload')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (this.uiManager.isUnsupportedFormat(file)) { alert(window.t('alert_heic_unsupported')); e.target.value = ''; return; }
                this.bgManager.load(file, () => {
                    const bgLabel = document.getElementById('bgLabel'); if (bgLabel) bgLabel.innerText = window.t('btn_bg_loaded'); 
                    this.uiManager.updateButtonVisualState('bgLabel', true);
                    const bgDimWrapper = document.getElementById('bgDimWrapper'); if (bgDimWrapper) bgDimWrapper.classList.remove('hidden');
                    forceRenderFrame();
                });
            }
        });

        document.getElementById('channelLogo')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (this.uiManager.isUnsupportedFormat(file)) { alert(window.t('alert_heic_unsupported')); e.target.value = ''; return; }
                if (this.currentLogoUrl) URL.revokeObjectURL(this.currentLogoUrl); 
                this.currentLogoUrl = URL.createObjectURL(file);
                this.logoImg.onload = () => { 
                    const logoLabel = document.getElementById('logoLabel'); if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded'); 
                    this.uiManager.updateButtonVisualState('logoLabel', true);
                    const scaleWrapper = document.getElementById('logoScaleWrapper'); if (scaleWrapper) scaleWrapper.classList.remove('hidden');
                    forceRenderFrame(); 
                };
                this.logoImg.src = this.currentLogoUrl;
            }
        });
    }

    async handleFileImport(file) {
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

            this.audioPlayer.src = URL.createObjectURL(file); 
            await this.audio.initBGM(this.audioPlayer); 
            
            try {
                const waveData = await this.audio.getStaticWaveform(file);
                this.drawStaticWaveform(waveData); this.updateWaveformMarkers(); 
            } catch (waveErr) { console.warn("Waveform skipped:", waveErr); }
            
            this.setCurrentMode((this.getCurrentMode() === 'mic') ? 'dual' : 'file');
            
            const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_audio_loaded');
            const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
            const btnRecord = document.getElementById('btnRecord');
            if(btnRecord) { btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white'); }
            applyResolution(1920, 1080); 
        } catch (e) { 
            console.error("載入失敗詳細錯誤:", e); alert(window.t('alert_load_fail') + "\n" + (e.message || "請確認檔案格式是否受支援")); 
        }
    }

    drawStaticWaveform(data) {
        const container = document.getElementById('waveformPreview'); if (!container) return; 
        container.querySelectorAll('div:not(.lyric-marker)').forEach(el => el.remove());
        const max = Math.max(...data);
        data.forEach((val, i) => {
            const bar = document.createElement('div');
            bar.className = 'w-1 bg-gray-600 rounded-full transition-all hover:bg-blue-400 cursor-pointer';
            bar.style.height = `${Math.max(10, (val / max) * 100)}%`;
            bar.onclick = async () => {
                await this.audio.resumeContext(); 
                this.audioPlayer.currentTime = this.audioPlayer.duration * (i / data.length);
                if (this.audioPlayer.paused) this.audioPlayer.play().catch(e => console.warn(e));
                if (!getIsDrawing()) { setIsDrawing(true); drawMasterLoop(); }
                const overlay = document.getElementById('canvasOverlay');
                if (overlay && overlay.style.display !== 'none') { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300); }
            };
            container.appendChild(bar);
        });
    }

    /* ========================================== */
    /* 👆 拖放與 UI 基礎操作事件                    */
    /* ========================================== */
    bindDragAndDrop() {
        window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('bg-blue-900/20'); });
        window.addEventListener('dragleave', () => document.body.classList.remove('bg-blue-900/20'));
        window.addEventListener('drop', (e) => { 
            e.preventDefault(); document.body.classList.remove('bg-blue-900/20'); 
            if (e.dataTransfer.files[0]) {
                if (this.uiManager.isUnsupportedFormat(e.dataTransfer.files[0])) return alert(window.t('alert_heic_unsupported'));
                this.handleFileImport(e.dataTransfer.files[0]); 
            }
        });
    }

    bindUIEvents() {
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

        document.getElementById('presetSelector')?.addEventListener('change', (e) => this.uiManager.applyPreset(e.target.value));

        ['channelName', 'topicTitle', 'speakerInfo'].forEach(id => { 
            document.getElementById(id)?.addEventListener('input', (e) => {
                State.ui[id] = e.target.value; recalculateLayoutCache(); stateManager.save(); forceRenderFrame();
            }); 
        });

        document.getElementById('slBgDim')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); State.ui.bgDim = val;
            const label = document.getElementById('valBgDim'); if (label) label.textContent = val.toFixed(2);
            stateManager.save(); forceRenderFrame();
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
                this.lyricsManager.stopSync();
                const btnSync = document.getElementById('btnStartSync'); if(btnSync) btnSync.innerHTML = window.t('btn_sync_start');
                const btnMark = document.getElementById('btnMarkTime'); if(btnMark) btnMark.disabled = true;
                const currentLine = document.getElementById('currentSyncLine'); if(currentLine) currentLine.innerText = window.t('sync_end');
            }
        });
    }
}