import { AudioEngine } from './AudioEngine.js';
import { initAurora3D, renderAurora3D } from './vfx/Aurora3D.js';
import { renderParticles } from './vfx/Particles.js';
import { renderCircular, renderEq, renderWaveform } from './vfx/AudioSpectrums.js';
import { initNebulaShader, renderNebulaShader } from './vfx/NebulaShader.js';
import { renderInkGlow } from './vfx/InkGlow.js';
import { renderBokeh } from './vfx/Bokeh.js';
import { translations } from './i18n.js';
import { VideoRecorder } from './modules/VideoRecorder.js';
import { LyricsManager } from './modules/LyricsManager.js';
import { BackgroundManager } from './modules/BackgroundManager.js';

// ==========================================
// 🌐 全域翻譯引擎
// ==========================================
window.t = function(key) {
    const lang = localStorage.getItem('preferredLang') || 'zh-TW';
    return translations[lang] && translations[lang][key] ? translations[lang][key] : key;
};

// ==========================================
// 🧠 核心狀態管理與自動存檔 (Auto-Save)
// ==========================================
let State = {
    activeVFX: ['waveform'], 
    vfx: {
        aurora: { rotSpeed: 0.2, transmission: 0.9, showAurora: true, showSun: true },
        particle: { amountMult: 1.0, speedMult: 1.0 },
        circular: { count: 360, ampMult: 1.0, colorMult: 1.0, spinMult: 1.0 },
        eq: { count: 128, ampMult: 1.0, colorMult: 1.0, gravityMult: 1.0 },
        waveform: { ampMult: 1.0, colorMult: 1.0, glowMult: 1.0, thick: 5 },
        nebula: { viscosity: 0.2, colorFlow: 1.0 },
        ink: { spreadMult: 1.0, colorFlow: 1.0, persistence: 0.9 },
        bokeh: { count: 30, speedMult: 1.0, glowMult: 1.0 }
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
        cNameLines: [], cNameMaxWidth: 0, topicWidth: 0, speakerWidth: 0, lastScale: 0
    }
};

let _saveTimeout = null;

// 🛡️ 狀態同步機制
function saveState(force = false) {
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
        clearTimeout(_saveTimeout);
        executeSave();
    } else {
        clearTimeout(_saveTimeout);
        _saveTimeout = setTimeout(executeSave, 500); 
    }
}

// 🛡️ 生命週期終點守護
window.addEventListener('beforeunload', () => saveState(true));

function loadState() {
    try {
        const savedVfx = localStorage.getItem('CS_State_VFX');
        const savedUi = localStorage.getItem('CS_State_UI');
        const savedLayout = localStorage.getItem('CS_State_Layout');
        const savedActive = localStorage.getItem('CS_ActiveVFX');
        
        if (savedVfx) State.vfx = { ...State.vfx, ...JSON.parse(savedVfx) };
        if (savedUi) State.ui = { ...State.ui, ...JSON.parse(savedUi) };
        
        // 🛡️ 預設值保護機制
        if (savedLayout) {
            const parsedLayout = JSON.parse(savedLayout);
            const safeFloat = (val, fallback) => (isNaN(parseFloat(val)) ? fallback : parseFloat(val));
            for (let key in parsedLayout) {
                if (State.layoutOffsets[key]) {
                    State.layoutOffsets[key].px = safeFloat(parsedLayout[key].px, State.layoutOffsets[key].px);
                    State.layoutOffsets[key].py = safeFloat(parsedLayout[key].py, State.layoutOffsets[key].py);
                }
            }
            userHasDragged = true; 
        }

        if (savedActive) {
            let parsed = JSON.parse(savedActive);
            State.activeVFX = Array.isArray(parsed) ? parsed : [savedActive]; 
        }
    } catch (e) {
        console.warn("[CyberSentinel] 讀取本機狀態失敗，使用系統預設值", e);
    }

    // 安全綁定 UI 數值
    const bindVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const bindText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const bindChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    bindVal('topicTitle', State.ui.topicTitle);
    bindVal('speakerInfo', State.ui.speakerInfo);
    bindVal('channelName', State.ui.channelName);
    
    bindVal('slLogoScale', State.ui.logoScale);
    bindText('valLogoScale', parseFloat(State.ui.logoScale).toFixed(1) + 'x');

    if (State.ui.bgDim === undefined) State.ui.bgDim = 0.85;
    bindVal('slBgDim', State.ui.bgDim);
    bindText('valBgDim', parseFloat(State.ui.bgDim).toFixed(2));

    bindVal('slVolBGM', State.ui.volBGM);
    bindText('valVolBGM', parseFloat(State.ui.volBGM).toFixed(2));
    bindVal('slVolMic', State.ui.volMic);
    bindText('valVolMic', parseFloat(State.ui.volMic).toFixed(2));
    
    bindChk('chkA11y', State.ui.isA11y);
    bindChk('chkCameraShake', State.ui.cameraShake);
    
    if (State.ui.autoVJ === undefined) State.ui.autoVJ = false;
    bindChk('chkAutoVJ', State.ui.autoVJ);
}

function updateButtonVisualState(labelId, isLoaded) {
    const labelSpan = document.getElementById(labelId);
    if (!labelSpan) return;
    const container = labelSpan.closest('label');
    if (!container) return;

    if (isLoaded) {
        container.style.backgroundColor = 'rgba(20, 83, 45, 0.6)'; 
        container.style.borderColor = '#22c55e'; 
        labelSpan.style.color = '#4ade80'; 
    } else {
        container.style.backgroundColor = '';
        container.style.borderColor = '';
        labelSpan.style.color = '';
    }
}

// 🛡️ 防禦蘋果 HEIC 格式
function isUnsupportedFormat(file) {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
}

