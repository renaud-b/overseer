class Tile {
    constructor(scene, x, y, sizeX, sizeY, index, parentEntity) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.building = null;
        this.entity = scene.world.create(parentEntity);
        scene.world.set(this.entity, 'Tile', { index, x, y, width: sizeX, height: sizeY });
        scene.world.set(this.entity, 'Watched', { active: false });

        this.rect = scene.add.rectangle(x, y, sizeX, sizeY, 0x333333, 0.0)
            .setOrigin(0)
            .setInteractive();

        this.rect.input.dropZone = true;
        this.rect.setData('index', index);
        this.rect.setData('tileRef', this); // pour y accéder côté scène si besoin
    }

    get isActive() {
        return this.scene.world.get(this.entity, 'Watched').active;
    }

    set isActive(value) {
        this.scene.world.get(this.entity, 'Watched').active = Boolean(value);
    }
}
