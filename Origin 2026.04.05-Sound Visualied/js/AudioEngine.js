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
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.9; 
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