// ==========================================
// 🎨 一鍵大師風格庫
// ==========================================
const ThemePresets = {
    acoustic: { // 🌟 新增：不插電民謠專屬配置
        activeVFX: ['ink', 'particle'], 
        vfxState: { ink: { spreadMult: 1.2, colorFlow: 0.8, persistence: 0.95 }, particle: { amountMult: 0.3, speedMult: 0.5 } }, 
        layout: { titles: { px: 0.50, py: 0.40 }, lyrics: { px: 0.50, py: 0.80 }, vfx: { px: 0.50, py: 0.50 } } 
    },
    lofi: { 
        activeVFX: ['circular', 'particle'], 
        vfxState: { circular: { count: 180, ampMult: 0.8, colorMult: 2.0, spinMult: 0.5 }, particle: { amountMult: 0.5, speedMult: 0.5 } }, 
        layout: { titles: { px: 0.50, py: 0.16 }, lyrics: { px: 0.50, py: 0.85 }, vfx: { px: 0.50, py: 0.50 } } 
    },
    cyberpunk: { 
        activeVFX: ['waveform', 'particle'], 
        vfxState: { waveform: { ampMult: 1.5, colorMult: 3.0, glowMult: 2.5, thick: 8 }, particle: { amountMult: 1.5, speedMult: 2.0 } }, 
        layout: { titles: { px: 0.50, py: 0.16 }, lyrics: { px: 0.50, py: 0.90 }, vfx: { px: 0.50, py: 0.50 } } 
    },
    podcast: { 
        activeVFX: ['eq'], 
        vfxState: { eq: { count: 64, ampMult: 1.0, colorMult: 1.0, gravityMult: 1.5 } }, 
        layout: { titles: { px: 0.08, py: 0.35 }, lyrics: { px: 0.08, py: 0.88 }, vfx: { px: 0.50, py: 0.50 } } 
    },
    minimal: {
        activeVFX: ['particle'],
        vfxState: { particle: { amountMult: 0.5, speedMult: 0.8 } },
        layout: { titles: { px: 0.50, py: 0.40 }, lyrics: { px: 0.50, py: 0.80 }, vfx: { px: 0.50, py: 0.50 } }
    },
    urban: {
        activeVFX: ['waveform', 'bokeh'], 
        vfxState: { waveform: { ampMult: 1.2, colorMult: 1.5, glowMult: 1.8, thick: 6 }, bokeh: { count: 40, speedMult: 0.8, glowMult: 1.2 } }, 
        layout: { titles: { px: 0.50, py: 0.16 }, lyrics: { px: 0.50, py: 0.90 }, vfx: { px: 0.50, py: 0.50 } } 
    }
};

function applyPreset(presetName) {
    if (presetName === 'custom') return;
    const preset = ThemePresets[presetName];
    if (!preset) return;

    State.activeVFX = [...preset.activeVFX];
    preset.activeVFX.forEach(id => {
        if (preset.vfxState[id]) State.vfx[id] = { ...State.vfx[id], ...preset.vfxState[id] };
    });
    if (preset.layout) {
        State.layoutOffsets = { ...State.layoutOffsets, ...preset.layout };
        userHasDragged = true;
    }
    
    initVfxToggles();
    buildDynamicUI();
    recalculateLayoutCache(ctx2D, getScale());
    saveState();
    forceRenderFrame();
}

// ==========================================
// 🧩 註冊表模式 & UI 自動生成
// ==========================================
const VFXRegistry = {
    aurora: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            canvas3D.style.display = 'block';
            renderAurora3D(ctx, canvas2D, canvas3D, rm, vfxManager, aurora, sun, dataArray, safePulse, State.vfx.aurora);
            ctx.drawImage(canvas3D, 0, 0, canvas2D.width, canvas2D.height);
        },
        schema: [
            { id: 'showAurora', type: 'checkbox', label: 'vfx_mod_aurora' },
            { id: 'showSun', type: 'checkbox', label: 'vfx_mod_sun' },
            { id: 'transmission', type: 'range', label: 'vfx_transmission', min: 0, max: 1, step: 0.05 },
            { id: 'rotSpeed', type: 'range', label: 'vfx_speed', min: -1, max: 5, step: 0.05 }
        ]
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
        },
        schema: [
            { id: 'viscosity', type: 'range', label: 'vfx_n_viscosity', min: 0.05, max: 1.0, step: 0.05 },
            { id: 'colorFlow', type: 'range', label: 'vfx_n_color', min: 0, max: 3.0, step: 0.1 }
        ]
    },
    ink: { // 🌟 新增：墨暈流光模組註冊
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.ink };
            if (window.ESG_ECO_MODE) {
                cfg.spreadMult = Math.min(cfg.spreadMult, 0.5);
                cfg.persistence = Math.min(cfg.persistence, 0.7);
            }
            renderInkGlow(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'spreadMult', type: 'range', label: 'vfx_i_spread', min: 0.1, max: 3.0, step: 0.1 },
            { id: 'colorFlow', type: 'range', label: 'vfx_i_color', min: 0.0, max: 3.0, step: 0.1 },
            { id: 'persistence', type: 'range', label: 'vfx_i_persist', min: 0.1, max: 0.99, step: 0.01 }
        ]
    },
    bokeh: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.bokeh };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 15);
            renderBokeh(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'count', type: 'range', label: 'vfx_b_count', min: 10, max: 100, step: 1, isInt: true },
            { id: 'speedMult', type: 'range', label: 'vfx_b_speed', min: 0.1, max: 3.0, step: 0.1 },
            { id: 'glowMult', type: 'range', label: 'vfx_b_glow', min: 0.1, max: 3.0, step: 0.1 }
        ]
    },
    particle: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.particle };
            if (window.ESG_ECO_MODE) cfg.amountMult = Math.min(cfg.amountMult, 0.25);
            renderParticles(ctx, canvas2D, particleCanvas, pCtx, dataArray, scale, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'amountMult', type: 'range', label: 'vfx_p_amount', min: 0.1, max: 4.0, step: 0.1 },
            { id: 'speedMult', type: 'range', label: 'vfx_p_speed', min: 0.5, max: 3.0, step: 0.1 }
        ]
    },
    circular: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.circular };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 90);
            renderCircular(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'count', type: 'range', label: 'vfx_c_count', min: 60, max: 720, step: 2, isInt: true },
            { id: 'ampMult', type: 'range', label: 'vfx_c_amp', min: 0.5, max: 3.0, step: 0.1 },
            { id: 'colorMult', type: 'range', label: 'vfx_c_color', min: 0, max: 5.0, step: 0.1 },
            { id: 'spinMult', type: 'range', label: 'vfx_c_spin', min: 0, max: 3.0, step: 0.1 }
        ]
    },
    eq: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.eq };
            if (window.ESG_ECO_MODE) cfg.count = Math.min(cfg.count, 64);
            renderEq(ctx, canvas2D, dataArray, scale, safePulse, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'count', type: 'range', label: 'vfx_e_count', min: 32, max: 256, step: 4, isInt: true },
            { id: 'ampMult', type: 'range', label: 'vfx_e_amp', min: 0.5, max: 3.0, step: 0.1 },
            { id: 'colorMult', type: 'range', label: 'vfx_e_color', min: 0, max: 5.0, step: 0.1 },
            { id: 'gravityMult', type: 'range', label: 'vfx_e_gravity', min: 0.1, max: 3.0, step: 0.1 }
        ]
    },
    waveform: {
        render: (ctx, canvas2D, canvas3D, dataArray, safePulse, scale) => {
            const cfg = { ...State.vfx.waveform };
            if (window.ESG_ECO_MODE) cfg.glowMult = Math.min(cfg.glowMult, 0.3);
            renderWaveform(ctx, canvas2D, audio.analyser, scale, safePulse, State.ui.isA11y, cfg);
        },
        schema: [
            { id: 'ampMult', type: 'range', label: 'vfx_w_amp', min: 0.5, max: 3.0, step: 0.1 },
            { id: 'colorMult', type: 'range', label: 'vfx_w_color', min: 0, max: 5.0, step: 0.1 },
            { id: 'glowMult', type: 'range', label: 'vfx_w_glow', min: 0, max: 3.0, step: 0.1 },
            { id: 'thick', type: 'range', label: 'vfx_w_thick', min: 1, max: 15, step: 1, isInt: true }
        ]
    }
};

