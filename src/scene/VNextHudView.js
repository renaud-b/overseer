// Phaser-only presentation for HUD, artifact slots, resource throughput and technology inventory.
// ECS and reward decisions remain in existing gameplay systems.
(function (root) {
    'use strict';
    const methods = {
    drawArtifactSlots(w, titleRight) {
        const items = OverseerVNextArtifacts.list(this.model);
        const speedX = Math.max(330, w - 472);
        const size = Math.min(32, Math.max(18, Math.floor((speedX - 185 - 16 - 25) / 6)));
        const gap = size < 26 ? 4 : 6;
        const maxStart = speedX - 6 * size - 5 * gap - 12;
        // Give the brand 64px of breathing room where possible. On narrow
        // screens cap the offset to keep all six slots before speed controls.
        const start = Math.min(maxStart, titleRight + 64);
        this.artifactSlots = [];
        const graphics = this.keep(this.add.graphics());
        for (let i = 0; i < OverseerVNextArtifacts.CAPACITY; i++) {
            const x = start + i * (size + gap), y = 21;
            const artifact = OverseerVNextArtifacts.get(items[i]);
            graphics.fillStyle(artifact ? 0x153044 : 0x0a202d, 1).fillRoundedRect(x, y, size, size, 4);
            graphics.lineStyle(1, artifact ? artifact.color : 0x2d4858, 0.8)
                .strokeRoundedRect(x, y, size, size, 4);
            if (artifact) this.drawArtifactGlyph(graphics, artifact, x + size / 2, y + size / 2, size * 0.28);
            const zone = this.keep(this.add.zone(x + size / 2, y + size / 2, size, size).setInteractive());
            zone.setData('artifactSlot', i);
            zone.on('pointerover', () => this.showArtifactTooltip(items[i] || null, x, 68));
            zone.on('pointerout', () => this.hideArtifactTooltip());
            this.artifactSlots.push(zone);
        }
    },

    drawArtifactGlyph(g, artifact, x, y, r) {
        g.lineStyle(2, artifact.color, 0.95);
        if (artifact.symbol === 'triangle') g.strokeTriangle(x, y - r, x + r, y + r, x - r, y + r);
        else if (artifact.symbol === 'diamond') g.strokePoints([
            { x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }
        ], true);
        else if (artifact.symbol === 'cross') {
            g.lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r);
        } else {
            g.strokeCircle(x, y, r);
            g.lineBetween(x - r * 1.4, y, x + r * 1.4, y);
        }
    },

    drawSpeedControls(w) {
        const labels = [0, 1, 2, 3, 5];
        const startX = Math.max(330, w - 472);
        labels.forEach((speed, i) => {
            const x = startX + 50 * i;
            const label = this.text(x, 23, speed === 0 ? 'Ⅱ' : `×${speed}`, 15,
                this.speed === speed ? '#64e9ee' : '#97b7c9');
            label.setPadding(11, 5, 11, 5).setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => this.selectSpeed(speed));
        });
        const legacy = this.text(w - 183, 24, 'JEU ACTUEL ↗', 12, '#d4e4ee');
        legacy.setPadding(5).setInteractive({ useHandCursor: true });
        legacy.on('pointerdown', () => {
            if (this.saveCurrentGame()) this.scene.start('GameScene');
        });
        const settings = this.text(w - 223, 24, '⚙', 16, '#7b9aad');
        settings.setPadding(5).setInteractive({ useHandCursor: true });
        settings.on('pointerdown', () => this.openOptions());
        const menu = this.text(w - 59, 24, 'MENU', 12, '#7b9aad');
        menu.setPadding(5).setInteractive({ useHandCursor: true });
        menu.on('pointerdown', () => this.returnToMenu());
    },

    drawResourceIcon(g, style, x, y, radius = 10) {
        if (style.glyph !== 'cooling') {
            this.drawGlyph(g, style.glyph, x, y, style.color, radius);
            return;
        }
        // Three crossing axes make a compact, recognizable cold/snow symbol.
        g.lineStyle(1.8, style.color, 0.9);
        for (const angle of [0, Math.PI / 3, 2 * Math.PI / 3]) {
            const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
            g.lineBetween(x - dx, y - dy, x + dx, y + dy);
        }
    },

    drawCompactResources() {
        // Compact HUD lives under the grid, not on top of construction cards.
        const l = this.layout, x = l.boardX + 16;
        const startY = this.gridLayout.y + this.gridLayout.size + 12;
        const g = this.keep(this.add.graphics());
        this.compactResources = {};
        this.compactResourceDeltas = {};
        this.resourceStyles.filter(style => !style.pending).forEach((style, i) => {
            const y = startY + i * 21;
            this.drawResourceIcon(g, style, x + 8, y + 7, 8);
            const color = `#${style.color.toString(16).padStart(6, '0')}`;
            this.compactResources[style.id] = this.text(x + 25, y - 2, '0', 14, color);
            this.compactResourceDeltas[style.id] = this.text(l.boardX + l.boardW - 16, y, '—', 11, '#7898aa').setOrigin(1, 0);
            this.resourceHoverZone(style, x, y - 3, l.boardW - 32, 22, x + 7, y - 30);
        });
    },

    resourceHoverZone(style, x, y, w, h, tipX, tipY) {
        const zone = this.keep(this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive());
        zone.setData('resource', style.id);
        zone.on('pointerover', () => this.showResourceTooltip(style, tipX, tipY));
        zone.on('pointerout', () => this.hideResourceTooltip());
        return zone;
    },

    drawRightPanel() {
        const l = this.layout, x = l.rightX + 9;
        const g = this.resourceGraphics = this.keep(this.add.graphics());
        this.resourceLabels = {};
        this.resourceStatusLabels = {};
        this.resourceStyles.forEach((style, i) => {
            const y = l.mainTop + 24 + i * 34;
            this.drawResourceIcon(g, style, x + 8, y + 9, 8);
            this.resourceHoverZone(style, x - 4, y - 4, l.rightW - 10, 30, l.rightX - 190, y - 2);
            const color = style.pending ? '#67869b' : `#${style.color.toString(16).padStart(6, '0')}`;
            if (style.pending) {
                this.text(x + 21, y, '—', 15, color);
                return;
            }
            this.resourceLabels[style.id] = this.text(x + 21, y - 2, '0', 15, color);
            this.resourceStatusLabels[style.id] = this.text(l.rightX + l.rightW - 8, y + 1, '—', 10, '#7898aa').setOrigin(1, 0);
        });
    },

    // Statuses report real ECS activation/blockage. The rate indicator uses
    // actual balance changes over simulation time, not projected recipe output.

    drawTechnologies() {
        const l=this.layout, right=Boolean(l.rightW);
        const x=right?l.rightX+12:l.boardX+16;
        const y=right?l.mainTop+223:this.gridLayout.y+this.gridLayout.size+125;
        const items=OverseerVNextTechnologies.inventory(this.model).items;
        if(!right && l.leftW<165)return;
        this.text(x,y,'TECHNOLOGIES',12,'#b58aff');
        const styles=[['healing_field','✚ SOIN',0x69d9a0],['berserk','⚡ BERSERK',0xf4a261],['stasis_field','◌ STASE',0x87b9e8],['overclock','» SURCAD.',0x62e7e1],['overload','↑ SURCHARGE',0xf5b94f],['emp_field','◇ EMP',0xb5a7ff],['reinforcements','+ RENFORTS',0x44dc91]];
        let row=0;
        for(const [type,name,color] of styles){
            const count=items.filter(item=>item===type).length;
            if(!count)continue;
            const label=this.text(x+3,y+28+row*32,`${name} ×${count}`,11,`#${color.toString(16).padStart(6,'0')}`);
            label.setPadding(3,5,3,5).setInteractive({useHandCursor:true});
            label.setData('technology',type);
            label.on('pointerover', () => this.showTechnologyTooltip(type, right ? l.rightX - 298 : x + 110, label.y - 8));
            label.on('pointerout', () => this.hideTechnologyTooltip());
            this.input.setDraggable(label);row++;
        }
        if(!row)this.text(x,y+28,'Aucune disponible',10,'#7898aa');
    },

    // Coordinates in the simulation's 1000×600 battlefield space.

    resourceActivity(source) {
        const buildings = this.world.query('Building', 'GridSlot')
            .filter(id => this.world.get(id, 'Building').type === source);
        if (!buildings.length) return 'AUCUN BÂTIMENT';
        const active = buildings.filter(id => {
            const slot = this.world.get(id, 'GridSlot').index;
            return this.world.get(this.model.tiles[slot], 'Watched').active;
        });
        if (!active.length) return 'HORS VISION';
        if (active.every(id => this.world.get(id, 'Production')?.blocked)) return 'EN ATTENTE';
        return 'PRODUCTION ACTIVE';
    },

    noteResourceChanges(previous, dt) {
        // Only samples taken around an actual economy step count. Card grants and
        // direct resource edits never become fake production or consumption rates.
        this.resourceRateClockMs += dt;
        const balance = this.world.get(this.model.game, 'Resources');
        const changes = {};
        for (const id of ['energy', 'matter', 'components', 'data']) {
            const change = balance[id] - previous[id];
            if (change) changes[id] = change;
        }
        if (Object.keys(changes).length) {
            this.resourceRateHistory.push({ atMs: this.resourceRateClockMs, changes });
        }
        const cutoff = this.resourceRateClockMs - 6000;
        while (this.resourceRateHistory.length && this.resourceRateHistory[0].atMs <= cutoff) {
            this.resourceRateHistory.shift();
        }
    },

    resourceRatePerSecond(id) {
        // Simulation seconds, so x1/x3/x5 change how fast time passes, not the units.
        const windowMs = Math.min(6000, this.resourceRateClockMs);
        if (windowMs <= 0) return 0;
        const net = this.resourceRateHistory.reduce((sum, item) =>
            sum + (item.changes[id] || 0), 0);
        return net * 1000 / windowMs;
    },

    updateResourceHud() {
        if (!this.model || !this.world.hasComponent(this.model.game, 'Resources')) return;
        const balance = this.world.get(this.model.game, 'Resources');
        this.updateVisionUpgradeButton();
        for (const style of this.resourceStyles) {
            if (style.pending) continue;
            if(style.flow) {
                const coverage=OverseerVNextCooling.coverage(this.model);
                this.resourceLabels[style.id]?.setText(String(coverage.buildings));
                this.compactResources?.[style.id]?.setText(String(coverage.buildings));
                for(const status of [this.resourceStatusLabels[style.id],this.compactResourceDeltas?.[style.id]]) {
                    status?.setText(`${coverage.pumps} CRYO`);
                    status?.setColor('#87b9e8');
                }
                continue;
            }
            this.resourceLabels[style.id]?.setText(String(balance[style.id]));
            this.compactResources?.[style.id]?.setText(String(balance[style.id]));
            const rate = Number(this.resourceRatePerSecond(style.id).toFixed(1));
            const delta = `${rate > 0 ? '+' : ''}${rate.toFixed(1)}/s`;
            const color = rate > 0 ? '#69e5ac' : rate < 0 ? '#ff6674' : '#7898aa';
            for (const status of [this.resourceStatusLabels[style.id], this.compactResourceDeltas?.[style.id]]) {
                status?.setText(delta);
                status?.setColor(color);
            }
        }
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextHudView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
