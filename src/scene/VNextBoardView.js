// Phaser presentation for the 5x5 base, construction cards, and production feedback.
// ECS remains the source of truth; there is no separate stateful board manager.
(function (root) {
    'use strict';
    const methods = {
    drawPalette() {
        const l = this.layout;
        this.text(l.m + 16, l.mainTop + 18, 'CONSTRUCTION', 15);
        this.text(l.m + 16, l.mainTop + 44, 'Déposer ou cliquer', 11, '#7da0b3');
        const g = this.keep(this.add.graphics());
        const cards = OverseerVNextCards.cards(this.model);
        cards.forEach((typeId, i) => {
            const type = OverseerVNextBuildings.getBuilding(typeId);
            const x = l.m + 12, y = l.mainTop + 76 + 75 * i;
            const cw = l.leftW - 24;
            this.text(x + 53, y + 19, type.label, 12);
            const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[typeId];
            this.text(x + 53, y + 38, typeId === 'laboratory' ? 'RECHERCHE : 30 S / TECHNO' :
                typeId === 'cryopump' ? 'REFROIDIT LES VOISINS' :
                typeId === 'perception_amplifier' ? 'VISION PULSANTE' :
                typeId === 'maintenance' ? 'RÉPARATION : +2 PV / 30 S' :
                recipe ? 'PRODUCTION EXPÉRIMENTALE' : 'À IMPLÉMENTER', 10, '#7393a8');
            const hit = this.keep(this.add.zone(x + cw / 2, y + 32, cw, 65).setInteractive({ useHandCursor: true }));
            hit.setData('palette', typeId);
            hit.on('pointerover', () => this.showCardTooltip(typeId, x + cw, y + 10));
            hit.on('pointerout', () => this.hideBuildingTooltip());
            hit.on('pointerdown', () => {
                if (this.activeReward) return;
                this.selectedType = this.selectedType === typeId ? null : typeId;
                this.movingId = null;
                this.paintBoard();
                this.refreshPaletteSelection();
            });
            this.input.setDraggable(hit);
        });
        if (!cards.length) this.text(l.m + 13, l.mainTop + 86, 'Aucune carte en main', 11, '#8ba9b9');
        this.paletteGraphics = g;
        this.refreshPaletteSelection();
        this.note = this.text(l.m + 13, l.mainBottom - 75, 'Économie ECS : test actif', 11, '#a5b8c6');
        this.shardLabel = this.text(l.m + 13, l.mainBottom - 47,
            `ÉCLATS DE MÉMOIRE  ${OverseerVNextMemoryShards.balance(this.saveStorage())}`, 11, '#f5b94f');
    },

    refreshPaletteSelection() {
        const g = this.paletteGraphics, l = this.layout;
        if (!g) return;
        g.clear();
        OverseerVNextCards.cards(this.model).forEach((typeId, i) => {
            const type = OverseerVNextBuildings.getBuilding(typeId);
            const x = l.m + 12, y = l.mainTop + 76 + 75 * i;
            const cw = l.leftW - 24;
            const chosen = this.selectedType === type.id;
            g.fillStyle(chosen ? 0x133448 : 0x0b1c29).fillRoundedRect(x, y, cw, 65, 5);
            g.lineStyle(1, chosen ? 0x55cce0 : 0x1b3c4d).strokeRoundedRect(x, y, cw, 65, 5);
            this.drawGlyph(g, type.id, x + 29, y + 32, type.color, 14);
        });
    },

    drawBoard() {
        const l = this.layout;
        this.text(l.boardX + 16, l.mainTop + 17, 'BASE  5 × 5', 15);
        this.drawVisionUpgrade();
        const usableH = l.mainBottom - l.mainTop;
        const gridSize = Math.max(110, Math.min(l.boardW - 26, usableH - 119));
        const cell = gridSize / 5;
        const x = l.boardX + (l.boardW - gridSize) / 2;
        const y = l.mainTop + 50 + Math.max(0, (usableH - 120 - gridSize) / 2);
        this.gridLayout = { x, y, size: gridSize, cell };
        this.boardGraphics = this.keep(this.add.graphics());
        for (let index = 0; index < 25; index++) {
            const cx = x + (index % 5 + 0.5) * cell;
            const cy = y + (Math.floor(index / 5) + 0.5) * cell;
            const hit = this.keep(this.add.zone(cx, cy, cell, cell).setInteractive({ useHandCursor: true }));
            hit.on('pointerdown', () => this.clickTile(index));
            hit.on('pointerover', () => {
                const building = OverseerVNextPreview.buildingAt(this.model, index);
                const name = building ? this.types.find(t => t.id === this.world.get(building, 'Building').type)?.label : null;
                const active = this.world.get(this.model.tiles[index], 'Watched').active;
                const production = building ? this.world.get(building, 'Production') : null;
                this.boardHint.setText(name ? `${name} · ${active ? (production?.blocked ? 'EN ATTENTE DE RESSOURCES' : 'ACTIF') : 'INACTIF'}` : 'Emplacement libre');
                this.showBuildingTooltip(index);
            });
            hit.on('pointerout', () => {
                this.hideBuildingTooltip();
                this.updateBoardHint();
            });
        }
        this.boardHint = this.text(l.boardX + 15, l.mainBottom - 42, '', 11, '#98b5c7');
        this.updateBoardHint();
    },

    drawVisionUpgrade() {
        const l = this.layout;
        // Keep it inside the base panel; the top HUD remains usable at 800px.
        const x = l.boardX + l.boardW - 15;
        this.visionUpgradeButton = this.text(x, l.mainTop + 16, '▲ VISION', 11)
            .setOrigin(1, 0).setInteractive({ useHandCursor: true });
        this.visionUpgradeButton.on('pointerdown', () => this.tryUpgradeVision());
        this.visionUpgradeCostLabel = this.text(x, l.mainTop + 35, '', 10)
            .setOrigin(1, 0);
        this.updateVisionUpgradeButton();
    },

    drawGlyph(g, type, x, y, color, r) {
        g.lineStyle(2, color, 1);
        if (type === 'reactor') g.strokeCircle(x, y, r * 0.75);
        else if (type === 'cryopump') {
            g.strokeCircle(x,y,r*0.45);
            for(const a of [0,Math.PI/3,2*Math.PI/3]) {
                const dx=Math.cos(a)*r,dy=Math.sin(a)*r;
                g.lineBetween(x-dx,y-dy,x+dx,y+dy);
            }
        } else if (type === 'perception_amplifier') {
            g.strokeCircle(x, y, r * 0.48);
            g.strokeCircle(x, y, r * 0.82);
            g.lineBetween(x - r, y, x - r * 0.8, y);
            g.lineBetween(x + r * 0.8, y, x + r, y);
        } else if (type === 'extractor') {
            g.strokeEllipse(x, y, r * 1.5, r * 0.95);
            g.lineBetween(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
        } else if (type === 'factory') {
            const points = Array.from({ length: 6 }, (_, i) => ({
                x: x + Math.cos(Math.PI * i / 3) * r,
                y: y + Math.sin(Math.PI * i / 3) * r
            }));
            g.strokePoints(points, true);
        } else if (type === 'compute_node') {
            g.strokeRect(x - r * 0.65, y - r * 0.65, r * 1.3, r * 1.3);
            g.strokeCircle(x, y, r * 0.28);
            g.lineBetween(x - r, y, x - r * 0.65, y);
            g.lineBetween(x + r * 0.65, y, x + r, y);
        } else if (type === 'laboratory') {
            g.strokePoints([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], true);
        } else if (type === 'maintenance') {
            g.strokeCircle(x,y,r*0.78);
            g.lineBetween(x-r*0.4,y,x+r*0.4,y);
            g.lineBetween(x,y-r*0.4,x,y+r*0.4);
        } else {
            g.strokeRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
        }
    },

    paintBoard() {
        if (!this.boardGraphics || !this.gridLayout) return;
        const g = this.boardGraphics;
        g.clear();
        const { x, y, size, cell } = this.gridLayout;
        if(OverseerVNextZones.active(this.model,'overload')) {
            const title=this.boardHint;
            if(title)title.setColor('#f5b94f');
        } else if(this.boardHint)this.boardHint.setColor('#8eaaba');
        g.lineStyle(1, 0x214052, 0.32);
        for (let i = 0; i <= 5; i++) {
            g.lineBetween(x + cell * i, y, x + cell * i, y + size);
            g.lineBetween(x, y + cell * i, x + size, y + cell * i);
        }
        const point = index => ({ x: x + (index % 5 + 0.5) * cell, y: y + (Math.floor(index / 5) + 0.5) * cell });
        for (let i = 0; i < 25; i++) {
            const p = point(i);
            const watched = this.world.get(this.model.tiles[i], 'Watched').active;
            // Attention must remain legible even when no building occupies the tile.
            // These markers are visual only: the Watched ECS component owns activation.
            if (watched && OverseerVNextPreview.buildingAt(this.model, i) === null) {
                g.fillStyle(0x75d8e6, 0.95).fillCircle(p.x, p.y, 5.5);
                g.lineStyle(1, 0x75d8e6, 0.5).strokeCircle(p.x, p.y, 11);
            } else if (!watched) {
                g.fillStyle(0x315269, 0.7).fillCircle(p.x, p.y, 2.5);
            }
        }
        g.lineStyle(2, 0x55d6e8, 0.75);
        OverseerVNextPreview.attentionLinks(this.model).forEach(([a, b]) => {
            const pa = point(a), pb = point(b);
            g.lineBetween(pa.x, pa.y, pb.x, pb.y);
        });
        const relay=OverseerVNextArtifactEffects.state(this.model).relayTarget;
        if(relay!==null&&relay!==undefined&&OverseerVNextArtifactEffects.relayActive(this.model,relay)){
            const relaySlot=this.world.get(relay,'GridSlot').index;
            const neighboring=this.model.tiles.map((tile,i)=>({tile,i}))
              .filter(({tile,i})=>this.world.get(tile,'Watched').active&&
                Math.abs(i%5-relaySlot%5)+Math.abs(Math.floor(i/5)-Math.floor(relaySlot/5))===1);
            if(neighboring.length){
                const source=point(neighboring[0].i),target=point(relaySlot);
                g.lineStyle(1.5,0xb58aff,0.82).lineBetween(source.x,source.y,target.x,target.y);
            }
        }
        // Subtle links expose which observed neighbors benefit from each Cryopump.
        const pumps = OverseerVNextCooling.pumps(this.model);
        const cooled = OverseerVNextCooling.bonuses(this.model);
        for (const pump of pumps) {
            const from = point(this.world.get(pump, 'GridSlot').index);
            for (const [id, rate] of Object.entries(cooled)) {
                if (!rate || Number(id) === pump || !OverseerVNextCooling.cooled(this.model, Number(id), [pump])) continue;
                const to = point(this.world.get(Number(id), 'GridSlot').index);
                g.lineStyle(1, 0x87b9e8, 0.48).lineBetween(from.x, from.y, to.x, to.y);
            }
        }
        this.world.query('Building', 'GridSlot').forEach(id => {
            const slot = this.world.get(id, 'GridSlot').index;
            const p = point(slot);
            const type = this.world.get(id, 'Building').type;
            const style = this.types.find(t => t.id === type);
            if (!style) return;
            const active = this.world.get(this.model.tiles[slot], 'Watched').active;
            g.fillStyle(0x08121c, 1).fillCircle(p.x, p.y, cell * 0.31);
            g.lineStyle(active ? 2.5 : 1.5, style.color, active ? 1 : 0.34);
            g.strokeCircle(p.x, p.y, cell * 0.29);
            if (active) {
                g.lineStyle(1, 0x67e5e7, 0.7).strokeCircle(p.x, p.y, cell * 0.36);
            }
            const relayed=OverseerVNextArtifactEffects.relayActive(this.model,id);
            if(relayed)g.lineStyle(1.5,0xb58aff,0.85).strokeCircle(p.x,p.y,cell*0.36);
            this.drawGlyph(g, type, p.x, p.y, active ? style.color : 0x5b7687, cell * 0.18);
            if(OverseerVNextCooling.bonus(this.model,id)>0)
                g.lineStyle(1,0x87b9e8,0.65).strokeCircle(p.x,p.y,cell*0.34);
            const progress = this.world.get(id, 'Production') ||
                (type === 'laboratory' ? this.world.get(id, 'Research') :
                 type === 'maintenance' ? this.world.get(id,'MaintenanceCycle') : null);
            const progressDuration = type === 'laboratory' ? OverseerVNextTechnologies.RESEARCH_MS :
                type === 'maintenance' ? OverseerVNextMaintenance.CYCLE_MS : progress?.cooldownMs;
            if ((active || relayed) && progress && progressDuration > 0) {
                // Small progress indicator, driven by ECS state, not a Phaser timer.
                const px = p.x - cell * 0.25, py = p.y + cell * 0.36, pw = cell * 0.5;
                g.fillStyle(0x294354, 0.8).fillRect(px, py, pw, 3);
                g.fillStyle(progress.blocked ? 0xff6674 : 0x62e7e1, 0.95)
                    .fillRect(px, py, pw * Math.min(1, progress.elapsedMs / progressDuration), 3);
            }
            if (id === this.movingId) g.lineStyle(2, 0xffffff, 0.9).strokeCircle(p.x, p.y, cell * 0.4);
        });
    },

    clearProductionPopups() {
        for (const popup of this.productionPopups || []) {
            popup.icon.destroy();
            popup.label.destroy();
        }
        this.productionPopups = [];
    },

    showProductionPopup(event) {
        if (event.type !== 'production' || !this.world.has(event.building) || !this.gridLayout) return;
        const slot = this.world.get(event.building, 'GridSlot')?.index;
        if (!Number.isInteger(slot) || slot < 0 || slot >= 25) return;
        const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[event.buildingType];
        if (!recipe) return;
        const { x, y, cell } = this.gridLayout;
        const cx = x + (slot % 5 + 0.5) * cell;
        const cy = y + (Math.floor(slot / 5) + 0.5) * cell;
        for (const [resource, amount] of Object.entries(recipe.produces)) {
            if (!amount || resource.startsWith('unit_')) continue;
            const style = this.resourceStyles.find(item => item.id === resource && !item.pending);
            if (!style) continue;
            const icon = this.add.graphics().setDepth(100);
            this.drawResourceIcon(icon, style, cx - 15, cy - cell * 0.29, 7);
            const label = this.add.text(cx - 4, cy - cell * 0.29 - 8, `+${amount}`, {
                fontFamily: 'monospace', fontSize: '12px',
                color: `#${style.color.toString(16).padStart(6, '0')}`
            }).setDepth(100);
            this.productionPopups.push({ icon, label, elapsedMs: 0, startY: cy - cell * 0.29 });
        }
        while (this.productionPopups.length > 24) {
            const oldest = this.productionPopups.shift();
            oldest.icon.destroy();
            oldest.label.destroy();
        }
    },

    showNetworkPopup(event) {
        if(!this.gridLayout||!this.world.has(event.building))return;
        const slot=this.world.get(event.building,'GridSlot')?.index;
        if(!Number.isInteger(slot))return;
        const {x,y,cell}=this.gridLayout;
        const cx=x+(slot%5+0.5)*cell,cy=y+(Math.floor(slot/5)+0.5)*cell;
        const icon=this.add.graphics().setDepth(100);
        icon.lineStyle(1.5,0xb58aff,0.85).strokeCircle(cx-15,cy-cell*0.29,6);
        const recipe=OverseerVNextEconomy.PROTOTYPE_RECIPES[this.world.get(event.building,'Building')?.type];
        const pct=recipe?Math.round(event.gainedMs/recipe.cycleMs*100):0;
        const label=this.add.text(cx-4,cy-cell*0.29-8,`+${pct}%`,{
            fontFamily:'monospace',fontSize:'12px',color:'#b58aff'
        }).setDepth(100);
        this.productionPopups.push({icon,label,elapsedMs:0,startY:cy-cell*0.29});
        while(this.productionPopups.length>24) {
            const oldest=this.productionPopups.shift();
            oldest.icon.destroy();oldest.label.destroy();
        }
    },

    updateProductionPopups(delta) {
        if (delta <= 0) return;
        for (const popup of this.productionPopups) {
            popup.elapsedMs += delta;
            const progress = Math.min(1, popup.elapsedMs / 850);
            const rise = progress * 24;
            const alpha = 1 - progress;
            popup.icon.setY(-rise).setAlpha(alpha);
            popup.label.setY(popup.startY - 8 - rise).setAlpha(alpha);
        }
        this.productionPopups = this.productionPopups.filter(popup => {
            if (popup.elapsedMs < 850) return true;
            popup.icon.destroy();
            popup.label.destroy();
            return false;
        });
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextBoardView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
