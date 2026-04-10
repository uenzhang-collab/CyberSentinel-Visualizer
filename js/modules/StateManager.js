/*
 * CyberSentinel - State Manager Module
 * 負責全域狀態 (State) 的儲存、讀取，以及防呆保護機制。
 */

export const State = {
    activeVFX: ['waveform'], 
    vfx: {
        aurora: { rotSpeed: 0.2, transmission: 0.9, showAurora: true, showSun: true },
        particle: { amountMult: 1.0, speedMult: 1.0 },
        circular: { count: 360, ampMult: 1.0, colorMult: 1.0, spinMult: 1.0 },
        eq: { count: 128, ampMult: 1.0, colorMult: 1.0, gravityMult: 1.0 },
        waveform: { ampMult: 1.0, colorMult: 1.0, glowMult: 1.0, thick: 5 },
        nebula: { viscosity: 0.2, colorFlow: 1.0 },
        ink: { spreadMult: 1.0, colorFlow: 1.0, persistence: 0.9 },
        bokeh: { count: 30, speedMult: 1.0, glowMult: 1.0 },
        /* 🌟 註冊復古網格預設狀態 */
        retrogrid: { speedMult: 1.0, glowMult: 1.0, terrainHeight: 1.0 } 
    },
    ui: {
        channelName: "", topicTitle: "", speakerInfo: "", 
        logoScale: 1.0, isA11y: false,
        volBGM: 1.0, volMic: 1.0,
        cameraShake: true, 
        obsMode: false,    
        bgDim: 0.85,
        autoVJ: false 
    },
    layoutOffsets: {
        channel: { px: 0.04, py: 0.06 }, titles: { px: 0.50, py: 0.16 },  
        logo: { px: 0.96, py: 0.06 }, lyrics: { px: 0.50, py: 0.90 },
        vfx: { px: 0.50, py: 0.50 } 
    },
    cache: {
        cNameLines: [], cNameMaxWidth: 0, topicWidth: 0, speakerWidth: 0, lastScale: 0,
        userHasDragged: false
    }
};

class StateManager {
    constructor() {
        this._saveTimeout = null;
        this.initListeners();
    }

    initListeners() {
        /* 生命週期終點守護：關閉視窗前強制存檔 */
        window.addEventListener('beforeunload', () => this.save(true));
    }

    save(force = false) {
        const executeSave = () => {
            try {
                localStorage.setItem('CS_State_VFX', JSON.stringify(State.vfx));
                localStorage.setItem('CS_State_UI', JSON.stringify(State.ui));
                localStorage.setItem('CS_State_Layout', JSON.stringify(State.layoutOffsets));
                localStorage.setItem('CS_ActiveVFX', JSON.stringify(State.activeVFX));
            } catch (e) {
                console.error("[CyberSentinel] 儲存狀態至 LocalStorage 失敗", e);
            }
        };

        if (force) {
            clearTimeout(this._saveTimeout);
            executeSave();
        } else {
            clearTimeout(this._saveTimeout);
            /* 500ms 防抖動 (Debounce) 自動存檔 */
            this._saveTimeout = setTimeout(executeSave, 500); 
        }
    }

    load() {
        try {
            const savedVfx = localStorage.getItem('CS_State_VFX');
            const savedUi = localStorage.getItem('CS_State_UI');
            const savedLayout = localStorage.getItem('CS_State_Layout');
            const savedActive = localStorage.getItem('CS_ActiveVFX');
            
            if (savedVfx) State.vfx = { ...State.vfx, ...JSON.parse(savedVfx) };
            if (savedUi) State.ui = { ...State.ui, ...JSON.parse(savedUi) };
            
            /* 安全解析佈局座標，防止 NaN 白屏死機 */
            if (savedLayout) {
                const parsedLayout = JSON.parse(savedLayout);
                const safeFloat = (val, fallback) => (isNaN(parseFloat(val)) ? fallback : parseFloat(val));
                for (let key in parsedLayout) {
                    if (State.layoutOffsets[key]) {
                        State.layoutOffsets[key].px = safeFloat(parsedLayout[key].px, State.layoutOffsets[key].px);
                        State.layoutOffsets[key].py = safeFloat(parsedLayout[key].py, State.layoutOffsets[key].py);
                    }
                }
                State.cache.userHasDragged = true; 
            }

            if (savedActive) {
                let parsed = JSON.parse(savedActive);
                State.activeVFX = Array.isArray(parsed) ? parsed : [savedActive]; 
            }
        } catch (e) {
            console.warn("[CyberSentinel] 讀取本機狀態失敗，使用系統預設值", e);
        }
    }
}

export const stateManager = new StateManager();