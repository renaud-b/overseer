class SpellManager {
    constructor(scene, spellData) {
        this.scene = scene;
        this.spellPreviewCircle = null;
        this.spellData = spellData;
        this.spellCooldowns = {};

        this.spellButtons = [];
        this.globalCooldownMultiplier = 1;
        this.createSpellDropZone();
        const offsetX = 820;
        const offsetY = 110 + scene.gridManager.offsetY + (scene.gridManager.height * scene.gridManager.tileSizeY);

        const tileWidth = 104;
        const tileHeight = 104;

        this.spellSlots = [];


        const etchings1 = this.scene.add.image(offsetX + 30, offsetY +tileHeight-15, "etchings")
        const etchings2 = this.scene.add.image(offsetX + 30, offsetY +(tileHeight*2)-5, "etchings")

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


// 1. Zone interactive invisible
        this.spellDropZone = this.scene.add.zone(dropZoneOffsetX, dropZoneOffsetY, dropZoneWidth, dropZoneHeight)
            .setOrigin(0)
            .setRectangleDropZone(dropZoneWidth, dropZoneHeight)
            .setDepth(0);


        this.scene.add.sprite(dropZoneOffsetX, dropZoneOffsetY-50, 'ground')
            .setDisplaySize(dropZoneWidth, dropZoneHeight+100)
            .setOrigin(0)
            .setDepth(-1);

        // 2. Rectangle visuel de debug aligné
        /*
        this.spellDropZoneOutline = this.scene.add.rectangle(
            dropZoneOffsetX + dropZoneWidth / 2,
            dropZoneOffsetY + dropZoneHeight / 2,
            dropZoneWidth,
            dropZoneHeight
        )
            .setStrokeStyle(2, 0xff00ff)
            .setFillStyle(0x000000, 0.05)
            .setDepth(1)
            .setAlpha(0.2);

         */
    }


    reorganizeSpellBar() {
        this.spellButtons.forEach((data, i) => {
            const slot = this.spellSlots[i];
            if (!slot) return;

            this.scene.tweens.add({
                targets: [data.btn],
                x: slot.x,
                y: slot.y,
                duration: 200,
                ease: 'Power2'
            });

            // Optionnel : pour le hover info
            data.btn.startX = slot.x;
            data.btn.startY = slot.y;
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
            const btn = entry.btn
                const  spell =entry.spell
            const cd = this.spellCooldowns[spell.id] || 0;
            const remaining = cd - now;

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
        if (this.spellButtons.length >= this.spellSlots.length) {
            console.warn("Plus de slots disponibles pour les sorts.");
            return;
        }

        const spacing = 120;
        const index = this.spellButtons.length;
        const x = this.scene.scale.width / 2 - (spacing * 2) + index * spacing;
        const y = this.scene.scale.height - 100;

        const color = parseInt(spell.color.replace('#', '0x'));

        const btnSize = 60; // même taille que tes tiles de fond

        const btn = this.scene.add.rectangle(x, y, btnSize, btnSize, color)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ draggable: true })
            .setRotation(90) // rotation de 90 degrés en radians
            .setDepth(30);


        // 🧠 ➕ Ajout du hover
        btn.on('pointerover', () => {
            const info = { name: spell.name, desc: spell.desc };
            this.scene.hud.showInfoPanel(info.name, info.desc, btn.x + 20, btn.y);
        });
        btn.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });

        btn.spellId = spell.id;
        btn.cooldownEnd = 0;
        btn.oneTime = true; // 👈 important

        this.scene.input.setDraggable(btn);
        this.spellButtons.push({ btn, spell });

        this.reorganizeSpellBar();
    }


}