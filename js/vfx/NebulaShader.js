import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export function initNebulaShader(canvas3D) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 🌌 核心 GLSL 著色器程式碼
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_bass;       // 重低音脈衝
        uniform float u_colorFlow;  // 色彩偏移
        uniform float u_viscosity;  // 流體黏滯度 (速度)
        
        varying vec2 vUv;

        // 隨機函數
        float random(in vec2 _st) {
            return fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        // 2D 雜訊函數
        float noise(in vec2 _st) {
            vec2 i = floor(_st);
            vec2 f = fract(_st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        // FBM (碎形布朗運動) 產生流體紋理
        #define NUM_OCTAVES 5
        float fbm(in vec2 _st) {
            float v = 0.0;
            float a = 0.5;
            vec2 shift = vec2(100.0);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
            for (int i = 0; i < NUM_OCTAVES; ++i) {
                v += a * noise(_st);
                _st = rot * _st * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y;

            // 讓時間受黏滯度與重低音影響
            float t = u_time * u_viscosity + (u_bass * 0.5);

            vec2 q = vec2(0.);
            q.x = fbm(st + 0.00 * t);
            q.y = fbm(st + vec2(1.0));

            vec2 r = vec2(0.);
            // 讓流體受到重低音的「引力扭曲」
            r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * t * (1.0 + u_bass*2.0));
            r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * t);

            float f = fbm(st + r);

            // 根據 FBM 值與色彩偏移 (u_colorFlow) 決定顏色
            vec3 color = mix(
                vec3(0.101961, 0.619608, 0.666667),
                vec3(0.666667, 0.666667, 0.498039),
                clamp((f * f) * 4.0, 0.0, 1.0)
            );

            color = mix(color,
                vec3(0.1, 0.0, 0.3 + u_colorFlow * 0.5),
                clamp(length(q), 0.0, 1.0)
            );

            color = mix(color,
                vec3(0.6 + u_bass, 0.2 + u_colorFlow, 0.8),
                clamp(length(r.x), 0.0, 1.0)
            );

            // 增加對比度與重低音亮度爆發
            float brightness = f * f * f + 0.6 * f * f + 0.5 * f;
            color *= brightness * (1.0 + u_bass * 1.5);

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    const uniforms = {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2() },
        u_bass: { value: 0.0 },
        u_colorFlow: { value: 1.0 },
        u_viscosity: { value: 0.2 }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthWrite: false,
        depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    return { renderer, scene, camera, uniforms };
}

export function renderNebulaShader(nebulaSystem, width, height, bassData, config) {
    const { renderer, scene, camera, uniforms } = nebulaSystem;
    
    // 更新解析度
    renderer.setSize(width, height, false);
    uniforms.u_resolution.value.set(width, height);
    
    // 更新時間與音訊參數
    uniforms.u_time.value += 0.01;
    uniforms.u_bass.value = bassData;
    
    // 更新 UI 傳來的設定
    uniforms.u_colorFlow.value = config.colorFlow;
    uniforms.u_viscosity.value = config.viscosity;

    renderer.render(scene, camera);
}