const vfxOptionsList = [
    { id: 'aurora', icon: '🌌', label: 'vfx_opt_aurora' },
    { id: 'nebula', icon: '🧬', label: 'vfx_opt_nebula' },
    { id: 'ink', icon: '🖌️', label: 'vfx_opt_ink' },
    { id: 'bokeh', icon: '🎇', label: 'vfx_opt_bokeh' },
    { id: 'particle', icon: '☄️', label: 'vfx_opt_particle' },
    { id: 'circular', icon: '💿', label: 'vfx_opt_circular' },
    { id: 'eq', icon: '🎚️', label: 'vfx_opt_eq' },
    { id: 'waveform', icon: '🌊', label: 'vfx_opt_waveform' }
];

function upgradeUIToMultiLayer() {
    const oldSelector = document.getElementById('vfxSelector');
    if (oldSelector && oldSelector.tagName === 'SELECT') {
        const parent = oldSelector.parentElement;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-center mb-2 border-b border-gray-700 pb-1';
        
        headerDiv.innerHTML = `
            <span class="text-xs text-gray-400" data-i18n="lbl_active_vfx">${window.t('lbl_active_vfx') || '疊加特效 (可複選)'}</span>
            <div class="flex items-center gap-3">
                <label class="text-xs text-purple-400 flex items-center gap-1 cursor-pointer" title="重低音爆發時自動開啟運鏡與增強特效">
                    <input type="checkbox" id="chkAutoVJ" class="rounded text-purple-600 focus:ring-purple-500" ${State.ui.autoVJ ? 'checked' : ''}>
                    <span data-i18n="lbl_auto_vj">${window.t('lbl_auto_vj') || '🤖 AI 自動導播'}</span>
                </label>
                <label class="text-xs text-blue-400 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="chkCameraShake" class="rounded text-blue-600 focus:ring-blue-500" ${State.ui.cameraShake ? 'checked' : ''}>
                    <span data-i18n="lbl_camera_shake">${window.t('lbl_camera_shake') || '🎥 電影運鏡'}</span>
                </label>
            </div>
        `;
        parent.insertBefore(headerDiv, oldSelector);

        const togglesDiv = document.createElement('div');
        togglesDiv.id = 'vfxToggles';
        togglesDiv.className = 'grid grid-cols-2 gap-2 text-xs mb-4';
        parent.insertBefore(togglesDiv, oldSelector);
        
        oldSelector.style.display = 'none'; 
        
        document.getElementById('chkCameraShake')?.addEventListener('change', (e) => {
            State.ui.cameraShake = e.target.checked;
            saveState();
        });

        document.getElementById('chkAutoVJ')?.addEventListener('change', (e) => {
            State.ui.autoVJ = e.target.checked;
            saveState();
        });
    }
}

function initVfxToggles() {
    const container = document.getElementById('vfxToggles');
    if (!container) return;
    container.innerHTML = '';
    
    vfxOptionsList.forEach(opt => {
        const btn = document.createElement('button');
        const isActive = State.activeVFX.includes(opt.id);
        
        btn.className = `py-2 px-2 rounded-lg font-bold transition-all border text-left flex items-center gap-2 ${isActive ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`;
        btn.innerHTML = `<span>${opt.icon}</span> <span class="truncate" data-i18n="${opt.label}">${window.t(opt.label)}</span>`;
        
        btn.onclick = () => {
            if (opt.id === 'aurora' && !State.activeVFX.includes('aurora')) {
                State.activeVFX = State.activeVFX.filter(v => v !== 'nebula');
            }
            if (opt.id === 'nebula' && !State.activeVFX.includes('nebula')) {
                State.activeVFX = State.activeVFX.filter(v => v !== 'aurora');
            }

            if (State.activeVFX.includes(opt.id)) {
                if (State.activeVFX.length > 1) { 
                    State.activeVFX = State.activeVFX.filter(v => v !== opt.id);
                }
            } else {
                State.activeVFX.push(opt.id);
            }
            
            document.getElementById('presetSelector').value = 'custom';
            initVfxToggles();
            buildDynamicUI();
            saveState();
            forceRenderFrame();
        };
        container.appendChild(btn);
    });
}

