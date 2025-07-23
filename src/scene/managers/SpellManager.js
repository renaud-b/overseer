class SpellManager {
    constructor(scene, spellData) {
        this.scene = scene;
        this.spellPreviewCircle = null;
        this.spellData = spellData;
        this.spellCooldowns = {};

        this.spellButtons = [];
        this.createSpellDropZone();
        const offsetX = 820;
        const offsetY = 110 + scene.gridManager.offsetY + (scene.gridManager.height * scene.gridManager.tileSizeY);

        const tileWidth = 104;
        const tileHeight = 104;

        this.spellSlots = [];


        const tile1 = this.scene.add.image(offsetX, offsetY, "empty_spell_tile")
            .setDisplaySize(tileWidth, tileHeight);
        this.spellSlots.push({ x: tile1.x, y: tile1.y });

        const tile2 = this.scene.add.image(offsetX + tileWidth / 2 + 5, offsetY + tileHeight / 2 + 5, "empty_spell_tile")
            .setDisplaySize(tileWidth, tileHeight);
        this.spellSlots.push({ x: tile2.x, y: tile2.y });

        const tile3 = this.scene.add.image(offsetX, offsetY + tileHeight + 10, "empty_spell_tile")
            .setDisplaySize(tileWidth, tileHeight);
        this.spellSlots.push({ x: tile3.x, y: tile3.y });

        const tile4 = this.scene.add.image(offsetX + tileWidth / 2 + 5, offsetY + tileHeight / 2 + tileHeight + 15, "empty_spell_tile")
            .setDisplaySize(tileWidth, tileHeight);
        this.spellSlots.push({ x: tile4.x, y: tile4.y });

        const tile5 = this.scene.add.image(offsetX, offsetY + tileHeight * 2 + 20, "empty_spell_tile")
            .setDisplaySize(tileWidth, tileHeight);
        this.spellSlots.push({ x: tile5.x, y: tile5.y });

    }


    createSpellDropZone(){

        const dropZoneOffsetX = 700;
        const dropZoneOffsetY = 100;
        const dropZoneWidth = this.scene.scale.width - dropZoneOffsetX;
        const dropZoneHeight = this.scene.scale.height - dropZoneOffsetY - 450;


        this.scene.add.zone(dropZoneOffsetX, dropZoneOffsetY, dropZoneWidth, dropZoneHeight)
            .setOrigin(0)
            .setRectangleDropZone(dropZoneWidth, dropZoneHeight)
            .setDepth(0);


        this.scene.add.sprite(dropZoneOffsetX, dropZoneOffsetY-50, 'ground')
            .setDisplaySize(dropZoneWidth, dropZoneHeight+100)
            .setOrigin(0)
            .setDepth(-1);
    }


    reorganizeSpellBar() {
        this.spellButtons.forEach((entry, i) => {
            const slot = this.spellSlots[i];
            if (!slot) return;

            this.scene.tweens.add({
                targets: entry.container,
                x: slot.x,
                y: slot.y,
                duration: 250,
                ease: 'Cubic.easeOut'
            });
        });
    }

    castSpellAt(spell, x, y) {
        if (spell.effect === 'stun') {
            this.scene.enemyUnits.forEach(unit => {
                const dist = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, x, y);
                if (dist < spell.radius) {
                    const oldSpeed = unit.speed;
                    unit.speed = 0;
                    this.scene.time.delayedCall(spell.duration, () => {
                        unit.speed = oldSpeed;
                    });
                }
            });
        }

        else if (spell.effect === 'damage') {
            this.scene.enemyUnits.forEach(unit => {
                const dist = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, x, y);
                if (dist < spell.radius) {
                    unit.hp -= spell.amount;
                }
            });
        }

        else if (spell.effect === 'heal') {
            this.scene.playerUnits.forEach(unit => {
                const dist = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, x, y);
                if (dist < spell.radius) {
                    unit.hp = Math.min(unit.hp + spell.amount, unit.maxHp);
                }
            });
        }

        else if (spell.effect === 'persistent_heal') {
            new ZoneEffect(this.scene, x, y, {
                radius: spell.radius,
                duration: spell.duration,
                tickInterval: spell.tickInterval,
                color: 0x00ff00,
                effectFn: this.healEffect
            });
        }
        // Cercle visuel temporaire
        const effectCircle = this.scene.add.circle(x, y, spell.radius, 0xffffff, 0.15)
            .setDepth(5)
            .setAlpha(0.6)
            .setStrokeStyle(2, 0xffffff)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.scene.time.delayedCall(1000, () => {
            effectCircle.destroy();
        });

        // ➕ Nettoyage du preview cercle s’il existe
        if (this.spellPreviewCircle) {
            this.spellPreviewCircle.destroy();
            this.spellPreviewCircle = null;
        }

        // TODO : effet visuel à améliorer
    }

    healEffect(scene, x, y, radius) {
        scene.playerUnits.forEach(unit => {
            const dist = Phaser.Math.Distance.Between(unit.sprite.x, unit.sprite.y, x, y);
            if (dist < radius) {
                unit.hp = Math.min(unit.maxHp, unit.hp + 1);
            }
        });
    }

    updateSpellCooldowns() {
        const now = this.scene.time.now;
        this.spellButtons.forEach((entry) => {
            const  spell =entry.spell
            const cd = this.spellCooldowns[spell.id] || 0;
            const remaining = cd - now;

            const btn = entry.btn
            if(!btn) return; // Si le bouton n'existe pas, on ignore

            if (remaining > 0) {
                btn.setAlpha(0.3);
            } else {
                btn.setAlpha(1);
            }
        });
    }

    addSpellById(spellId) {
        const spell = this.spellData.find(s => s.id === spellId);
        if (spell) {
            this.addSpellToBar(spell);
            return true
        }
        return false
    }

    addSpellToBar(spell) {
        // Vérifier si le sort existe déjà dans la barre
        const existing = this.spellButtons.find(entry => entry.spell.id === spell.id);
        if (existing) {
            existing.count++;
            existing.countText.setText(`x${existing.count}`);

            // ✅ Petit effet visuel pour montrer l'incrément
            this.scene.tweens.add({
                targets: existing.countText,
                scale: { from: 1.3, to: 1 },
                duration: 150,
                ease: 'Back.easeOut'
            });
            return;
        }

        if (this.spellButtons.length >= this.spellSlots.length) {
            console.warn("Plus de slots disponibles pour les sorts.");
            return;
        }

        const index = this.spellButtons.length;
        const slot = this.spellSlots[index];
        const btnSize = 60;
        const color = parseInt(spell.color.replace('#', '0x'));

        // ✅ Icône (fond coloré)
        const btn = this.scene.add.rectangle(0, 0, btnSize, btnSize, color)
            .setRotation(Phaser.Math.DegToRad(45))
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5);

        // ✅ Compteur
        const countText = this.scene.add.text(btnSize / 2 - 6, btnSize / 2 - 6, 'x1', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 1);

        // ✅ Container pour grouper les deux
        const container = this.scene.add.container(slot.x, slot.y, [btn, countText])
            .setSize(btnSize, btnSize)
            .setInteractive({ useHandCursor: true })
            .setDepth(30);

        // Ajout du hover pour afficher l'info
        container.on('pointerover', () => {
            const info = { name: spell.name || spell.id, desc: spell.desc || 'No description' };
            this.scene.hud.showInfoPanel(info.name, info.desc, container.x + 40, container.y);
        });

        container.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });

        container.spellId = spell.id;
        container.oneTime = false;

        this.scene.input.setDraggable(container);

        this.spellButtons.push({ container, spell, count: 1, countText });
        this.reorganizeSpellBar();
    }


}