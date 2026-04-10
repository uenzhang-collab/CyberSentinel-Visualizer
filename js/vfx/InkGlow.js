/**
 * CyberSentinel - 墨暈流光 (Ink & Glow) 特效模組
 * 專為 Acoustic、民謠、純人聲設計，提取中高頻段 (300Hz-3000Hz)
 * 模擬水彩與墨水在水中緩慢渲染、交疊的唯美效果。
 */

let drops = [];

export function renderInkGlow(ctx, canvas, dataArray, scale, safePulse, isA11y, config) {
    // 1. 中高頻段拾取 (Vocal & Acoustic Range)
    // 假設採樣率 44100Hz，FFT Size 2048 -> 每一個 bin 約 21.5Hz
    // 取 bin 14 (~300Hz) 到 bin 140 (~3000Hz)
    let vocalSum = 0;
    let count = 0;
    for (let i = 14; i < 140 && i < dataArray.length; i++) {
        vocalSum += dataArray[i];
        count++;
    }
    const vocalAvg = count > 0 ? vocalSum / count : 0;
    
    // 過濾底噪，確保有明顯聲音時才觸發 (使用較緩和的三次方放大)
    const vocalPulse = vocalAvg > 20 ? Math.pow(vocalAvg / 255, 1.5) : 0;

    // 2. 讀取使用者設定參數
    const spreadMult = config.spreadMult || 1.0;
    const colorFlow = config.colorFlow || 1.0;
    const persistence = config.persistence || 0.9;

    // 3. 水滴生成邏輯 (Spawn Logic)
    // 當中高頻能量達到門檻時，隨機生成新墨滴
    if (vocalPulse > 0.1 && Math.random() < 0.35) {
        // 色彩流動：隨時間推移產生浪漫的色相偏移 (以暖色/琥珀/紫紅為主)
        const timeHue = (Date.now() * 0.02 * colorFlow) % 360;
        const baseHue = (40 + timeHue) % 360; 

        drops.push({
            // 隨機分佈在畫面中下/中央區域
            x: canvas.width * 0.2 + Math.random() * canvas.width * 0.6,
            y: canvas.height * 0.2 + Math.random() * canvas.height * 0.6,
            radius: 5 * scale, // 初始大小
            maxRadius: (200 + Math.random() * 400) * scale * spreadMult, // 最終擴散大小
            life: 1.0, // 生命週期
            // 衰減速度由 persistence 反向控制
            decay: (0.003 + Math.random() * 0.005) * ((1.0 - persistence) * 10 + 0.1), 
            hue: (baseHue + (Math.random() - 0.5) * 40 + 360) % 360 // 讓顏色有些微隨機性
        });
    }

    // 4. 渲染邏輯 (使用螢幕混色創造發光感)
    ctx.globalCompositeOperation = 'screen';

    for (let i = drops.length - 1; i >= 0; i--) {
        let drop = drops[i];
        
        // 物理擴散
        drop.radius += (drop.maxRadius - drop.radius) * 0.015 * spreadMult;
        // 生命週期衰減
        drop.life -= drop.decay;
        
        if (drop.life <= 0) {
            drops.splice(i, 1); // 刪除死去的墨滴
            continue;
        }

        // 動態 Alpha 值：隨生命週期漸隱，並在當前音樂強烈時些微增亮
        const alpha = Math.max(0, drop.life) * (0.5 + vocalPulse * 0.5);
        // 當下音樂強時，墨滴會稍微膨脹呼吸
        const currentRadius = drop.radius * (1 + vocalPulse * 0.15);

        // 建立唯美的放射狀水彩漸層
        const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, currentRadius);
        
        if (isA11y) {
            // 視覺保護模式：降低亮烈度
            gradient.addColorStop(0, `hsla(${drop.hue}, 60%, 50%, ${alpha * 0.7})`);
            gradient.addColorStop(0.4, `hsla(${drop.hue - 15}, 70%, 40%, ${alpha * 0.4})`);
            gradient.addColorStop(1, `hsla(${drop.hue - 30}, 80%, 10%, 0)`);
        } else {
            gradient.addColorStop(0, `hsla(${drop.hue}, 80%, 70%, ${alpha})`);
            gradient.addColorStop(0.3, `hsla(${drop.hue - 15}, 90%, 50%, ${alpha * 0.6})`);
            gradient.addColorStop(1, `hsla(${drop.hue - 30}, 100%, 10%, 0)`);
        }

        ctx.beginPath();
        ctx.arc(drop.x, drop.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}