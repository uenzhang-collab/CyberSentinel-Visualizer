// 負責 3D 極光、水晶柱與宇宙太陽渲染 (依賴全域的 window.THREE)

class RenderManager {
    constructor(canvas) {
        this.renderer = new window.THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        this.renderer.setSize(canvas.width, canvas.height, false);
        this.renderer.toneMapping = window.THREE.ACESFilmicToneMapping;
        
        this.scene = new window.THREE.Scene();
        this.camera = new window.THREE.PerspectiveCamera(50, canvas.width / canvas.height, 1, 1500);
        this.camera.position.set(0, 180, 380); 
        this.camera.lookAt(0, 20, 0);
    }
}

class VfxManager {
    constructor(scene) {
        this.scene = scene;
        this.modules = new Map(); 
    }
    addModule(id, instance, textures = {}) {
        instance.setup(this.scene, textures.bar, textures.ray);
        this.modules.set(id, { instance: instance, enabled: true });
    }
    updateAll(dataArray, orbPulse, rotationSpeed) {
        this.modules.forEach(mod => {
            if (mod.enabled) mod.instance.update(dataArray, orbPulse, rotationSpeed);
        });
    }
}

class AuroraBars {
    constructor() {
        this.bars = [];
        this.rays = [];
        this.smoothedOrbPulse = 0;
        this.group = new window.THREE.Group();
    }
    setup(scene, barTex, rayTex) {
        const radius = 130;
        for (let i = 0; i < 128; i++) {
            const angle = (i / 128) * Math.PI * 2;
            const color = new window.THREE.Color(`hsl(${(i / 128) * 360}, 90%, 65%)`);

            const material = new window.THREE.MeshPhysicalMaterial({
                color: color, map: barTex, transmission: 0.9, transparent: true,
                emissive: color, emissiveMap: barTex, emissiveIntensity: 1.0, roughness: 0.1
            });
            const bar = new window.THREE.Mesh(new window.THREE.BoxGeometry(4.5, 2, 12), material);
            bar.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
            bar.rotation.y = -angle;

            const rayGeo = new window.THREE.PlaneGeometry(16, 1);
            rayGeo.rotateX(-Math.PI / 2); rayGeo.translate(0, 0, 0.5);
            const rayMat = new window.THREE.MeshBasicMaterial({
                color: color, alphaMap: rayTex, transparent: true, blending: window.THREE.AdditiveBlending, depthWrite: false
            });
            const ray = new window.THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * (radius + 2), 0.5, Math.sin(angle) * (radius + 2));
            ray.lookAt(new window.THREE.Vector3(Math.cos(angle) * radius * 2, 0.5, Math.sin(angle) * radius * 2));

            this.bars.push(bar); this.rays.push(ray); this.group.add(bar, ray);
        }
        scene.add(this.group);
    }
    update(dataArray, orbPulse, rotationSpeed) {
        this.smoothedOrbPulse += (orbPulse - this.smoothedOrbPulse) * 0.08;
        this.group.rotation.y -= 0.002 * rotationSpeed;
        
        const smoothedData = [];
        for (let i = 0; i < 64; i++) {
            let sum = 0, count = 0;
            for(let j = Math.max(0, i - 1); j <= Math.min(63, i + 1); j++) { sum += dataArray[j]; count++; }
            smoothedData[i] = (sum / count) / 255;
        }

        this.bars.forEach((bar, i) => {
            let freqIndex = i < 64 ? i : 127 - i;
            const val = smoothedData[freqIndex];
            const targetHeight = Math.max(0.5, Math.pow(val, 1.6) * 55);
            bar.scale.y += (targetHeight - bar.scale.y) * 0.15;
            bar.position.y = bar.scale.y / 2;
            
            if(this.rays[i]) {
                const targetRayZ = 4 + (val * 180 + this.smoothedOrbPulse * 600);
                this.rays[i].scale.z += (targetRayZ - this.rays[i].scale.z) * 0.05;
                this.rays[i].material.opacity = (val * 0.4 + this.smoothedOrbPulse * 1.5);
            }
        });
    }
}

function createBarTexture() {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const cx = c.getContext('2d');
    const g = cx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, '#111'); g.addColorStop(0.5, '#888'); g.addColorStop(1, '#fff');
    cx.fillStyle = g; cx.fillRect(0, 0, 2, 256);
    return new window.THREE.CanvasTexture(c);
}

function createRayTexture() {
    const c = document.createElement('canvas'); c.width = 2; c.height = 128;
    const cx = c.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 2, 128);
    return new window.THREE.CanvasTexture(c);
}

let smoothedCamY = 180; // 模組內部狀態封裝

export function initAurora3D(canvas3D) {
    const rm = new RenderManager(canvas3D);
    const vfxManager = new VfxManager(rm.scene);
    
    const sun = new window.THREE.Mesh(
        new window.THREE.SphereGeometry(26, 32, 32),
        new window.THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff6600, wireframe: true, transparent: true, opacity: 0.8 })
    );
    sun.position.y = 30;
    rm.scene.add(sun);
    
    const aurora = new AuroraBars();
    vfxManager.addModule('aurora', aurora, { bar: createBarTexture(), ray: createRayTexture() });
    
    return { rm, vfxManager, aurora, sun };
}

export function renderAurora3D(ctx2D, canvas2D, canvas3D, rm, vfxManager, aurora, sun, dataArray, safePulse, config) {
    ctx2D.fillStyle = '#030305';
    ctx2D.fillRect(0, 0, canvas2D.width, canvas2D.height);
    
    aurora.group.visible = config.showAurora;
    if (config.showAurora) {
        vfxManager.updateAll(dataArray, safePulse, config.rotSpeed);
        aurora.bars.forEach(bar => bar.material.transmission = config.transmission);
    }
    
    sun.visible = config.showSun;
    if (config.showSun) {
        const targetOrbScale = 1 + safePulse * 2.0;
        sun.scale.set(targetOrbScale, targetOrbScale, targetOrbScale);
        sun.material.emissiveIntensity = 1.5 + safePulse * 5.0;
        sun.rotation.y += 0.005;
    }

    const camAngle = performance.now() * 0.00002;
    rm.camera.position.x = Math.sin(camAngle) * 380;
    rm.camera.position.z = Math.cos(camAngle) * 380;
    const targetCamY = 180 - safePulse * 25;
    smoothedCamY += (targetCamY - smoothedCamY) * 0.2; 
    rm.camera.position.y = smoothedCamY;
    rm.camera.lookAt(0, 20, 0);

    rm.renderer.render(rm.scene, rm.camera);
    ctx2D.drawImage(canvas3D, 0, 0, canvas2D.width, canvas2D.height);
}