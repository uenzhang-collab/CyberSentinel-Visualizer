/**
 * CyberSentinel - 復古幻波網格 (Retro Synth Grid) 特效模組
 * 專為 City Pop, Indie Pop, Synthwave 打造。
 * 呈現 80 年代復古未來主義的霓虹落日與穿梭網格，並與重低音脈衝聯動產生音波地形。
 */

export function renderRetroGrid(ctx, canvas, dataArray, scale, safePulse, isA11y, config) {
    const speedMult = config.speedMult || 1.0;
    const glowMult = config.glowMult || 1.0;
    const terrainHeight = config.terrainHeight || 1.0;

    const w = canvas.width;
    const h = canvas.height;
    const horizon = h * 0.55; // 地平線位置
    const fov = 200 * scale;  // 透視視野

    // ==========================================
    // 1. 繪製復古掃描線夕陽 (Retro Sun)
    // ==========================================
    ctx.save();
    const sunX = w / 2;
    const sunY = horizon;
    const sunRadius = 250 * scale * (1 + safePulse * 0.15); // 夕陽隨著重低音脈動放大

    // 夕陽發光效果
    if (isA11y) {
        ctx.shadowColor = `hsla(330, 80%, 40%, ${0.5 * glowMult})`;
        ctx.shadowBlur = 30 * scale * glowMult;
    } else {
        ctx.shadowColor = `hsla(330, 100%, 60%, ${0.8 * glowMult})`;
        ctx.shadowBlur = 80 * scale * glowMult * (1 + safePulse);
    }

    // 暖色漸層：上半部金黃，下半部洋紅
    const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY);
    sunGrad.addColorStop(0, `hsla(45, 100%, 60%, 1)`);  
    sunGrad.addColorStop(1, `hsla(330, 100%, 50%, 1)`); 
    ctx.fillStyle = sunGrad;

    ctx.beginPath();
    // 只畫地平線以上的半圓
    ctx.arc(sunX, sunY, sunRadius, Math.PI, 0); 
    ctx.fill();

    // 使用 destination-out 挖空掃描線，透出底部的背景或黑色
    ctx.globalCompositeOperation = 'destination-out';
    ctx.shadowBlur = 0;
    
    const time = Date.now() * 0.001 * speedMult;
    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
        // 讓線條呈現往下掉落的動畫
        let progress = (time * 0.4 + i / numLines) % 1.0; 
        
        // 加上次方，讓線條在接近底部時變粗、變密，模擬透視感
        let yOffset = Math.pow(progress, 1.5) * sunRadius;
        let thickness = Math.pow(progress, 2) * 16 * scale + 2 * scale;
        
        ctx.fillRect(sunX - sunRadius, sunY - yOffset - thickness, sunRadius * 2, thickness);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ==========================================
    // 2. 繪製 3D 音波起伏網格 (Audio-Reactive Terrain Grid)
    // ==========================================
    ctx.save();
    
    // 裁切網格，確保只在地平線以下繪製
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();

    // 網格底部的漸層暗色大地
    const groundGrad = ctx.createLinearGradient(0, horizon, 0, h);
    groundGrad.addColorStop(0, 'rgba(20, 5, 30, 0.95)');
    groundGrad.addColorStop(1, 'rgba(5, 0, 10, 1)');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizon, w, h - horizon);

    // 網格線條樣式
    ctx.lineWidth = (isA11y ? 2 : 3) * scale;
    ctx.strokeStyle = `hsla(300, 100%, 60%, ${0.8 * glowMult})`;
    ctx.shadowColor = `hsla(300, 100%, 70%, 1)`;
    ctx.shadowBlur = (isA11y ? 5 : 15) * scale * glowMult * (1 + safePulse * 0.5);

    const gridZ = 15; // Z軸間距
    const speed = (Date.now() * 0.06 * speedMult) % gridZ;

    // 繪製水平線 (Z軸深度)，並結合音樂頻率產生 Y軸的地形起伏
    ctx.beginPath();
    for (let z = 0; z < 35; z++) {
        let actualZ = z * gridZ - speed + 1; // +1 防止除以 0
        if (actualZ < 1) continue;
        
        // 3D 轉 2D 透視投影
        let y = horizon + (fov / actualZ) * 80 * scale;
        if (y > h * 1.5) continue;

        // 音頻地形起伏 (Terrain Bump)：根據深淺映射不同的音頻區塊
        // 近處對應低頻，遠處對應高頻
        let audioIdx = Math.floor((z / 35) * (dataArray.length * 0.3));
        let val = dataArray[audioIdx] || 0;
        
        // 近處起伏大，遠處起伏小
        let bump = (val / 255) * 80 * scale * terrainHeight / Math.max(1, actualZ * 0.15);

        ctx.moveTo(0, y - bump);
        ctx.lineTo(w, y - bump);
    }
    ctx.stroke();

    // 繪製垂直線 (X軸透視)
    ctx.beginPath();
    const numVerticalLines = 30;
    for (let i = -numVerticalLines; i <= numVerticalLines; i++) {
        let xTop = w/2 + i * 25 * scale;
        let xBot = w/2 + i * 350 * scale; // 越到底部越開展，形成透視
        ctx.moveTo(xTop, horizon);
        ctx.lineTo(xBot, h * 1.5); 
    }
    ctx.stroke();

    ctx.restore();
}