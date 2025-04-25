class ArtifactManager {
    constructor(scene) {
        this.scene = scene;
        this.artifacts = [];
    }

    addArtifact(id) {
        const artifact = this.getArtifactData(id);
        if (!artifact) return;

        this.artifacts.push(artifact);
        console.log(`✨ Artifact obtenu : ${artifact.name}`);
    }

    getArtifactData(id) {
        return this.scene.gameData.artifacts.find(a => a.id === id);
    }

    getAllActiveEffects() {
        return this.artifacts.map(a => a.effect);
    }

    update(scaledDelta){
        this.xenoTimer = (this.xenoTimer || 0) + scaledDelta;
        if (this.xenoTimer >= 5000) {
            this.xenoTimer = 0;

            const effects = this.getAllActiveEffects();
            if (effects.includes('periodic_xeno')) {
                let count = 0;
                this.scene.buildingManager.buildings.forEach(b => {
                    if (b.tile.isActive && ['refinery', 'reactor'].includes(b.type)) {
                        count++;
                    }
                });
                if (count > 0) {
                    this.scene.addResource('xeno_sample', count);
                    console.log(`🧬 Gagné ${count} xeno_sample via artifact`);
                }
            }
        }
    }
}
