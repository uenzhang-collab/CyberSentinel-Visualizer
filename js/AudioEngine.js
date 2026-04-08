/**
 * CyberSentinel - 音訊解析模組 (Audio Engine) 
 * 升級版：整合 A-Weighting 響度修正與專業級動態演算
 */

export class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.currentBuffer = null;
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

    /**
     * ⚔️ 秘密武器：靜態波形生成器
     */
    async getStaticWaveform(file) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); 
        const samples = 200; 
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];

        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize); 
        }
        return filteredData;
    }
}

/**
 * 🛠️ 廣播級 A-Weighting 曲線修正函數
 * 模擬人類耳廓對不同頻率的響度過濾
 */
function getAWeighting(frequency) {
    if (frequency <= 20) return -100; // 低於人類聽覺範圍
    const f2 = frequency * frequency;
    const f4 = f2 * f2;
    const r1 = (Math.pow(12194, 2) * f4) / 
               ((f2 + Math.pow(20.6, 2)) * Math.sqrt((f2 + Math.pow(107.7, 2)) * (f2 + Math.pow(737.9, 2))) * (f2 + Math.pow(12194, 2)));
    return 2.0 + 20 * Math.log10(r1); 
}

/**
 * 🎯 廣播級音頻解譯演算法 (優化版)
 * 整合 A-Weighting 響度修正與柔性物理動態
 */
export function getPremiumAudioAmps(dataArray, stateArrayName, numBins, vfxType = 'circular') {
    if (!window[stateArrayName] || window[stateArrayName].length !== numBins) {
        window[stateArrayName] = new Array(numBins).fill(0);
    }
    const state = window[stateArrayName];
    const bufferLength = dataArray.length;
    const sampleRate = 44100; // 基礎採樣率
    
    // 增加採樣覆蓋範圍，獲取更多高頻細節
    const minFreqBin = 2; 
    const maxFreqBin = Math.floor(bufferLength * 0.85); 
    
    for (let i = 0; i < numBins; i++) {
        const startBin = Math.floor(minFreqBin * Math.pow(maxFreqBin / minFreqBin, i / numBins));
        let endBin = Math.floor(minFreqBin * Math.pow(maxFreqBin / minFreqBin, (i + 1) / numBins));
        if (endBin <= startBin) endBin = startBin + 1; 
        
        // --- 計算 A-Weighting 增益 ---
        const centerFreq = ((startBin + endBin) / 2) * (sampleRate / (bufferLength * 2));
        const aWeightDB = getAWeighting(centerFreq);
        const aWeightGain = Math.pow(10, aWeightDB / 20); // 線性增益轉換

        let sum = 0, count = 0;
        let maxBinVal = 0;
        for (let j = startBin; j < endBin && j < bufferLength; j++) {
            sum += dataArray[j];
            if (dataArray[j] > maxBinVal) maxBinVal = dataArray[j];
            count++;
        }
        
        let rawVal = 0;
        if (vfxType === 'circular') {
            rawVal = count > 0 ? (i < numBins * 0.3 ? sum / count : maxBinVal) / 255.0 : 0;
        } else {
            rawVal = count > 0 ? (sum / count) / 255.0 : 0;
        }
        
        // 套用 A-Weighting 與動態權重
        let weight = (vfxType === 'circular') ? 1.0 + Math.pow(i / numBins, 1.8) * 2.5 : 1.0 + Math.pow(i / numBins, 1.5) * 1.8;
        let val = (rawVal * aWeightGain) * weight;
        
        // 柔性削峰限制
        val = (vfxType === 'eq') ? Math.tanh(val * 1.25) : Math.tanh(val * 1.15);
        
        const targetAmp = (vfxType === 'circular') ? Math.pow(val, 2.0) : Math.pow(val, 1.4); 
        
        // 物理 Attack / Release 控制
        const attack = (vfxType === 'circular') ? 0.90 : 0.75; 
        const release = (vfxType === 'circular') ? 0.15 : 0.12; 
        
        if (targetAmp > state[i]) {
            state[i] += (targetAmp - state[i]) * attack; 
        } else {
            state[i] += (targetAmp - state[i]) * release; 
        }
    }
    
    // 平滑化處理邏輯 (與舊版相同，確保空間連動感)
    const smoothedState = new Array(numBins);
    for (let i = 0; i < numBins; i++) {
        let prev = i > 0 ? state[i - 1] : (vfxType === 'circular' ? state[numBins - 1] : state[0]);
        let next = i < numBins - 1 ? state[i + 1] : (vfxType === 'circular' ? state[0] : state[numBins - 1]);

        if (vfxType === 'eq') {
            smoothedState[i] = state[i] * 0.5 + prev * 0.25 + next * 0.25;
        } else {
            smoothedState[i] = state[i] * 0.8 + prev * 0.1 + next * 0.1;
        }
    }
    
    return smoothedState;
}