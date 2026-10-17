// Phaser rendering of ECS combat state: geometry, layers, clipping and effects.
// Simulation, combat decisions and ownership of ECS entities stay outside this module.
(function (root) {
    'use strict';
    const methods = {
        releaseBattleView() {
            this.battleMask?.destroy();
            this.battleMask = null;
        },

    drawBattlePanel() {
        const l = this.layout;
        this.text(l.battleX + 15, l.mainTop + 17, 'CHAMP DE BATAILLE', 15);
        const { battleX, battleW, mainTop, mainBottom } = l;
        this.battleBounds = { x: battleX + 12, y: mainTop + 48, w: battleW - 24, h: mainBottom - mainTop - 96 };
        const g = this.keep(this.add.graphics());
        const b = this.battleBounds;
        g.lineStyle(1, 0x1c3949, 0.5).lineBetween(b.x + b.w * 0.52, b.y, b.x + b.w * 0.52, b.y + b.h);
        this.zoneGraphics = this.keep(this.add.graphics());
        this.battleGraphics = this.keep(this.add.graphics());
        this.battleParticleGraphics = this.keep(this.add.graphics());
        this.battleActionGraphics = this.keep(this.add.graphics());
        // A geometry mask clips every battlefield effect, including large detection rings.
        // Mask geometry is defined in screen coordinates and rebuilt on resize.
        this.battleMaskGraphic = this.keep(this.add.graphics());
        this.battleMaskGraphic.fillStyle(0xffffff, 1)
            .fillRect(b.x, b.y, b.w, b.h)
            .setVisible(false);
        this.battleMask = this.battleMaskGraphic.createGeometryMask();
        for (const graphics of [this.zoneGraphics, this.battleGraphics,
            this.battleParticleGraphics, this.battleActionGraphics]) {
            graphics.setMask(this.battleMask);
        }
        // One interactive input surface, not one Phaser hit area per moving ECS unit.
        this.battleHoverZone = this.keep(this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h)
            .setInteractive().setDepth(100));
        this.battleHoverZone.on('pointerover', pointer => this.onBattleUnitPointer(pointer));
        this.battleHoverZone.on('pointermove', pointer => this.onBattleUnitPointer(pointer));
        this.battleHoverZone.on('pointerout', () => this.hideBattleUnitTooltip());
        this.battleStatus = this.text(l.battleX + 15, mainBottom - 38, '', 11, '#8eabbc');
    },

    battleUnitStyle(id) {
        const type = this.world.get(id, 'PreviewUnit')?.type;
        const side = this.world.get(id, 'Faction')?.side;
        return OverseerBattleUnitStyles.styleFor(type, side);
    },

    drawBattleUnit(g, style, x, y, r, color) {
        g.lineStyle(2, color, 0.98);
        if (style.shape === 'shield') {
            g.strokePoints([
                { x, y: y - r }, { x: x + r * 0.78, y: y - r * 0.52 },
                { x: x + r * 0.63, y: y + r * 0.4 }, { x, y: y + r },
                { x: x - r * 0.63, y: y + r * 0.4 }, { x: x - r * 0.78, y: y - r * 0.52 }
            ], true);
        } else if (style.shape === 'diamond') {
            g.strokePoints([
                { x, y: y - r }, { x: x + r * 0.65, y },
                { x, y: y + r }, { x: x - r * 0.65, y }
            ], true);
            g.lineStyle(1, color, 0.9).lineBetween(x - r, y, x + r, y);
        } else if (style.shape === 'hexagon') {
            g.strokePoints(Array.from({ length: 6 }, (_, i) => {
                const a = (i * Math.PI / 3) + Math.PI / 6;
                return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
            }), true);
            g.fillStyle(color, 0.62).fillRect(x - r * 0.32, y - r * 0.32, r * 0.64, r * 0.64);
        } else if (style.shape === 'drone') {
            g.strokeCircle(x, y, r * 0.75);
            g.lineStyle(1, color, 0.85).lineBetween(x - r * 0.34, y, x + r * 0.34, y);
            g.lineBetween(x, y - r * 0.34, x, y + r * 0.34);
        } else if (style.shape === 'triangle') {
            g.strokeTriangle(x, y - r, x + r, y + r, x - r, y + r);
        } else {
            g.strokeCircle(x, y, r * 0.8);
            g.fillStyle(color, 0.5).fillCircle(x, y, r * 0.26);
        }
    },

    paintTechnologyZones(dt=0) {
        const g=this.zoneGraphics,b=this.battleBounds;
        if(!g||!b)return;
        g.clear();
        const toScreen=(x,y)=>({x:b.x+x*b.w/1000,y:b.y+y*b.h/600});
        for(const id of this.world.query('TechnologyZone')) {
            const zone=this.world.get(id,'TechnologyZone'),p=toScreen(zone.x,zone.y);
            const r=zone.radius*b.w/1000;
            const stasis=zone.type==='stasis_field',emp=zone.type==='emp_field';
            const color=emp?0xb5a7ff:stasis?0x87b9e8:0x69d9a0;
            g.fillStyle(color,0.09).fillCircle(p.x,p.y,r);
            g.lineStyle(1.5,color,0.75).strokeCircle(p.x,p.y,r);
            if(emp){g.lineStyle(1,color,0.45).strokeCircle(p.x,p.y,r*0.72);}
            if(stasis||emp)continue;
            // Decorative plus particles are renderer-only, independent of healing ticks.
            if(dt>0 && this.zoneParticles.length<36) {
                const angle=Math.random()*Math.PI*2,rad=Math.sqrt(Math.random())*r;
                this.zoneParticles.push({x:p.x+Math.cos(angle)*rad,y:p.y+Math.sin(angle)*rad,life:700});
            }
        }
        for(const zone of OverseerVNextArtifactEffects.state(this.model).corrosionZones||[]) {
            const p=toScreen(zone.x,zone.y),r=65*b.w/1000;
            g.fillStyle(0x91bb70,0.11).fillCircle(p.x,p.y,r);
            g.lineStyle(1,0x91bb70,0.7).strokeCircle(p.x,p.y,r);
        }
        this.zoneParticles=this.zoneParticles.filter(p=>p.life>0);
        for(const p of this.zoneParticles) {
            p.y-=dt*0.018;p.life-=dt;
            g.lineStyle(1,0x9ff3bb,Math.max(0,p.life/700));
            g.lineBetween(p.x-3,p.y,p.x+3,p.y);g.lineBetween(p.x,p.y-3,p.x,p.y+3);
        }
    },

    baseHealthColor() {
        // Three readable states, intentionally without pulsing or decorative animation.
        if (this.baseHp <= 25) return 0xff6674;
        if (this.baseHp <= 60) return 0xf0ba60;
        return 0x48b8c4;
    },

    detectionColor() {
        // One HP-dependent hue for both passive detection and the radar wave.
        // Mixing a little white improves legibility without changing the core hue.
        const color = this.baseHealthColor();
        const lighten = channel => Math.round(channel + (255 - channel) * 0.35);
        return (lighten((color >> 16) & 255) << 16) |
            (lighten((color >> 8) & 255) << 8) | lighten(color & 255);
    },

    coreSignalPoints(x, y, timeMs = this.waveClock?.elapsedMs || 0) {
        // Pure presentation geometry, driven by saved simulation time (not wall time).
        // An undulating perimeter stays legible when healthy; deterministic higher
        // harmonics become increasingly prominent as the core loses integrity.
        const damage = 1 - Math.max(0, Math.min(this.world.get(this.model.game,'DefenseTalents')?.reinforced?120:100, this.baseHp)) / (this.world.get(this.model.game,'DefenseTalents')?.reinforced?120:100);
        const noise = Math.pow(damage, 1.2);
        const phase = timeMs / 1000;
        const points = [];
        const segments = 96;
        for (let i = 0; i < segments; i++) {
            const angle = 2 * Math.PI * i / segments;
            const wave = 1.25 * Math.sin(6 * angle - phase * 1.6);
            const interference = noise * (
                1.7 * Math.sin(17 * angle + phase * 2.4) +
                1.3 * Math.sin(31 * angle - phase * 3.1) +
                0.9 * Math.sin(43 * angle + phase * 4.7)
            );
            // r > 15 even at zero HP; never obscures the radius-12 core.
            const radius = 21 + wave + interference;
            points.push({ x: x + Math.cos(angle) * radius,
                          y: y + Math.sin(angle) * radius });
        }
        return points;
    },

    paintBattle() {
        if (!this.battleGraphics || !this.battleBounds) return;
        const g = this.battleGraphics, b = this.battleBounds;
        this.paintTechnologyZones(this.zoneFrameMs||0);
        this.zoneFrameMs=0;
        g.clear();
        const p = (x, y) => ({ x: b.x + b.w * x / 1000, y: b.y + b.h * y / 600 });
        const base = p(65, 300);
        const coreColor = this.baseHealthColor();
        const sensorColor = this.detectionColor();
        if (OverseerVNextThreats.active(this.model)) {
            // The regular 350-unit detection still works, but is hidden while the
            // amplifier sweeps. Phaser renders a true circular radar from the core.
            const progress = OverseerVNextThreats.sweepRadius(this.model) /
                OverseerVNextThreats.PULSE.maxRadius;
            if (progress > 0) {
                // Reach every panel corner before the wave vanishes and restarts.
                // World-to-screen is anisotropic: this is explicitly the visual
                // circle, while threat marking remains in deterministic ECS space.
                const maxDx = Math.max(base.x - b.x, b.x + b.w - base.x);
                const maxDy = Math.max(base.y - b.y, b.y + b.h - base.y);
                const outerRadius = Math.hypot(maxDx, maxDy) + 8;
                const ringRadius = progress * outerRadius;
                g.lineStyle(5, sensorColor, 0.08).strokeCircle(base.x, base.y, ringRadius);
                g.lineStyle(1.7, sensorColor, 0.72).strokeCircle(base.x, base.y, ringRadius);
            }
        } else {
            const detectionRadius = OverseerVNextThreats.radius(this.model) * b.w / 1000;
            g.lineStyle(1, sensorColor, 0.44)
                .strokeCircle(base.x, base.y, detectionRadius);
        }
        if (OverseerVNextArtifactEffects.state(this.model).shieldPoints > 0) {
            g.lineStyle(2, 0x69d9a0, 0.9).strokeCircle(base.x, base.y, 29);
        }
        g.lineStyle(2, coreColor, 0.82).strokeCircle(base.x, base.y, 12);
        g.lineStyle(1, coreColor, 0.55)
            .strokePoints(this.coreSignalPoints(base.x, base.y), true);
        const healthWidth = Math.min(62, b.w - 6);
        const healthX = Math.max(b.x + 3, Math.min(base.x - healthWidth / 2,
            b.x + b.w - healthWidth - 3));
        const healthY = base.y - 37;
        g.fillStyle(0x203b49, 1).fillRect(healthX, healthY, healthWidth, 5);
        g.fillStyle(coreColor, 1).fillRect(healthX, healthY,
            healthWidth * Math.max(0, Math.min(1, this.baseHp / (this.world.get(this.model.game,'DefenseTalents')?.reinforced?120:100))), 5);
        for (const id of this.battleUnits) {
            if (!this.world.has(id)) continue;
            const hp = this.world.get(id, 'Health');
            if (hp.hp <= 0) continue;
            const pos = this.world.get(id, 'Position');
            const side = this.world.get(id, 'Faction').side;
            const q = p(pos.x, pos.y);
            const r = Math.min(12, Math.max(6, b.w * 0.024));
            // One shared, dimensionless reaction can move a 2D glyph or a future 3D model.
            const visual = this.hitEffects.view(id);
            q.x += visual.x * r;
            q.y += visual.y * r;
            const style = this.battleUnitStyle(id);
            const color = OverseerHitEffects.tintColor(style.color, visual.flash);
            const berserk=this.world.get(id,'TechnologyBuff')?.type==='berserk';
            if(side==='player' && OverseerVNextZones.active(this.model,'overclock')) {
                g.lineStyle(1,0x62e7e1,0.65).strokeCircle(q.x,q.y,r*1.45);
            }
            if(berserk){g.lineStyle(1,0xf4a261,0.8).strokeCircle(q.x,q.y,r*1.5);}
            if(this.world.get(id,'DefectiveUnit'))g.lineStyle(1,0xf4ba58,0.9).strokeCircle(q.x,q.y,r*1.6);
            this.drawBattleUnit(g, style, q.x, q.y, (berserk ? r * 1.16 : r) * (style.size || 1), color);
            if(this.world.hasComponent(id,'TemporaryAlly')) {
                g.lineStyle(1,0x44dc91,0.7).strokeCircle(q.x,q.y,r*1.65);
            }
            if (side === 'enemy' && this.world.get(id, 'GuardPriority')) {
                g.lineStyle(2,0x62e7e1,0.88).strokeRect(q.x-r-6,q.y-r-6,(r+6)*2,(r+6)*2);
            }
            if (side === 'enemy' && this.world.get(id, 'ThreatMark')) {
                g.lineStyle(1.5, 0xff6674, 0.92).strokeRect(
                    q.x - r - 4, q.y - r - 4, (r + 4) * 2, (r + 4) * 2);
            }
            g.fillStyle(0x23404e, 0.8).fillRect(q.x - 11, q.y - r - 9, 22, 3);
            g.fillStyle(side === 'player' ? 0x44dc91 : 0xff5e79, 1)
                .fillRect(q.x - 11, q.y - r - 9, 22 * Math.max(0, hp.hp / hp.maxHp), 3);
        }
        // Draw fragments separately from the unit loop so a killing hit can outlive its target.
        const fragments = this.battleParticleGraphics;
        if (fragments) {
            fragments.clear();
            for (const bit of this.hitEffects.fragments()) {
                const q = p(bit.x, bit.y);
                if (q.x < b.x || q.x > b.x + b.w || q.y < b.y || q.y > b.y + b.h) continue;
                fragments.fillStyle(bit.color, bit.alpha);
                fragments.fillRect(q.x - bit.size / 2, q.y - bit.size / 2, bit.size, bit.size);
            }
        }
        const actions = this.battleActionGraphics;
        if (actions) {
            actions.clear();
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const within = point => ({
                x: clamp(point.x, b.x, b.x + b.w),
                y: clamp(point.y, b.y, b.y + b.h)
            });
            for (const effect of this.actionEffects.visuals()) {
                const start = within(p(effect.from.x, effect.from.y));
                const end = within(p(effect.to.x, effect.to.y));
                if (effect.kind === 'laser') {
                    actions.lineStyle(3, effect.color, effect.alpha * 0.27)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, 0xffffff, effect.alpha * 0.92)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, effect.color, effect.alpha)
                        .strokeCircle(end.x, end.y, 2.5);
                } else if (effect.kind === 'heal') {
                    // A repair is legible as support, never mistaken for damage recoil.
                    actions.lineStyle(2, effect.color, effect.alpha * 0.22)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    actions.lineStyle(1, effect.color, effect.alpha * 0.9)
                        .lineBetween(start.x, start.y, end.x, end.y);
                    const radius = 5 + 9 * effect.progress;
                    actions.lineStyle(1, effect.color, effect.alpha * 0.9)
                        .strokeCircle(end.x, end.y, radius);
                    for (let i = 0; i < 3; i++) {
                        const angle = (i * Math.PI * 2 / 3) + effect.progress * 1.4;
                        const orbit = 15 * (1 - effect.progress) + 2;
                        actions.fillStyle(effect.color, effect.alpha * 0.8).fillCircle(
                            end.x + Math.cos(angle) * orbit,
                            end.y + Math.sin(angle) * orbit, 1.6);
                    }
                }
            }
        }
        if (this.battleStatus) {
            const alive = side => this.battleUnits.filter(id => this.world.has(id) &&
                this.world.get(id, 'Faction').side === side && this.world.get(id, 'Health').hp > 0).length;
            this.battleStatus.setText(`Alliés ${alive('player')}   Menaces ${alive('enemy')}`);
        }
        this.refreshBattleUnitTooltip();
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextBattleView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