function buildDynamicUI() {
    const container = document.getElementById('dynamicVfxContainer');
    if (!container) return;
    container.innerHTML = '';
    
    State.activeVFX.forEach(vfxKey => {
        const schema = VFXRegistry[vfxKey]?.schema || [];
        if(schema.length === 0) return;
        
        const titleDiv = document.createElement('div');
        const optInfo = vfxOptionsList.find(o => o.id === vfxKey);
        titleDiv.className = 'text-xs text-blue-400 mt-2 mb-1 font-bold border-b border-gray-700 pb-1';
        titleDiv.innerHTML = `${optInfo ? optInfo.icon : ''} <span data-i18n="${optInfo ? optInfo.label : ''}">${optInfo ? window.t(optInfo.label) : vfxKey}</span>`;
        container.appendChild(titleDiv);

        const chkContainer = document.createElement('div');
        chkContainer.className = 'flex flex-wrap gap-3 mb-1';
        
        schema.forEach(param => {
            if (param.type === 'checkbox') {
                const lbl = document.createElement('label');
                lbl.className = 'flex items-center gap-2 cursor-pointer group';
                const chk = document.createElement('input');
                chk.type = 'checkbox'; chk.className = 'w-3.5 h-3.5 bg-gray-700 rounded border-gray-600 focus:ring-blue-500';
                chk.checked = State.vfx[vfxKey][param.id];
                chk.addEventListener('change', (e) => {
                    State.vfx[vfxKey][param.id] = e.target.checked;
                    document.getElementById('presetSelector').value = 'custom';
                    saveState(); forceRenderFrame();
                });
                const span = document.createElement('span');
                span.className = 'text-sm text-gray-300 group-hover:text-white transition-colors';
                span.setAttribute('data-i18n', param.label); span.textContent = window.t(param.label);
                lbl.appendChild(chk); lbl.appendChild(span); chkContainer.appendChild(lbl);
            } else if (param.type === 'range') {
                const wrap = document.createElement('div'); wrap.className = 'flex flex-col gap-1 mb-2';
                const head = document.createElement('label'); head.className = 'text-xs flex justify-between text-gray-400';
                const spanName = document.createElement('span'); spanName.setAttribute('data-i18n', param.label); spanName.textContent = window.t(param.label);
                const spanVal = document.createElement('span'); spanVal.className = 'text-blue-400';
                
                const val = State.vfx[vfxKey][param.id];
                spanVal.textContent = param.isInt ? val : val.toFixed(2) + 'x';
                head.appendChild(spanName); head.appendChild(spanVal);
                
                const range = document.createElement('input');
                range.type = 'range'; range.className = 'w-full';
                range.min = param.min; range.max = param.max; range.step = param.step; range.value = val;
                
                range.addEventListener('input', (e) => {
                    const newVal = parseFloat(e.target.value);
                    State.vfx[vfxKey][param.id] = newVal;
                    spanVal.textContent = param.isInt ? newVal : newVal.toFixed(2) + 'x';
                    document.getElementById('presetSelector').value = 'custom';
                    saveState(); forceRenderFrame();
                });
                wrap.appendChild(head); wrap.appendChild(range); container.appendChild(wrap);
            }
        });
        if (chkContainer.childNodes.length > 0) container.appendChild(chkContainer);
    });
}

// ==========================================
// ⚙️ DOM 與核心模組初始化
// ==========================================
const audioPlayer = document.getElementById('audioPlayer');
const btnRecord = document.getElementById('btnRecord');
const btnStopRecord = document.getElementById('btnStopRecord');
const lyricsInput = document.getElementById('lyricsInput');

let audio = new AudioEngine();
let isDrawing = false;
let currentMode = null; 

let currentLogoUrl = null; 
let logoImg = new Image();

const canvas2D = document.getElementById('visualizer2D');
const ctx2D = canvas2D.getContext('2d');
const canvas3D = document.getElementById('visualizer3D'); 
const particleCanvas = document.createElement('canvas');
const pCtx = particleCanvas.getContext('2d');

const vfxCanvas = document.createElement('canvas');
const vfxCtx = vfxCanvas.getContext('2d');

let rm, vfxManager, aurora, sun, nebulaSystem; 
const videoRecorder = new VideoRecorder(canvas2D);
const lyricsManager = new LyricsManager();
const bgManager = new BackgroundManager();

let hitboxes = { channel: {x:0,y:0,w:0,h:0}, titles: {x:0,y:0,w:0,h:0}, logo: {x:0,y:0,w:0,h:0}, lyrics: {x:0,y:0,w:0,h:0}, vfx: {x:0,y:0,w:0,h:0} };
let dragTarget = null, hoverTarget = null, dragOffsetX = 0, dragOffsetY = 0, userHasDragged = false; 

let animationFrameId = null;
let sharedDataArray = null; 

function setup3D() {
    const auroraSystem = initAurora3D(canvas3D);
    rm = auroraSystem.rm; vfxManager = auroraSystem.vfxManager;
    aurora = auroraSystem.aurora; sun = auroraSystem.sun;
    nebulaSystem = initNebulaShader(canvas3D);
}

function applyResolution(width, height) {
    canvas2D.width = width; canvas2D.height = height;
    canvas3D.width = width; canvas3D.height = height;
    particleCanvas.width = width; particleCanvas.height = height;
    vfxCanvas.width = width; vfxCanvas.height = height; 

    if (rm && rm.renderer) { rm.renderer.setSize(width, height, false); rm.camera.aspect = width / height; rm.camera.updateProjectionMatrix(); }
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

function recalculateLayoutCache(ctx, scale) {
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';
    State.cache.lastScale = scale;

    if (State.ui.channelName) {
        State.cache.cNameLines = State.ui.channelName.split('\n');
        ctx.font = `bold ${32*scale}px ${font}`;
        State.cache.cNameMaxWidth = ctx.measureText(State.cache.cNameLines[0]).width;
        if (State.cache.cNameLines.length > 1) {
            ctx.font = `${18*scale}px ${font}`;
            for (let i = 1; i < State.cache.cNameLines.length; i++) State.cache.cNameMaxWidth = Math.max(State.cache.cNameMaxWidth, ctx.measureText(State.cache.cNameLines[i]).width);
        }
    } else { State.cache.cNameMaxWidth = 0; }

    if (State.ui.topicTitle) { ctx.font = `bold ${64 * scale}px ${font}`; State.cache.topicWidth = ctx.measureText(State.ui.topicTitle).width; } else State.cache.topicWidth = 0;
    if (State.ui.speakerInfo) { ctx.font = `${26 * scale}px ${font}`; State.cache.speakerWidth = ctx.measureText(State.ui.speakerInfo).width; } else State.cache.speakerWidth = 0;
}

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ==========================================
// 🎨 完美渲染迴圈 (多層疊加 + 音頻呼吸 + 電影級運鏡)
// ==========================================
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
        
        ['aurora', 'nebula'].forEach(id => {
            if (State.activeVFX.includes(id) && VFXRegistry[id]) {
                VFXRegistry[id].render(vfxCtx, vfxCanvas, canvas3D, dataArray, vfxPulse, getScale());
            }
        });

        ['particle', 'ink', 'bokeh', 'circular', 'eq', 'waveform'].forEach(id => {
            if (State.activeVFX.includes(id) && VFXRegistry[id]) {
                VFXRegistry[id].render(vfxCtx, vfxCanvas, canvas3D, dataArray, vfxPulse, getScale());
            }
        });

        let camOffsetX = 0;
        let camOffsetY = 0;
        let chromaticOffset = 0; 

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
        
        if (chromaticOffset > 2) {
            ctx2D.globalCompositeOperation = hasBg ? 'screen' : 'lighter';
            
            ctx2D.save();
            ctx2D.globalAlpha = 0.6;
            ctx2D.drawImage(vfxCanvas, dx - chromaticOffset, dy);
            ctx2D.restore();
            
            ctx2D.save();
            ctx2D.globalAlpha = 0.6;
            ctx2D.drawImage(vfxCanvas, dx + chromaticOffset, dy);
            ctx2D.restore();
            
            ctx2D.globalAlpha = 1.0;
            ctx2D.drawImage(vfxCanvas, dx, dy);
        } else {
            ctx2D.globalCompositeOperation = hasBg ? 'screen' : 'source-over';
            ctx2D.drawImage(vfxCanvas, dx, dy);
        }
        
        ctx2D.globalCompositeOperation = 'source-over';
        drawLayout(); 
        drawLyrics(); 
        
        if (!State.ui.obsMode) drawInteractions(); 
    } catch (e) {
        console.error("[CyberSentinel] Render Core 崩潰:", e);
        throw e;
    }
}

