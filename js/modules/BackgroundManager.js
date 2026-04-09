/**
 * CyberSentinel - Background Manager (Audio-Reactive Edition)
 * 負責處理自訂的靜態圖片或動態影片背景渲染，並支援隨著音樂重低音產生呼吸縮放與閃爍。
 */
export class BackgroundManager {
    constructor() {
        this.media = null;
        this.type = null; 
        this.opacity = 0.85; // 預設稍微壓暗，讓前景光譜更明顯
    }

    load(file, onLoadedCallback) {
        if (this.type === 'video' && this.media) {
            this.media.pause();
            this.media.src = "";
        }
        
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            this.type = 'video';
            this.media = document.createElement('video');
            this.media.src = url;
            this.media.loop = true;
            this.media.muted = true; 
            this.media.play();
            if (onLoadedCallback) this.media.onloadeddata = onLoadedCallback;
        } else {
            this.type = 'image';
            this.media = new Image();
            this.media.src = url;
            if (onLoadedCallback) this.media.onload = onLoadedCallback;
        }
    }

    setOpacity(val) {
        this.opacity = val;
    }

    // 🌟 新增 pulse 參數，接收來自 AudioEngine 的心跳脈衝
    draw(ctx, width, height, pulse = 0) {
        if (!this.media) return;

        ctx.save();
        
        // 🫀 1. 音頻聯動縮放 (Audio-Reactive Scale)
        // 隨著重低音脈衝，背景會產生最大 6% 的放大呼吸感
        const scale = 1 + (pulse * 0.06); 
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);

        // 繪製媒體
        if (this.type === 'video' && this.media.readyState >= 2) {
            ctx.drawImage(this.media, 0, 0, width, height);
        } else if (this.type === 'image' && this.media.complete) {
            ctx.drawImage(this.media, 0, 0, width, height);
        }

        // 🫀 2. 音頻聯動明暗 (Audio-Reactive Brightness)
        // 基礎有暗色遮罩，當重低音打下時，遮罩會瞬間變薄(變亮)，產生閃爍感
        const dynamicOpacity = Math.max(0.1, this.opacity - (pulse * 0.4));
        ctx.fillStyle = `rgba(0, 0, 0, ${dynamicOpacity})`;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }
}