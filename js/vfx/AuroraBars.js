// vfx/AuroraBars.js
/**
 * 核心渲染模組：極光水晶柱與緩變流體系統
 * 研發者：張承偉 | CyberSentinel
 */

export class AuroraBars {
    constructor() {
        this.bars = [];
        this.reflections = [];
        this.rays = [];
        this.smoothedOrbPulse = 0;
        this.group = new THREE.Group();
    }

    // 初始化 3D 舞台物件
    setup(scene, barTex, rayTex) {
        const radius = 130;
        const numBars = 128;

        for (let i = 0; i < numBars; i++) {
            const angle = (i / numBars) * Math.PI * 2;
            const hue = (i / numBars) * 360;
            const color = new THREE.Color(`hsl(${hue}, 90%, 65%)`);

            // 1. 水晶柱 (符合極致節能與 PBR 物理質感)
            const material = new THREE.MeshPhysicalMaterial({
                color: color, map: barTex, transmission: 0.9, transparent: true,
                emissive: color, emissiveMap: barTex, emissiveIntensity: 1.0
            });
            const bar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2, 12), material);
            bar.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
            bar.rotation.y = -angle;

            // 2. 地板透射光束 (Aurora Rays)
            const rayGeo = new THREE.PlaneGeometry(16, 1);
            rayGeo.rotateX(-Math.PI / 2);
            rayGeo.translate(0, 0, 0.5);
            const rayMat = new THREE.MeshBasicMaterial({
                color: color, alphaMap: rayTex, transparent: true,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * (radius + 2), 0.5, Math.sin(angle) * (radius + 2));
            ray.lookAt(new THREE.Vector3(Math.cos(angle) * radius * 2, 0.5, Math.sin(angle) * radius * 2));

            this.bars.push(bar);
            this.rays.push(ray);
            this.group.add(bar, ray);
        }
        scene.add(this.group);
    }

    // 每一幀的緩變更新 (核心流體動力學邏輯)
    update(dataArray, orbPulse, rotationSpeed) {
        this.smoothedOrbPulse += (orbPulse - this.smoothedOrbPulse) * 0.08;
        this.group.rotation.y -= 0.002 * rotationSpeed;

        this.bars.forEach((bar, i) => {
            const val = dataArray[i % 128] / 255;
            const targetHeight = Math.max(0.15, Math.pow(val, 2.2) * 100);
            bar.scale.y += (targetHeight - bar.scale.y) * 0.08;
            bar.position.y = bar.scale.y / 2;
            
            // 同步更新光束
            if(this.rays[i]) {
                const targetRayZ = 4 + (val * 250 + this.smoothedOrbPulse * 800);
                this.rays[i].scale.z += (targetRayZ - this.rays[i].scale.z) * 0.05;
                this.rays[i].material.opacity = (val * 0.4 + this.smoothedOrbPulse * 2.0);
            }
        });
    }
}