function extractAudioPulse() {
    let safePulse = 0;
    if (audio.analyser) {
        if (!sharedDataArray || sharedDataArray.length !== audio.analyser.frequencyBinCount) {
            sharedDataArray = new Uint8Array(audio.analyser.frequencyBinCount);
        }
        audio.analyser.getByteFrequencyData(sharedDataArray);
        const bassSum = sharedDataArray[0] + sharedDataArray[1] + sharedDataArray[2] + sharedDataArray[3] + sharedDataArray[4] + sharedDataArray[5];
        const orbPulse = Math.pow((bassSum / 6) / 255, 3.0); 
        safePulse = State.ui.isA11y ? Math.min(orbPulse, 0.15) : orbPulse;
    }
    return safePulse;
}

let renderPending = false;
function forceRenderFrame() {
    if (isDrawing || renderPending) return; 
    renderPending = true;
    requestAnimationFrame(() => {
        try {
            const safePulse = extractAudioPulse();
            renderCore(sharedDataArray || new Uint8Array(256), safePulse);
        } catch (e) {
            console.error("Force Render Crashed", e);
        } finally {
            renderPending = false;
        }
    });
}

function drawMasterLoop() {
    if (!isDrawing) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    try {
        const safePulse = extractAudioPulse();
        renderCore(sharedDataArray || new Uint8Array(256), safePulse);
        animationFrameId = requestAnimationFrame(drawMasterLoop);
    } catch (error) {
        console.error("[CyberSentinel] Master Loop 嚴重崩潰，安全停機", error);
        isDrawing = false;
        showToast("⚠️ 渲染引擎發生異常，已啟動安全保護機制停機", "red");
    }
}

function drawLayout() {
    const scale = getScale();
    if (scale !== State.cache.lastScale) recalculateLayoutCache(ctx2D, scale);
    const font = '"Microsoft JhengHei", "PingFang TC", sans-serif';

    ctx2D.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx2D.shadowBlur = (State.activeVFX.includes('nebula') || State.activeVFX.includes('aurora')) ? 30 * scale : 15 * scale;

    if (!userHasDragged) {
        const isLeftAlign = (State.activeVFX.includes('circular'));
        State.layoutOffsets.titles.px = isLeftAlign ? 0.08 : 0.50; 
        State.layoutOffsets.titles.py = isLeftAlign ? 0.35 : 0.16; 
        State.layoutOffsets.lyrics.px = isLeftAlign ? 0.08 : 0.50; 
        State.layoutOffsets.lyrics.py = isLeftAlign ? 0.88 : 0.90; 
        State.layoutOffsets.vfx.px = 0.50;
        State.layoutOffsets.vfx.py = 0.50;
    }

    const cx = State.layoutOffsets.channel.px * canvas2D.width; const cy = State.layoutOffsets.channel.py * canvas2D.height;
    const tx = State.layoutOffsets.titles.px * canvas2D.width; const ty = State.layoutOffsets.titles.py * canvas2D.height;
    const lx = State.layoutOffsets.logo.px * canvas2D.width; const ly = State.layoutOffsets.logo.py * canvas2D.height;

    if (State.ui.channelName && State.cache.cNameLines.length > 0) {
        ctx2D.textAlign = 'left'; ctx2D.textBaseline = 'top';
        ctx2D.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx2D.font = `bold ${32*scale}px ${font}`;
        ctx2D.fillText(State.cache.cNameLines[0], cx, cy);
        let currentY = cy + 40 * scale;
        if (State.cache.cNameLines.length > 1) {
            ctx2D.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx2D.font = `${18*scale}px ${font}`;
            for (let i = 1; i < State.cache.cNameLines.length; i++) {
                ctx2D.fillText(State.cache.cNameLines[i], cx, currentY);
                currentY += 26 * scale;
            }
        }
        hitboxes.channel = { x: cx, y: cy, w: State.cache.cNameMaxWidth, h: currentY - cy };
    } else hitboxes.channel = { x: 0, y: 0, w: 0, h: 0 };
    
    if (State.ui.topicTitle || State.ui.speakerInfo) {
        const align = (State.layoutOffsets.titles.px < 0.25) ? 'left' : ((State.layoutOffsets.titles.px > 0.75) ? 'right' : 'center');
        ctx2D.textAlign = align; ctx2D.textBaseline = 'top';
        let currentY = ty;
        if (State.ui.topicTitle) {
            ctx2D.fillStyle = '#ffffff'; ctx2D.font = `bold ${64 * scale}px ${font}`; ctx2D.fillText(State.ui.topicTitle, tx, currentY);
            currentY += 76 * scale;
        }
        if (State.ui.speakerInfo) {
            ctx2D.fillStyle = '#a0aec0'; ctx2D.font = `${26 * scale}px ${font}`; ctx2D.fillText(State.ui.speakerInfo, tx, currentY);
            currentY += 32 * scale;
        }
        const maxW = Math.max(State.cache.topicWidth, State.cache.speakerWidth);
        let boxX = tx; if (align === 'center') boxX = tx - maxW / 2; if (align === 'right') boxX = tx - maxW;
        hitboxes.titles = { x: boxX, y: ty, w: maxW, h: currentY - ty };
    } else hitboxes.titles = { x: 0, y: 0, w: 0, h: 0 };
    
    ctx2D.shadowBlur = 0;
    if (logoImg.src && logoImg.complete) {
        const maxW = 120 * scale * State.ui.logoScale, aspect = logoImg.width / logoImg.height;
        const dw = aspect < 1 ? maxW * aspect : maxW, dh = aspect < 1 ? maxW : maxW / aspect;
        const drawX = lx - dw, drawY = ly;
        ctx2D.drawImage(logoImg, drawX, drawY, dw, dh);
        hitboxes.logo = { x: drawX, y: drawY, w: dw, h: dh };
    } else hitboxes.logo = { x: 0, y: 0, w: 0, h: 0 };

    const vx = State.layoutOffsets.vfx.px * canvas2D.width;
    const vy = State.layoutOffsets.vfx.py * canvas2D.height;
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
            
            let hintText = window.t('drag_hint');
            if (target === 'logo') hintText = window.t('drag_hint_logo');
            if (target === 'vfx') hintText = window.t('drag_hint_vfx') || '⤡ 拖曳特效中心';
            
            ctx2D.fillText(hintText, box.x - 10*scale, box.y - 16*scale);
            
            if (target === 'vfx') {
                ctx2D.beginPath();
                ctx2D.moveTo(box.x + box.w/2, box.y + box.h/2 - 15*scale);
                ctx2D.lineTo(box.x + box.w/2, box.y + box.h/2 + 15*scale);
                ctx2D.moveTo(box.x + box.w/2 - 15*scale, box.y + box.h/2);
                ctx2D.lineTo(box.x + box.w/2 + 15*scale, box.y + box.h/2);
                ctx2D.stroke();
            }
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
        let newPx = (pos.x - dragOffsetX) / canvas2D.width;
        let newPy = (pos.y - dragOffsetY) / canvas2D.height;
        State.layoutOffsets[dragTarget].px = Math.max(0.02, Math.min(0.98, newPx));
        State.layoutOffsets[dragTarget].py = Math.max(0.02, Math.min(0.98, newPy));
        
        userHasDragged = true; 
        const ps = document.getElementById('presetSelector');
        if(ps) ps.value = 'custom';
        
        saveState(); 
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

canvas2D.addEventListener('mousemove', handlePointerMove); canvas2D.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp); canvas2D.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas2D.addEventListener('touchstart', handlePointerDown); window.addEventListener('touchend', handlePointerUp);

