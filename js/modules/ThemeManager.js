/**
 * CyberSentinel - Theme & Configuration Manager
 * 負責管理「一鍵大師風格 (Presets)」、「特效選單列表」以及「特效參數拉桿配置 (Schema)」。
 * 未來要新增特效或新風格，只需要修改此檔案即可，實現設定與邏輯分離。
 */

export const ThemePresets = {
    acoustic: { 
        activeVFX: ['ink', 'particle'], 
        vfxState: { ink: { spreadMult: 1.2, colorFlow: 0.8, persistence: 0.95 }, particle: { amountMult: 0.3, speedMult: 0.5 } }, 
        layout: { titles: { px: 0.50, py: 0.40 }, lyrics: { px: 0.50, py: 0.80 }, vfx: { px: 0.50, py: 0.50 } } 
    },
    urban: { 
        activeVFX: ['waveform', 'bokeh'], 
        vfxState: { waveform: { ampMult: 1.2, colorMult: 1.5, glowMult: 1.8, thick: 6 }, bokeh: { count: 40, speedMult: 0.8, glowMult: 1.2 } }, 
        layout: { titles: { px: 0.50, py: 0.16 }, lyrics: { px: 0.50, py: 0.90 }, vfx: { px: 0.50, py: 0.50 } } 
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
    }
};

export const vfxOptionsList = [
    { id: 'aurora', icon: '🌌', label: 'vfx_opt_aurora' },
    { id: 'nebula', icon: '🧬', label: 'vfx_opt_nebula' },
    { id: 'ink', icon: '🖌️', label: 'vfx_opt_ink' }, 
    { id: 'bokeh', icon: '🎇', label: 'vfx_opt_bokeh' }, 
    { id: 'particle', icon: '☄️', label: 'vfx_opt_particle' },
    { id: 'circular', icon: '💿', label: 'vfx_opt_circular' },
    { id: 'eq', icon: '🎚️', label: 'vfx_opt_eq' },
    { id: 'waveform', icon: '🌊', label: 'vfx_opt_waveform' }
];

export const VFXSchemas = {
    aurora: [
        { id: 'showAurora', type: 'checkbox', label: 'vfx_mod_aurora' },
        { id: 'showSun', type: 'checkbox', label: 'vfx_mod_sun' },
        { id: 'transmission', type: 'range', label: 'vfx_transmission', min: 0, max: 1, step: 0.05 },
        { id: 'rotSpeed', type: 'range', label: 'vfx_speed', min: -1, max: 5, step: 0.05 }
    ],
    nebula: [
        { id: 'viscosity', type: 'range', label: 'vfx_n_viscosity', min: 0.05, max: 1.0, step: 0.05 },
        { id: 'colorFlow', type: 'range', label: 'vfx_n_color', min: 0, max: 3.0, step: 0.1 }
    ],
    ink: [
        { id: 'spreadMult', type: 'range', label: 'vfx_i_spread', min: 0.1, max: 3.0, step: 0.1 },
        { id: 'colorFlow', type: 'range', label: 'vfx_i_color', min: 0.0, max: 3.0, step: 0.1 },
        { id: 'persistence', type: 'range', label: 'vfx_i_persist', min: 0.1, max: 0.99, step: 0.01 }
    ],
    bokeh: [
        { id: 'count', type: 'range', label: 'vfx_b_count', min: 10, max: 100, step: 1, isInt: true },
        { id: 'speedMult', type: 'range', label: 'vfx_b_speed', min: 0.1, max: 3.0, step: 0.1 },
        { id: 'glowMult', type: 'range', label: 'vfx_b_glow', min: 0.1, max: 3.0, step: 0.1 }
    ],
    particle: [
        { id: 'amountMult', type: 'range', label: 'vfx_p_amount', min: 0.1, max: 4.0, step: 0.1 },
        { id: 'speedMult', type: 'range', label: 'vfx_p_speed', min: 0.5, max: 3.0, step: 0.1 }
    ],
    circular: [
        { id: 'count', type: 'range', label: 'vfx_c_count', min: 60, max: 720, step: 2, isInt: true },
        { id: 'ampMult', type: 'range', label: 'vfx_c_amp', min: 0.5, max: 3.0, step: 0.1 },
        { id: 'colorMult', type: 'range', label: 'vfx_c_color', min: 0, max: 5.0, step: 0.1 },
        { id: 'spinMult', type: 'range', label: 'vfx_c_spin', min: 0, max: 3.0, step: 0.1 }
    ],
    eq: [
        { id: 'count', type: 'range', label: 'vfx_e_count', min: 32, max: 256, step: 4, isInt: true },
        { id: 'ampMult', type: 'range', label: 'vfx_e_amp', min: 0.5, max: 3.0, step: 0.1 },
        { id: 'colorMult', type: 'range', label: 'vfx_e_color', min: 0, max: 5.0, step: 0.1 },
        { id: 'gravityMult', type: 'range', label: 'vfx_e_gravity', min: 0.1, max: 3.0, step: 0.1 }
    ],
    waveform: [
        { id: 'ampMult', type: 'range', label: 'vfx_w_amp', min: 0.5, max: 3.0, step: 0.1 },
        { id: 'colorMult', type: 'range', label: 'vfx_w_color', min: 0, max: 5.0, step: 0.1 },
        { id: 'glowMult', type: 'range', label: 'vfx_w_glow', min: 0, max: 3.0, step: 0.1 },
        { id: 'thick', type: 'range', label: 'vfx_w_thick', min: 1, max: 15, step: 1, isInt: true }
    ]
};