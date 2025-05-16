class SpellManager {
    constructor(scene, spellData) {
        this.scene = scene;
        this.spellPreviewCircle = null;
        this.spellData = spellData;
        this.spellCooldowns = {};

        this.spellButtons = [];
        this.globalCooldownMultiplier = 1;
        this.createSpellDropZone();
    }


    createSpellDropZone(){

        const dropZoneOffsetX = 540;
        const dropZoneOffsetY = 100;
        const dropZoneWidth = this.scene.scale.width - dropZoneOffsetX;
        const dropZoneHeight = this.scene.scale.height - dropZoneOffsetY - 450;


// 1. Zone interactive invisible
        this.spellDropZone = this.scene.add.zone(dropZoneOffsetX, dropZoneOffsetY, dropZoneWidth, dropZoneHeight)
            .setOrigin(0)
            .setRectangleDropZone(dropZoneWidth, dropZoneHeight)
            .setDepth(0);

/*
        this.scene.add.sprite(dropZoneOffsetX, dropZoneOffsetY-50, 'ground')
            .setDisplaySize(dropZoneWidth, dropZoneHeight+100)
            .setOrigin(0)
            .setDepth(0);*/

// 2. Rectangle visuel de debug aligné
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
    }


    reorganizeSpellBar() {
        const spacing = 120;
        const offsetX = this.scene.scale.width / 2 - (spacing * this.spellButtons.length) / 2;
        const offsetY = this.scene.scale.height - 100;

        this.spellButtons.forEach(({ btn, txt }, i) => {
            const x = offsetX + i * spacing;
            const y = offsetY;

            this.scene.tweens.add({
                targets: [btn, txt],
                x,
                y,
                duration: 200,
                ease: 'Power2'
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
        this.spellButtons.forEach(({ btn, txt, spell }) => {
            const cd = this.spellCooldowns[spell.id] || 0;
            const remaining = cd - now;

            if (remaining > 0) {
                const ratio = Phaser.Math.Clamp(remaining / (spell.cooldown * this.globalCooldownMultiplier), 0, 1);
                btn.setAlpha(0.3);
                txt.setText(`${spell.name} (${Math.ceil(remaining / 1000)}s)`);
            } else {
                btn.setAlpha(1);
                txt.setText(spell.name);
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
        const spacing = 120;
        const index = this.spellButtons.length;
        const x = this.scene.scale.width / 2 - (spacing * 2) + index * spacing;
        const y = this.scene.scale.height - 100;

        const color = parseInt(spell.color.replace('#', '0x'));

        const btn = this.scene.add.rectangle(x, y, 100, 40, color)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0)
            .setInteractive({ draggable: true })
            .setDepth(30);


        const description = this.scene.add.text(x + 50, y + 20, spell.name, {
            fontSize: '14px',
            fill: '#000',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(31);

        // 🧠 ➕ Ajout du hover
        btn.on('pointerover', () => {
            const info = { name: spell.name, desc: spell.desc };
            this.scene.hud.showInfoPanel(info.name, info.desc, btn.x + 20, btn.y);
        });
        btn.on('pointerout', () => {
            this.scene.hud.hideInfoPanel();
        });

        const txt = this.scene.add.text(x + 50, y + 20, spell.name, {
            fontSize: '14px',
            fill: '#000',
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(31);

        btn.spellId = spell.id;
        btn.cooldownEnd = 0;
        btn.oneTime = true; // 👈 important

        this.scene.input.setDraggable(btn);
        this.spellButtons.push({ btn, description, txt, spell });

        this.reorganizeSpellBar();
    }


}