canvas2D.addEventListener('wheel', (e) => {
    if (hoverTarget === 'logo' || dragTarget === 'logo') {
        e.preventDefault(); const slider = document.getElementById('slLogoScale');
        if (slider) {
            slider.value = Math.max(0.2, Math.min(5.0, parseFloat(slider.value) - e.deltaY * 0.002));
            slider.dispatchEvent(new Event('input')); 
        }
    }
}, { passive: false });

// ==========================================
// 🎵 歌詞渲染與音訊狀態連動 
// ==========================================
lyricsInput.addEventListener('input', () => {
    lyricsManager.parse(lyricsInput.value);
    updateWaveformMarkers(); 
});

audioPlayer.addEventListener('timeupdate', () => {
    const timeDisplay = document.getElementById('currentTimeDisplay');
    if (timeDisplay) {
        timeDisplay.innerText = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    updateWaveformMarkers(); 
});

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
    if (!container) return;
    
    container.querySelectorAll('.lyric-marker').forEach(el => el.remove());
    
    if (!audioPlayer || isNaN(audioPlayer.duration) || audioPlayer.duration === 0) return;
    
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

function drawLyrics() {
    let active = "";
    if ((currentMode === 'file' || currentMode === 'dual') && audioPlayer && !audioPlayer.paused) {
        active = lyricsManager.getActiveLyric(audioPlayer.currentTime);
    }
    if (!active && (dragTarget === 'lyrics' || hoverTarget === 'lyrics' || lyricsManager.isSyncing)) {
        active = lyricsManager.parsedLyrics.length > 0 ? window.t('lyric_preview') : window.t('lyric_placeholder');
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
    if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
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
// 🌟 OBS 廣播模式切換
// ==========================================
window.addEventListener('keydown', (e) => { 
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if(lyricsManager.isSyncing && e.code === 'Space') { 
        e.preventDefault(); document.getElementById('btnMarkTime').click(); 
    }
    
    if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        toggleOBSMode();
    }
});

function toggleOBSMode() {
    State.ui.obsMode = !State.ui.obsMode;
    
    const canvasContainer = document.getElementById('visualizer2D').parentElement;
    const leftPanel = document.querySelector('.lg\\:w-4\\/12');
    const nav = document.querySelector('nav');
    const rightPanelControls = document.querySelector('.bg-gray-800\\/90');
    
    if (State.ui.obsMode) {
        let placeholder = document.getElementById('obs-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'obs-placeholder';
            placeholder.className = 'relative w-full aspect-video mb-5';
            canvasContainer.parentNode.insertBefore(placeholder, canvasContainer);
        }
        
        document.body.appendChild(canvasContainer);
        document.body.style.overflow = 'hidden'; 
        
        if(leftPanel) leftPanel.style.display = 'none';
        if(nav) nav.style.display = 'none';
        if(rightPanelControls) {
            Array.from(rightPanelControls.children).forEach(child => {
                if (!child.querySelector('canvas')) child.style.display = 'none';
            });
        }
        
        canvasContainer.style.position = 'fixed';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.width = '100vw';
        canvasContainer.style.height = '100vh';
        canvasContainer.style.zIndex = '99999';
        canvasContainer.style.borderRadius = '0';
        canvasContainer.style.border = 'none';
        canvasContainer.style.margin = '0';
        
        showToast(window.t('msg_obs_mode_on'), "green");
    } else {
        let placeholder = document.getElementById('obs-placeholder');
        if (placeholder) {
            placeholder.parentNode.insertBefore(canvasContainer, placeholder);
            placeholder.remove();
        }
        
        document.body.style.overflow = '';
        
        if(leftPanel) leftPanel.style.display = '';
        if(nav) nav.style.display = 'flex';
        if(rightPanelControls) {
            Array.from(rightPanelControls.children).forEach(child => child.style.display = '');
        }
        
        canvasContainer.style.position = 'relative';
        canvasContainer.style.top = '';
        canvasContainer.style.left = '';
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = 'auto';
        canvasContainer.style.zIndex = '';
        canvasContainer.style.borderRadius = '0.75rem';
        canvasContainer.style.border = '';
        canvasContainer.style.margin = '';
        
        showToast(window.t('msg_obs_mode_off'), "blue");
    }
    setTimeout(() => applyResolution(1920, 1080), 100);
}

function injectOBSButton() {
    if (document.getElementById('btnOBSMode')) return;
    const recordBar = document.getElementById('btnStopRecord').parentElement;
    if (!recordBar) return;
    const obsBtn = document.createElement('button');
    obsBtn.id = 'btnOBSMode';
    obsBtn.title = 'Shift + F';
    obsBtn.className = 'px-3 lg:px-4 py-3 text-sm lg:text-base bg-indigo-700/80 text-white rounded-xl font-bold transition-all shadow-md hover:bg-indigo-600 flex items-center justify-center gap-2 border border-indigo-500';
    obsBtn.innerHTML = `📺 <span class="hidden xl:inline" data-i18n="btn_obs_mode">${window.t('btn_obs_mode') || 'OBS 模式'}</span> <span class="text-xs text-indigo-300 font-normal bg-indigo-900/50 px-1.5 py-0.5 rounded border border-indigo-700">Shift+F</span>`;
    obsBtn.onclick = toggleOBSMode;
    
    const statusDiv = document.getElementById('recordingStatus').parentElement;
    recordBar.insertBefore(obsBtn, statusDiv);
}

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
// 🎥 錄影引擎事件
// ==========================================
btnRecord.addEventListener('click', async () => {
    await audio.resumeContext();

    const success = videoRecorder.start(audio.streamDestination, (videoUrl) => {
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
        if(currentMode === 'file' || currentMode === 'dual') { audioPlayer.currentTime = 0; audioPlayer.play(); }
        document.getElementById('recordingStatus').classList.remove('hidden');
        btnRecord.disabled = true; btnStopRecord.disabled = false;
    }
});

btnStopRecord.addEventListener('click', () => {
    videoRecorder.stop();
    if (currentMode === 'file' || currentMode === 'dual') audioPlayer.pause();
    isDrawing = false;
});

// ==========================================
// 🎚️ 檔案匯入與雙軌混音 UI
// ==========================================
async function handleFileImport(file) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/') && file.type !== "") {
        return alert(window.t('alert_invalid_file'));
    }
    
    try {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        if (fileName.includes(" - ")) {
            const parts = fileName.split(" - ");
            const topicEl = document.getElementById('topicTitle');
            if(topicEl) topicEl.value = parts[1].trim(); 
            State.ui.topicTitle = parts[1].trim();
            const speakerEl = document.getElementById('speakerInfo');
            if(speakerEl) speakerEl.value = `Artist: ${parts[0].trim()}`; 
            State.ui.speakerInfo = `Artist: ${parts[0].trim()}`;
        } else {
            const topicEl = document.getElementById('topicTitle');
            if(topicEl) topicEl.value = fileName; 
            State.ui.topicTitle = fileName;
        }
        recalculateLayoutCache(ctx2D, getScale()); saveState();

        audioPlayer.src = URL.createObjectURL(file); 
        await audio.initBGM(audioPlayer); 
        
        try {
            const waveData = await audio.getStaticWaveform(file);
            drawStaticWaveform(waveData);
            updateWaveformMarkers(); 
        } catch (waveErr) {
            console.warn("Waveform generation skipped:", waveErr);
        }
        
        currentMode = (currentMode === 'mic') ? 'dual' : 'file';
        
        const overlayText = document.getElementById('overlayText'); if(overlayText) overlayText.innerText = window.t('msg_audio_loaded');
        const overlay = document.getElementById('canvasOverlay'); if(overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
        btnRecord.disabled = false; btnRecord.classList.replace('bg-gray-700', 'bg-red-600'); btnRecord.classList.replace('text-gray-400', 'text-white');
        applyResolution(1920, 1080); 
    } catch (e) { 
        console.error("載入失敗詳細錯誤:", e);
        alert(window.t('alert_load_fail') + "\n" + (e.message || "請確認檔案格式是否受支援")); 
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
        applyResolution(1920, 1080); if (!isDrawing) drawLayout();
    } catch(e) { alert(window.t('alert_mic_fail')); }
});

document.getElementById('slVolBGM')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setBGMVolume(val); State.ui.volBGM = val;
    const label = document.getElementById('valVolBGM');
    if(label) label.textContent = val.toFixed(2);
    saveState();
});

