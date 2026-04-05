// 負責深空 2D 星雲粒子軌跡渲染

class Particle {
    constructor(x, y, force, scale, speedMult = 1.0) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        
        const speed = (Math.random() * 20 + 8) * force * scale * speedMult;
        this.vx = Math.cos(angle) * speed; 
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0; 
        this.decay = Math.random() * 0.004 + 0.0015; 
        
        const colors = [{h:190,s:80,l:60}, {h:280,s:80,l:65}, {h:330,s:80,l:65}, {h:45,s:90,l:65}, {h:150,s:80,l:60}];
        const c = colors[Math.floor(Math.random() * colors.length)];
        this.hue = c.h + (Math.random() * 20 - 10); this.sat = c.s; this.lit = c.l;
        
        this.size = (Math.random() * 1.5 + 0.5 + (force * 0.2)) * scale; 
        this.friction = Math.random() * 0.01 + 0.985; 
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= this.friction; this.vy *= this.friction;
        this.life -= this.decay; 
        this.size *= 0.98;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.sat}%, ${this.lit}%, ${this.life})`; 
        ctx.fill();
    }
}

let particles = [];
let lastBeatTime = 0;

export function renderParticles(ctx2D, canvas2D, particleCanvas, pCtx, dataArray, scale, isA11y, config) {
    const bufferLength = dataArray.length;
    let volSum = 0, bassSum = 0;
    for(let i=0; i<bufferLength; i++) {
        volSum += dataArray[i];
        if (i < 6) bassSum += dataArray[i];
    }
    const volAvg = volSum / bufferLength;
    const bassAvg = bassSum / 6;

    ctx2D.fillStyle = '#000000';
    ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);
    
    pCtx.globalCompositeOperation = 'source-over';
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.06)'; 
    pCtx.fillRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    const pCx = particleCanvas.width / 2;
    const pCy = particleCanvas.height * 0.55; 

    const baseSize = (70 + (volAvg / 255) * 40) * scale;
    const punch = (Math.pow(bassAvg / 255, 3) * 250) * scale;
    const coreRadius = baseSize + punch;
    
    pCtx.save();
    pCtx.translate(pCx, pCy);
    const nebulaGrad = pCtx.createRadialGradient(0,0, coreRadius*0.5, 0,0, coreRadius*4);
    nebulaGrad.addColorStop(0, 'rgba(0, 150, 255, 0.3)');
    nebulaGrad.addColorStop(0.5, 'rgba(200, 50, 255, 0.1)');
    nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = nebulaGrad;
    pCtx.beginPath(); pCtx.arc(0, 0, coreRadius*4, 0, Math.PI*2); pCtx.fill();
    
    pCtx.rotate(performance.now() / 1500);
    const ringGrad = pCtx.createLinearGradient(-coreRadius, -coreRadius, coreRadius, coreRadius);
    ringGrad.addColorStop(0, 'hsl(190, 80%, 60%)'); ringGrad.addColorStop(0.33, 'hsl(280, 80%, 65%)');
    ringGrad.addColorStop(0.66, 'hsl(330, 80%, 65%)'); ringGrad.addColorStop(1, 'hsl(45, 90%, 65%)');
    
    pCtx.beginPath(); pCtx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    pCtx.lineWidth = (6 * scale) + (punch * 0.04);
    pCtx.strokeStyle = ringGrad;
    pCtx.shadowBlur = 30 + punch * 0.1; pCtx.shadowColor = 'rgba(200, 150, 255, 0.8)';
    pCtx.stroke();
    pCtx.restore();

    if (!isA11y && bassAvg > 210 && performance.now() - lastBeatTime > 200) {
        const burstCount = Math.floor((Math.random() * 20 + 15) * config.amountMult); 
        const force = Math.pow(bassAvg / 255, 1.5) * 6.0; 
        
        for (let i = 0; i < burstCount; i++) {
            particles.push(new Particle(pCx, pCy, force, scale, config.speedMult));
        }
        lastBeatTime = performance.now();
    } else if (Math.random() < 0.15 * config.amountMult) {
        particles.push(new Particle(pCx, pCy, (volAvg / 255) * 2.0, scale, config.speedMult));
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(pCtx);
        if (particles[i].life <= 0 || particles[i].size <= 0.1) particles.splice(i, 1); 
    }
    ctx2D.drawImage(particleCanvas, 0, 0);
}