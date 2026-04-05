// js/VfxManager.js
export class VfxManager {
    constructor(scene) {
        this.scene = scene;
        this.modules = new Map(); // 儲存所有已載入的特效實例
    }

    // 註冊並初始化模組
    addModule(id, instance, textures = {}) {
        instance.setup(this.scene, textures.bar, textures.ray);
        this.modules.set(id, {
            instance: instance,
            enabled: true
        });
    }

    // 切換開關
    toggleModule(id, state) {
        if (this.modules.has(id)) {
            const mod = this.modules.get(id);
            mod.enabled = state;
            mod.instance.group.visible = state; // 透過控制 Group 的顯示來節能
        }
    }

    // 統一更新所有開啟中的模組
    updateAll(dataArray, orbPulse, rotationSpeed) {
        this.modules.forEach(mod => {
            if (mod.enabled) {
                mod.instance.update(dataArray, orbPulse, rotationSpeed);
            }
        });
    }
}