import { AudioEngine } from './AudioEngine.js';
import { VideoRecorder } from './modules/VideoRecorder.js';
import { LyricsManager } from './modules/LyricsManager.js';
import { BackgroundManager } from './modules/BackgroundManager.js';
import { State, stateManager } from './modules/StateManager.js'; 
import { UIManager } from './modules/UIManager.js'; 
import { AppController } from './modules/AppController.js'; 
import { 
    canvas2D, initRenderPipeline, forceRenderFrame, applyResolution, 
    recalculateLayoutCache, setUserHasDragged 
} from './modules/RenderPipeline.js';

/* ========================================== */
/* ⚙️ 核心實例化與依賴注入 (Dependency Injection) */
/* ========================================== */
const audioPlayer = document.getElementById('audioPlayer');
let logoImg = new Image();

const audio = new AudioEngine();
const videoRecorder = new VideoRecorder(canvas2D);
const lyricsManager = new LyricsManager();
const bgManager = new BackgroundManager();

let currentMode = null; 
const getCurrentMode = () => currentMode;
const setCurrentMode = (mode) => { currentMode = mode; };

/* 🌟 實例化 UI 控制中心 */
const uiManager = new UIManager({
    getLogoImg: () => logoImg,
    getBgManager: () => bgManager,
    getLyricsManager: () => lyricsManager,
    getCurrentMode: getCurrentMode,
    forceRenderFrame: () => forceRenderFrame(),
    applyResolution: (w, h) => applyResolution(w, h),
    recalculateLayoutCache: () => recalculateLayoutCache(),
    setUserHasDragged: (val) => setUserHasDragged(val)
});

/* 🌟 實例化圖形渲染管線 */
initRenderPipeline({
    audio: audio,
    audioPlayer: audioPlayer,
    bgManager: bgManager,
    lyricsManager: lyricsManager,
    getLogoImg: () => logoImg,
    getCurrentMode: getCurrentMode,
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

/* 🌟 實例化事件總線中心 */
const appController = new AppController({
    audio, audioPlayer, videoRecorder, lyricsManager, bgManager, uiManager,
    logoImg, getCurrentMode, setCurrentMode
});

/* ========================================== */
/* 🚀 系統點火啟動 */
/* ========================================== */
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
    
    /* 啟動所有 DOM 監聽事件！ */
    appController.init();

    setTimeout(() => applyResolution(1920, 1080), 500);
    setTimeout(() => uiManager.showPrivacyToast(), 1000); 
    uiManager.initESGMode();
}

/* 啟動專案 */
initSystem();