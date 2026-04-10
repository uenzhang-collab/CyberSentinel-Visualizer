/**
 * CyberSentinel - UI Manager
 * 負責所有 DOM 介面操作：動態拉桿生成、多國語系切換、大師風格套用、OBS 模式以及通知彈窗。
 */
import { State, stateManager } from './StateManager.js';
import { ThemePresets, vfxOptionsList, VFXSchemas } from './ThemeManager.js';
import { translations } from '../i18n.js';

export class UIManager {
    constructor(coreHooks) {
        this.core = coreHooks; // 注入來自 main.js 的依賴方法與物件
        
        // 將多國語言翻譯方法綁定到全域
        window.t = function(key) {
            const lang = localStorage.getItem('preferredLang') || 'zh-TW';
            return translations[lang] && translations[lang][key] ? translations[lang][key] : key;
        };
    }

    syncUIToState() {
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

    updateButtonVisualState(labelId, isLoaded) {
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

    isUnsupportedFormat(file) {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.heic') || fileName.endsWith('.heif');
    }

    applyPreset(presetName) {
        if (presetName === 'custom') return;
        const preset = ThemePresets[presetName]; 
        if (!preset) return;

        State.activeVFX = [...preset.activeVFX];
        preset.activeVFX.forEach(id => {
            if (preset.vfxState[id]) State.vfx[id] = { ...State.vfx[id], ...preset.vfxState[id] };
        });
        if (preset.layout) {
            State.layoutOffsets = { ...State.layoutOffsets, ...preset.layout };
            this.core.setUserHasDragged(true);
        }
        
        this.initVfxToggles();
        this.buildDynamicUI();
        this.core.recalculateLayoutCache();
        stateManager.save();
        this.core.forceRenderFrame();
    }

    upgradeUIToMultiLayer() {
        const oldSelector = document.getElementById('vfxSelector');
        if (oldSelector && oldSelector.tagName === 'SELECT') {
            const parent = oldSelector.parentElement;
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'flex justify-between items-center mb-2 border-b border-gray-700 pb-1';
            
            headerDiv.innerHTML = `
                <span class="text-xs text-gray-400" data-i18n="lbl_active_vfx">${window.t('lbl_active_vfx')}</span>
                <div class="flex items-center gap-3">
                    <label class="text-xs text-purple-400 flex items-center gap-1 cursor-pointer" title="重低音爆發時自動開啟運鏡與增強特效">
                        <input type="checkbox" id="chkAutoVJ" class="rounded text-purple-600 focus:ring-purple-500" ${State.ui.autoVJ ? 'checked' : ''}>
                        <span data-i18n="lbl_auto_vj">${window.t('lbl_auto_vj')}</span>
                    </label>
                    <label class="text-xs text-blue-400 flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" id="chkCameraShake" class="rounded text-blue-600 focus:ring-blue-500" ${State.ui.cameraShake ? 'checked' : ''}>
                        <span data-i18n="lbl_camera_shake">${window.t('lbl_camera_shake')}</span>
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
                stateManager.save();
            });

            document.getElementById('chkAutoVJ')?.addEventListener('change', (e) => {
                State.ui.autoVJ = e.target.checked;
                stateManager.save();
            });
        }
    }

    initVfxToggles() {
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
                this.initVfxToggles();
                this.buildDynamicUI();
                stateManager.save();
                this.core.forceRenderFrame();
            };
            container.appendChild(btn);
        });
    }

    buildDynamicUI() {
        const container = document.getElementById('dynamicVfxContainer');
        if (!container) return;
        container.innerHTML = '';
        
        State.activeVFX.forEach(vfxKey => {
            const schema = VFXSchemas[vfxKey] || []; 
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
                        stateManager.save(); this.core.forceRenderFrame();
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
                        stateManager.save(); this.core.forceRenderFrame();
                    });
                    wrap.appendChild(head); wrap.appendChild(range); container.appendChild(wrap);
                }
            });
            if (chkContainer.childNodes.length > 0) container.appendChild(chkContainer);
        });
    }

    async initESGMode() {
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

    toggleOBSMode() {
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
            
            this.showToast(window.t('msg_obs_mode_on'), "green");
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
            
            this.showToast(window.t('msg_obs_mode_off'), "blue");
        }
        setTimeout(() => this.core.applyResolution(1920, 1080), 100);
    }

    injectOBSButton() {
        if (document.getElementById('btnOBSMode')) return;
        const recordBar = document.getElementById('btnStopRecord').parentElement;
        if (!recordBar) return;
        const obsBtn = document.createElement('button');
        obsBtn.id = 'btnOBSMode';
        obsBtn.title = 'Shift + F';
        obsBtn.className = 'px-3 lg:px-4 py-3 text-sm lg:text-base bg-indigo-700/80 text-white rounded-xl font-bold transition-all shadow-md hover:bg-indigo-600 flex items-center justify-center gap-2 border border-indigo-500';
        obsBtn.innerHTML = `📺 <span class="hidden xl:inline" data-i18n="btn_obs_mode">${window.t('btn_obs_mode')}</span> <span class="text-xs text-indigo-300 font-normal bg-indigo-900/50 px-1.5 py-0.5 rounded border border-indigo-700">Shift+F</span>`;
        obsBtn.onclick = () => this.toggleOBSMode();
        
        const statusDiv = document.getElementById('recordingStatus').parentElement;
        recordBar.insertBefore(obsBtn, statusDiv);
    }

    showToast(msg, color="blue") {
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

    showPrivacyToast() {
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

    initLanguageSelect() {
        const langNames = { "en-US": "English", "zh-TW": "繁體中文", "zh-CN": "简体中文", "es-ES": "Español", "ja-JP": "日本語", "de-DE": "Deutsch", "fr-FR": "Français", "ko-KR": "한국어" };
        const langSelect = document.getElementById('langSelect'); if (!langSelect) return;
        langSelect.innerHTML = '';
        for (const [code, name] of Object.entries(langNames)) {
            if (translations[code]) { const opt = document.createElement('option'); opt.value = code; opt.textContent = name; langSelect.appendChild(opt); }
        }
        langSelect.value = localStorage.getItem('preferredLang') || 'zh-TW';
        
        langSelect.addEventListener('change', (e) => this.updateLanguage(e.target.value));
    }

    updateLanguage(lang) {
        const dict = translations[lang] || translations['en-US']; if (!dict) return;
        document.querySelectorAll('[data-i18n]').forEach(el => el.innerHTML = dict[el.getAttribute('data-i18n')] || el.innerHTML);
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = dict[el.getAttribute('data-i18n-placeholder')] || el.placeholder);
        localStorage.setItem('preferredLang', lang);
        
        if (this.core.getCurrentMode() === 'file') {
            const oText = document.getElementById('overlayText');
            if(oText) oText.innerText = window.t('msg_audio_loaded');
        }
        else if (this.core.getCurrentMode() === 'mic') {
            const oText = document.getElementById('overlayText');
            if(oText) oText.innerText = window.t('msg_mic_ready');
        }
        
        const logoImg = this.core.getLogoImg();
        if (logoImg && logoImg.src && logoImg.complete) { 
            const logoLabel = document.getElementById('logoLabel');
            if (logoLabel) logoLabel.innerText = window.t('btn_logo_loaded');
            this.updateButtonVisualState('logoLabel', true);
        }
        
        const bgManager = this.core.getBgManager();
        if (bgManager && bgManager.media) { 
            const bgLabel = document.getElementById('bgLabel');
            if(bgLabel) bgLabel.innerText = window.t('btn_bg_loaded'); 
            this.updateButtonVisualState('bgLabel', true);
            
            const bgDimWrapper = document.getElementById('bgDimWrapper');
            if (bgDimWrapper) bgDimWrapper.classList.remove('hidden');
        }
        
        this.initVfxToggles();
        this.buildDynamicUI();
        
        const syncLine = document.getElementById('currentSyncLine');
        const lyricsManager = this.core.getLyricsManager();
        if (syncLine && lyricsManager) {
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
        
        const presetSelect = document.getElementById('presetSelector');
        if (presetSelect) {
            Array.from(presetSelect.options).forEach(opt => {
                const i18nKey = opt.getAttribute('data-i18n');
                if (i18nKey && dict[i18nKey]) opt.text = dict[i18nKey];
            });
        }

        this.core.forceRenderFrame();
    }
}