document.getElementById('slVolMic')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setMicVolume(val); State.ui.volMic = val;
    const label = document.getElementById('valVolMic');
    if(label) label.textContent = val.toFixed(2);
    saveState();
});

document.getElementById('bgUpload')?.addEventListener('change', function(e) {
    if(this.files.length) {
        const file = this.files[0];
        if (isUnsupportedFormat(file)) {
            alert(window.t('alert_heic_unsupported'));
            this.value = ''; 
            return;
        }

        bgManager.load(file, () => {
            const bgLabel = document.getElementById('bgLabel'); 
            if (bgLabel) bgLabel.innerText = window.t('btn_bg_loaded'); 
            updateButtonVisualState('bgLabel', true);
            
            const bgDimWrapper = document.getElementById('bgDimWrapper');
            if (bgDimWrapper) bgDimWrapper.classList.remove('hidden');
            
            forceRenderFrame();
        });
    }
});

document.getElementById('slBgDim')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    State.ui.bgDim = val;
    const label = document.getElementById('valBgDim');
    if (label) label.textContent = val.toFixed(2);
    saveState();
    forceRenderFrame();
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
            
            if (!isDrawing) { isDrawing = true; drawMasterLoop(); }
            const overlay = document.getElementById('canvasOverlay');
            if (overlay && overlay.style.display !== 'none') {
                overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 300);
            }
        };
        container.appendChild(bar);
    });
}

// 拖放功能
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('bg-blue-900/20'); });
window.addEventListener('dragleave', () => document.body.classList.remove('bg-blue-900/20'));
window.addEventListener('drop', (e) => { 
    e.preventDefault(); 
    document.body.classList.remove('bg-blue-900/20'); 
    if (e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (isUnsupportedFormat(file)) {
             alert(window.t('alert_heic_unsupported'));
             return;
        }
        handleFileImport(file); 
    }
});

// UI 基礎事件
document.getElementById('audioUpload')?.addEventListener('change', (e) => { if(e.target.files.length) handleFileImport(e.target.files[0]); });
document.getElementById('channelLogo')?.addEventListener('change', function(e) {
    if(this.files.length) {
        const file = this.files[0];
        if (isUnsupportedFormat(file)) {
            alert(window.t('alert_heic_unsupported'));
            this.value = ''; 
            return;
        }

        if (currentLogoUrl) URL.revokeObjectURL(currentLogoUrl); 
        currentLogoUrl = URL.createObjectURL(file);
        logoImg.onload = () => { 
            const logoLabel = document.getElementById('logoLabel'); 
            if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded'); 
            updateButtonVisualState('logoLabel', true);
            
            const scaleWrapper = document.getElementById('logoScaleWrapper'); 
            if (scaleWrapper) scaleWrapper.classList.remove('hidden');
            forceRenderFrame(); 
        };
        logoImg.src = currentLogoUrl;
    }
});

