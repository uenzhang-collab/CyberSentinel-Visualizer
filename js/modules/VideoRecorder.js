/**
 * CyberSentinel - Video Recorder Module
 * 負責處理 Canvas 影像擷取、音源混合、MediaRecorder 控制以及 IndexedDB 防呆暫存。
 */
export class VideoRecorder {
    constructor(canvas2D) {
        this.canvas2D = canvas2D;
        this.mediaRecorder = null;
        this.recordedChunks = [];
    }

    // 🛡️ 安全機制：將錄影資料存入 IndexedDB
    async cacheVideoRecord(blob) {
        const DB_NAME = "CS_Video_Cache";
        return new Promise((resolve) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore("records");
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const transaction = db.transaction("records", "readwrite");
                const store = transaction.objectStore("records");
                store.put(blob, "latest_session");
                transaction.oncomplete = () => {
                    console.log("[CyberSentinel] 影片已安全暫存至 IndexedDB");
                    resolve();
                };
                transaction.onerror = (err) => {
                    console.error("[CyberSentinel] IndexedDB 寫入失敗", err);
                    resolve(); 
                };
            };
            request.onerror = (e) => {
                console.error("[CyberSentinel] 無法開啟 IndexedDB", e);
                resolve(); 
            };
        });
    }

    start(streamDestination, onStopCallback, onErrorCallback) {
        this.recordedChunks = [];
        const canvasStream = this.canvas2D.captureStream(30);
        
        // 防呆：確保 Canvas 有畫面串流
        if (!canvasStream || canvasStream.getTracks().length === 0) {
            if (onErrorCallback) onErrorCallback();
            return false;
        }

        const tracks = [...canvasStream.getTracks()];
        if (streamDestination) {
            tracks.push(...streamDestination.stream.getTracks());
        }
        const combinedStream = new MediaStream(tracks);
        
        let options = { mimeType: 'video/webm; codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
        
        try {
            this.mediaRecorder = new MediaRecorder(combinedStream, options);
        } catch (e) {
            if (onErrorCallback) onErrorCallback();
            return false; 
        }

        this.mediaRecorder.ondataavailable = e => { 
            if (e.data.size > 0) this.recordedChunks.push(e.data); 
        };
        
        this.mediaRecorder.onstop = async () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            await this.cacheVideoRecord(blob); 
            const videoUrl = URL.createObjectURL(blob);
            if (onStopCallback) onStopCallback(videoUrl);
        };

        this.mediaRecorder.start();
        return true;
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }
}