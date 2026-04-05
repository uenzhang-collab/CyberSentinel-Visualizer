/**
 * CyberSentinel - 音訊解析模組 (Audio Engine)
 * 負責處理 Web Audio API 的初始化、麥克風/檔案音源串接，
 * 以及廣播級的對數與物理重力音頻演算法。
 */

export class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
    }
    
    async init(sourceInput) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            // 統一使用高解析度 2048，供我們的新解譯引擎重採樣
            this.analyser.fftSize = 2048; 
            // 將原生平滑度調低，把物理重力計算交給我們自己寫的 ADSR 引擎
            this.analyser.smoothingTimeConstant = 0.75; 
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
        if (this.source) this.source.disconnect();

        if (sourceInput instanceof HTMLMediaElement) {
            if (!sourceInput.audioSourceNode) {
                sourceInput.audioSourceNode = this.audioCtx.createMediaElementSource(sourceInput);
            }
            this.source = sourceInput.audioSourceNode;
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        } else if (sourceInput instanceof MediaStream) {
            this.source = this.audioCtx.createMediaStreamSource(sourceInput);
            this.source.connect(this.analyser);
        }
    }
    
    getBassData() {
        if (!this.analyser) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        let bass = 0;
        for (let i = 0; i < 6; i++) bass += this.dataArray[i];
        return Math.pow((bass / 6) / 255, 3.0); 
    }
}

// 🎯 廣播級音頻解譯演算法 (支援柔性削峰與波浪空間連動)
export function getPremiumAudioAmps(dataArray, stateArrayName, numBins, vfxType = 'circular') {
    if (!window[stateArrayName] || window[stateArrayName].length !== numBins) {
        window[stateArrayName] = new Array(numBins).fill(0);
    }
    const state = window[stateArrayName];
    const bufferLength = dataArray.length;
    
    const minFreqBin = 2; 
    const maxFreqBin = Math.floor(bufferLength * 0.65); 
    
    for (let i = 0; i < numBins; i++) {
        const startBin = Math.floor(minFreqBin * Math.pow(maxFreqBin / minFreqBin, i / numBins));
        let endBin = Math.floor(minFreqBin * Math.pow(maxFreqBin / minFreqBin, (i + 1) / numBins));
        if (endBin <= startBin) endBin = startBin + 1; 
        
        let sum = 0, count = 0;
        let maxBinVal = 0;
        for (let j = startBin; j < endBin && j < bufferLength; j++) {
            sum += dataArray[j];
            if (dataArray[j] > maxBinVal) maxBinVal = dataArray[j];
            count++;
        }
        
        let rawVal = 0;
        if (vfxType === 'circular') {
            rawVal = count > 0 ? (i < numBins*0.3 ? sum/count : maxBinVal) / 255.0 : 0;
        } else {
            rawVal = count > 0 ? (sum / count) / 255.0 : 0;
        }
        
        let weight = 1.0;
        if (vfxType === 'circular') {
            weight = 1.0 + Math.pow(i / numBins, 1.8) * 2.2; 
        } else {
            weight = 1.0 + Math.pow(i / numBins, 1.5) * 1.5; 
        }
        
        let val = rawVal * weight;
        
        if (vfxType === 'eq') {
            val = Math.tanh(val * 1.2); 
        } else {
            val = Math.tanh(val * 1.15); 
        }
        
        const targetAmp = (vfxType === 'circular') ? Math.pow(val, 2.0) : Math.pow(val, 1.4); 
        
        const attack = (vfxType === 'circular') ? 0.88 : 0.65; 
        const release = (vfxType === 'circular') ? 0.12 : 0.10; 
        
        if (targetAmp > state[i]) {
            state[i] += (targetAmp - state[i]) * attack; 
        } else {
            state[i] += (targetAmp - state[i]) * release; 
        }
    }
    
    const smoothedState = new Array(numBins);
    for (let i = 0; i < numBins; i++) {
        let prev, next;

        if (vfxType === 'circular') {
            prev = i > 0 ? state[i - 1] : state[1]; 
            next = i < numBins - 1 ? state[i + 1] : state[numBins - 2]; 
        } else {
            prev = i > 0 ? state[i - 1] : state[i];
            next = i < numBins - 1 ? state[i + 1] : state[i];
        }

        if (vfxType === 'eq') {
            smoothedState[i] = state[i] * 0.5 + prev * 0.25 + next * 0.25;
        } else {
            smoothedState[i] = state[i] * 0.8 + prev * 0.1 + next * 0.1;
        }
    }
    
    return smoothedState;
}