document.getElementById('resSelector')?.addEventListener('change', (e) => { 
    const mobileSel = document.getElementById('resSelectorMobile');
    if(mobileSel) mobileSel.value = e.target.value; 
    applyResolution(...e.target.value.split('x').map(Number)); 
});
document.getElementById('resSelectorMobile')?.addEventListener('change', (e) => { 
    const deskSel = document.getElementById('resSelector');
    if(deskSel) deskSel.value = e.target.value; 
    applyResolution(...e.target.value.split('x').map(Number)); 
});
document.getElementById('btnCloseResult')?.addEventListener('click', () => { 
    const modal = document.getElementById('resultModal');
    if(modal){
        modal.classList.add('hidden'); 
        modal.classList.remove('flex'); 
    }
});

document.getElementById('presetSelector')?.addEventListener('change', (e) => applyPreset(e.target.value));

['channelName', 'topicTitle', 'speakerInfo'].forEach(id => { 
    document.getElementById(id)?.addEventListener('input', (e) => {
        State.ui[id] = e.target.value;
        recalculateLayoutCache(ctx2D, getScale());
        saveState(); forceRenderFrame();
    }); 
});

document.getElementById('slLogoScale')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value); State.ui.logoScale = val;
    const label = document.getElementById('valLogoScale'); if(label) label.textContent = val.toFixed(1) + 'x';
    saveState(); forceRenderFrame();
});

document.getElementById('chkA11y')?.addEventListener('change', (e) => { State.ui.isA11y = e.target.checked; saveState(); forceRenderFrame(); });

document.getElementById('btnToggleSync')?.addEventListener('click', () => {
    const panel = document.getElementById('syncToolPanel'); 
    if(panel) panel.classList.toggle('hidden');
    if (panel && panel.classList.contains('hidden')) {
        lyricsManager.stopSync();
        const btnSync = document.getElementById('btnStartSync');
        if(btnSync) btnSync.innerHTML = window.t('btn_sync_start');
        const btnMark = document.getElementById('btnMarkTime');
        if(btnMark) btnMark.disabled = true;
        const currentLine = document.getElementById('currentSyncLine');
        if(currentLine) currentLine.innerText = window.t('sync_end');
    }
});

function showToast(msg, color="blue") {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 right-6 bg-gray-900/95 backdrop-blur-md border border-${color}-500/50 text-${color}-300 px-5 py-4 rounded-xl text-sm shadow-2xl z-[10000] flex items-center gap-4 transform transition-all duration-500 translate-y-[-20px] opacity-0`;
    toast.innerHTML = `<span class="text-xl">✨</span> <p class="font-bold">${msg}</p>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { setTimeout(() => { toast.classList.remove('translate-y-[-20px]', 'opacity-0'); }, 50); });
    setTimeout(() => {
        if(document.body.contains(toast)) {
            toast.classList.add('translate-y-[-20px]', 'opacity-0');
            setTimeout(() => { if(document.body.contains(toast)) toast.remove(); }, 500);
        }
    }, 3000);
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

// ==========================================
// 🌐 語言選單自動生成與更新引擎
// ==========================================
document.getElementById('langSelect')?.addEventListener('change', (e) => updateLanguage(e.target.value));

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
    
    if (currentMode === 'file') {
        const oText = document.getElementById('overlayText');
        if(oText) oText.innerText = window.t('msg_audio_loaded');
    }
    else if (currentMode === 'mic') {
        const oText = document.getElementById('overlayText');
        if(oText) oText.innerText = window.t('msg_mic_ready');
    }
    
    if (logoImg.src && logoImg.complete) { 
        const logoLabel = document.getElementById('logoLabel');
        if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded');
        updateButtonVisualState('logoLabel', true);
    }
    if (bgManager && bgManager.media) { 
        const bgLabel = document.getElementById('bgLabel');
        if(bgLabel) bgLabel.innerText = window.t('btn_bg_loaded'); 
        updateButtonVisualState('bgLabel', true);
        
        const bgDimWrapper = document.getElementById('bgDimWrapper');
        if (bgDimWrapper) bgDimWrapper.classList.remove('hidden');
    }
    
    initVfxToggles();
    buildDynamicUI();
    
    const syncLine = document.getElementById('currentSyncLine');
    if (syncLine) {
        const btnStartSync = document.getElementById('btnStartSync');
        if (lyricsManager.isSyncing) {
            if(btnStartSync) btnStartSync.innerHTML = window.t('btn_sync_pause');
        }
        else if (lyricsManager.syncIndex > 0 && lyricsManager.syncIndex < lyricsManager.rawLines.length) { 
            if(btnStartSync) btnStartSync.innerHTML = window.t('btn_sync_restart'); 
            syncLine.innerText = lyricsManager.rawLines[lyricsManager.syncIndex]; 
        }
        else if (lyricsManager.syncIndex >= lyricsManager.rawLines.length && lyricsManager.rawLines.length > 0) {
            syncLine.innerHTML = `<span class="text-green-400">${window.t('sync_done')}</span>`;
        }
        else { 
            if(btnStartSync) btnStartSync.innerHTML = window.t('btn_sync_start'); 
            syncLine.innerText = window.t('sync_init'); 
        }
    }
    
    // 更新 Preset 選單文字
    const presetSelect = document.getElementById('presetSelector');
    if (presetSelect) {
        Array.from(presetSelect.options).forEach(opt => {
            const i18nKey = opt.getAttribute('data-i18n');
            if (i18nKey && dict[i18nKey]) opt.text = dict[i18nKey];
        });
    }

    forceRenderFrame();
}

function initSystem() {
    upgradeUIToMultiLayer(); 
    setup3D();
    initLanguageSelect(); 
    injectOBSButton(); 
    updateLanguage(localStorage.getItem('preferredLang') || 'zh-TW');
    loadState(); 
    initVfxToggles();
    buildDynamicUI(); 
    setTimeout(() => applyResolution(1920, 1080), 500);
    setTimeout(() => { showPrivacyToast(); }, 1000); 
    initESGMode();
}

initSystem();
document.addEventListener("visibilitychange", () => { if (rm) rm.isActive = !document.hidden; });