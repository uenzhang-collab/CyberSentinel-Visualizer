/**
 * CyberSentinel - Lyrics Manager Module
 * 負責處理 LRC 歌詞解析、時間軸打軸紀錄、以及高精度的 SRT/LRC 檔案匯出。
 */
export class LyricsManager {
    constructor() {
        this.parsedLyrics = [];
        this.rawLines = [];
        this.syncIndex = 0;
        this.isSyncing = false;
    }

    parse(text) {
        this.parsedLyrics = [];
        const timeRegEx = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
        text.split('\n').forEach(line => {
            const m = timeRegEx.exec(line);
            if (m) {
                const time = parseInt(m[1])*60 + parseInt(m[2]) + parseInt(m[3])/Math.pow(10, m[3].length);
                const txt = line.replace(timeRegEx, '').trim();
                if(txt) this.parsedLyrics.push({time, text: txt});
            }
        });
    }

    startSync(text) {
        if (!text) return null;
        this.rawLines = text.split('\n').map(l=>l.trim()).filter(l=>l);
        this.syncIndex = 0;
        this.isSyncing = true;
        return this.rawLines.join('\n'); 
    }

    markNext(currentText, currentTime) {
        if(!this.isSyncing || this.syncIndex >= this.rawLines.length) return null;
        
        const m = Math.floor(currentTime/60).toString().padStart(2,'0');
        const s = Math.floor(currentTime%60).toString().padStart(2,'0');
        const ms = Math.floor((currentTime%1)*100).toString().padStart(2,'0');
        const tag = `[${m}:${s}.${ms}]`;
        
        let lines = currentText.split('\n');
        for(let i=0; i<lines.length; i++){
            if(lines[i] === this.rawLines[this.syncIndex]){ 
                lines[i] = tag + this.rawLines[this.syncIndex]; 
                break; 
            }
        }
        
        const newText = lines.join('\n');
        this.parse(newText);
        this.syncIndex++;
        
        return {
            newText: newText,
            isFinished: this.syncIndex >= this.rawLines.length,
            nextLine: this.rawLines[this.syncIndex] || null
        };
    }

    stopSync() {
        this.isSyncing = false;
        this.syncIndex = 0;
    }

    getActiveLyric(currentTime) {
        if (!this.parsedLyrics || this.parsedLyrics.length === 0) return "";
        let active = "";
        for (let i = 0; i < this.parsedLyrics.length; i++) {
            if (currentTime >= this.parsedLyrics[i].time) active = this.parsedLyrics[i].text;
            else break; 
        }
        return active;
    }

    exportLRC(text, topic) {
        if (!text) return false;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        this._downloadBlob(blob, `${topic}.lrc`);
        return true;
    }

    exportSRT(text, topic) {
        this.parse(text); 
        if (this.parsedLyrics.length === 0) return false;

        let srtContent = '';
        const formatTime = (sec) => {
            const h = Math.floor(sec / 3600).toString().padStart(2, '0');
            const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(sec % 60).toString().padStart(2, '0');
            const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
            return `${h}:${m}:${s},${ms}`;
        };

        for (let i = 0; i < this.parsedLyrics.length; i++) {
            const startSec = this.parsedLyrics[i].time;
            let endSec = (i < this.parsedLyrics.length - 1) ? this.parsedLyrics[i+1].time : startSec + 5.0; 
            if (endSec - startSec > 15.0) endSec = startSec + 15.0; 

            srtContent += `${i + 1}\n`;
            srtContent += `${formatTime(startSec)} --> ${formatTime(endSec)}\n`;
            srtContent += `${this.parsedLyrics[i].text}\n\n`;
        }

        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        this._downloadBlob(blob, `${topic}.srt`);
        return true;
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}