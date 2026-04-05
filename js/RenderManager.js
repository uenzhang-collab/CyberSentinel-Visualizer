export class RenderManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        const width = this.canvas.clientWidth || 1920;
        const height = this.canvas.clientHeight || 1024;
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(width, height, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, width / height, 1, 1500);
        this.camera.position.set(0, 180, 380);
        this.camera.lookAt(0, 20, 0);
        this.isActive = true;

        window.addEventListener('resize', () => {
            const newW = this.canvas.clientWidth;
            const newH = this.canvas.clientHeight;
            this.camera.aspect = newW / newH;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(newW, newH, false);
        });
    }
    render(updateCallback) {
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.isActive) {
                updateCallback();
                this.renderer.render(this.scene, this.camera);
            }
        };
        animate();
    }
}