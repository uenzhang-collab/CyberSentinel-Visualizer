/**
 * CyberSentinel - 幻夜光斑 (Cinematic Bokeh) 特效模組
 * 專為都市抒情流行風 (Urban Pop) 設計。
 * 模擬夜間城市霓虹燈的失焦光暈，並隨著重低音脈衝 (Bass) 產生呼吸膨脹與亮度閃爍。
 */

let bokehs = [];

export function renderBokeh(ctx, canvas, dataArray, scale, safePulse, isA11y, config) {
    const targetCount = config.count || 30;
    const speedMult = config.speedMult || 1.0;
    const glowMult = config.glowMult || 1.0;

    // 1. 維持光斑數量池 (Pool Management)
    while (bokehs.length < targetCount) {
        bokehs.push(spawnBokeh(canvas, scale, true));
    }
    while (bokehs.length > targetCount) {
        bokehs.pop();
    }

    // 2. 渲染邏輯
    ctx.globalCompositeOperation = 'screen';

    for (let i = bokehs.length - 1; i >= 0; i--) {
        let b = bokehs[i];
        
        // 物理漂浮移動 (緩慢向上與側向漂移)
        b.y -= b.speedY * speedMult;
        b.x += Math.sin(b.y * 0.01 + b.seed) * 0.5 * speedMult * scale;
        
        // 生命週期衰減
        b.life -= b.decay * speedMult;

        // 如果飄出螢幕或生命週期結束，重生
        if (b.y < -b.radius || b.life <= 0) {
            bokehs[i] = spawnBokeh(canvas, scale, false);
            b = bokehs[i];
        }

        // 動態 Alpha 值：淡入淡出
        let alpha = 0;
        if (b.life > 0.8) alpha = (1.0 - b.life) * 5; // Fade in
        else if (b.life < 0.2) alpha = b.life * 5;    // Fade out
        else alpha = 1.0;                             // Sustain

        // 🎵 音頻聯動：重低音脈衝會讓光斑爆亮與膨脹
        const currentAlpha = Math.min(1.0, alpha * (b.baseAlpha + safePulse * 0.8 * glowMult));
        const currentRadius = b.radius * (1 + safePulse * 0.4);

        // 繪製電影級失焦光暈
        const gradient = ctx.createRadialGradient(b.x, b.y, currentRadius * 0.2, b.x, b.y, currentRadius);
        
        if (isA11y) {
            // 視覺保護模式：降低刺眼度
            gradient.addColorStop(0, `hsla(${b.hue}, 70%, 60%, ${currentAlpha * 0.5})`);
            gradient.addColorStop(0.8, `hsla(${b.hue}, 80%, 40%, ${currentAlpha * 0.2})`);
            gradient.addColorStop(1, `hsla(${b.hue}, 100%, 10%, 0)`);
        } else {
            // 正常模式：充滿都市霓虹感
            gradient.addColorStop(0, `hsla(${b.hue}, 90%, 80%, ${currentAlpha})`);
            gradient.addColorStop(0.6, `hsla(${b.hue}, 100%, 60%, ${currentAlpha * 0.5})`);
            gradient.addColorStop(1, `hsla(${b.hue}, 100%, 20%, 0)`);
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

function spawnBokeh(canvas, scale, isInitial) {
    // 都市霓虹色系：賽博紫、霓虹藍、暖橘、路燈黃
    const urbanHues = [280, 220, 30, 45, 320]; 
    const hue = urbanHues[Math.floor(Math.random() * urbanHues.length)] + (Math.random() * 20 - 10);

    return {
        x: Math.random() * canvas.width,
        y: isInitial ? Math.random() * canvas.height : canvas.height + 100 * scale,
        radius: (20 + Math.random() * 80) * scale,
        baseAlpha: 0.15 + Math.random() * 0.4,
        speedY: (0.5 + Math.random() * 1.5) * scale,
        life: 1.0,
        decay: 0.001 + Math.random() * 0.002,
        hue: hue,
        seed: Math.random() * 100
    };
}