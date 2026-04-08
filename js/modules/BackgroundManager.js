/**
 * CyberSentinel - Background Manager
 * 負責處理自訂的靜態圖片或動態影片背景渲染，支援 Lo-Fi 房間等沉浸式場景。
 */
export class BackgroundManager {
    constructor() {
        this.media = null;
        this.type = null; // 'image' 或 'video'
        this.opacity = 0.8; // 預設稍微壓暗，讓前景光譜更明顯
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
            this.media.muted = true; // 影片背景強制靜音，聲音交由 AudioEngine 處理
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

    draw(ctx, width, height) {
        if (!this.media) return;

        // 1. 繪製背景媒體
        if (this.type === 'video' && this.media.readyState >= 2) {
            ctx.drawImage(this.media, 0, 0, width, height);
        } else if (this.type === 'image' && this.media.complete) {
            ctx.drawImage(this.media, 0, 0, width, height);
        }

        // 2. 加上暗色遮罩 (確保前景的光譜與文字清晰可見)
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - this.opacity})`;
        ctx.fillRect(0, 0, width, height);
    }
}