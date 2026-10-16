// Presentation-only tooltip methods. They read ECS data but never own simulation state.
// Installed on VNextScene for compatibility with existing Phaser handlers and tests.
(function (root) {
    'use strict';
    const methods = {
    hideArtifactTooltip() {
        (this.artifactTooltipObjects || []).forEach(object => object.destroy());
        this.artifactTooltipObjects = [];
    },

    showArtifactTooltip(id, anchorX, anchorY, depth = 240) {
        this.hideArtifactTooltip();
        const artifact = OverseerVNextArtifacts.get(id);
        const width = 280, height = artifact ? 112 : 66;
        const x = Math.max(8, Math.min(this.scale.width - width - 8, anchorX));
        const y = Math.max(72, Math.min(this.scale.height - height - 8, anchorY));
        const g = this.add.graphics().setDepth(depth);
        g.fillStyle(0x0b1d2b, 1).fillRoundedRect(x, y, width, height, 6);
        g.lineStyle(1, artifact ? artifact.color : 0x2d4858, 0.85)
            .strokeRoundedRect(x, y, width, height, 6);
        this.artifactTooltipObjects.push(g);
        const label = (value, offset, size, color) => this.artifactTooltipObjects.push(
            this.add.text(x + 13, y + offset, value, { fontFamily: 'monospace', fontSize: `${size}px`,
                color, wordWrap: { width: width - 26 } }).setDepth(depth + 1));
        label(artifact?.label || 'Emplacement vide', 12, 14, '#dfeaf0');
        label(artifact?.description || 'Un artefact obtenu apparaîtra ici.', 37, 11, '#9cb9c9');
        if (artifact) label('EFFET PASSIF ACTIF', 91, 10, '#69d9a0');
    },

    hideBuildingTooltip() {
        for (const object of this.tooltipObjects || []) object.destroy();
        this.tooltipObjects = [];
        this.hoveredTile = null;
    },

    hideTechnologyTooltip() {
        for (const object of this.technologyTooltipObjects || []) object.destroy();
        this.technologyTooltipObjects = [];
    },

    showTechnologyTooltip(type, anchorX, anchorY, depth = 220) {
        this.hideTechnologyTooltip();
        // Keep displayed numbers in sync with the simulation, not HUD estimates.
        const { HEAL, BERSERK, STASIS, OVERCLOCK, OVERLOAD, EMP, REINFORCEMENTS } = OverseerVNextZones;
        const descriptions = {
            healing_field: {
                title: 'RÉGÉNÉRATION', color: 0x69d9a0,
                lines: [
                    'Soigne les alliés dans une zone',
                    `Rayon : ${HEAL.radius}`,
                    `+${HEAL.amount} PV toutes les ${HEAL.intervalMs / 1000} s`,
                    `Durée : ${HEAL.durationMs / 1000} s`
                ]
            },
            berserk: {
                title: 'BERSERK', color: 0xf4a261,
                lines: [
                    `Jusqu'à ${BERSERK.targets} alliés aléatoires`,
                    `Cadence d'attaque : +${Math.round((BERSERK.attackMultiplier - 1) * 100)} %`,
                    `Durée : ${BERSERK.durationMs / 1000} s`,
                    'Sans effet si aucun allié vivant'
                ]
            },
            stasis_field: {
                title: 'STASE', color: 0x87b9e8,
                lines: [
                    'Ralentit les ennemis dans la zone',
                    `Rayon : ${STASIS.radius}`,
                    `Vitesse : -${Math.round((1 - STASIS.speedMultiplier) * 100)} %`,
                    `Durée : ${STASIS.durationMs / 1000} s`
                ]
            },
            overclock: {
                title: 'SURCADENCEMENT', color: 0x62e7e1,
                lines: [
                    'Accélère tous les alliés',
                    `Déplacement : +${Math.round((OVERCLOCK.speedMultiplier - 1) * 100)} %`,
                    `Durée : ${OVERCLOCK.durationMs / 1000} s`,
                    'Sans bonus de cadence de tir'
                ]
            },
            overload: {
                title: 'SURCHARGE', color: 0xf5b94f,
                lines: [
                    'Bâtiments sous vision uniquement',
                    `Production : ×${OVERLOAD.productionMultiplier}`,
                    `Durée : ${OVERLOAD.durationMs / 1000} s`,
                    'Laboratoire exclu'
                ]
            },
            emp_field: {
                title: 'IMPULSION ÉLECTROMAGNÉTIQUE', color: 0xb5a7ff,
                lines: [
                    'Immobilise les ennemis dans la zone',
                    `Rayon : ${EMP.radius}`,
                    `Durée : ${EMP.durationMs / 1000} s`,
                    'Les ennemis peuvent toujours attaquer'
                ]
            },
            reinforcements: {
                title: 'RENFORTS', color: 0x44dc91,
                lines: [
                    'Invoque 1 soldat allié sur la zone',
                    `Durée : ${REINFORCEMENTS.durationMs / 1000} s`,
                    'Sans coût en ressources',
                    'Sans occuper une place de Caserne'
                ]
            }
        };
        const info = descriptions[type];
        if (!info) return;
        const width = 290, height = 176;
        const x = Math.max(8, Math.min(this.scale.width - width - 8, anchorX));
        const y = Math.max(72, Math.min(this.scale.height - height - 8, anchorY));
        const keep = object => { this.technologyTooltipObjects.push(object); return object; };
        const g = keep(this.add.graphics().setDepth(depth));
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(x, y, width, height, 6);
        g.lineStyle(1, info.color, 0.8).strokeRoundedRect(x, y, width, height, 6);
        const label = (tx, ty, value, size, color) =>
            keep(this.add.text(tx, ty, value, {
                fontFamily: 'monospace', fontSize: `${size}px`, color
            }).setDepth(depth + 1));
        label(x + 14, y + 13, info.title, 15, '#e3f0f5');
        info.lines.forEach((line, i) => label(x + 14, y + 44 + i * 23, line, 11, '#bed4df'));
        label(x + 14, y + 149, depth > 300 ?
            'CHOISIR POUR AJOUTER À L’INVENTAIRE' :
            (type === 'overload' ? 'GLISSER SUR LA BASE' : 'GLISSER SUR LE CHAMP DE BATAILLE'), 9, '#819eaf');
    },

    showBuildingTooltip(index) {
        this.hideBuildingTooltip();
        const id = OverseerVNextPreview.buildingAt(this.model, index);
        if (id === null) return;
        const type = this.world.get(id, 'Building').type;
        const { x: gx, y: gy, cell } = this.gridLayout;
        const cx = gx + (index % 5 + 0.5) * cell;
        const cy = gy + (Math.floor(index / 5) + 0.5) * cell;
        this.renderBuildingTooltip(type, cx + cell * 0.48, cy - 92, id);
    },

    showCardTooltip(type, x, y) {
        this.hideBuildingTooltip();
        this.renderBuildingTooltip(type, x + 12, y);
    },

    renderBuildingTooltip(type, anchorX, anchorY, buildingId = null) {
        const info = OverseerVNextBuildings.getBuilding(type);
        if (!info) return;
        const recipe = OverseerVNextEconomy.PROTOTYPE_RECIPES[type];
        const width = 266, height = 185, pad = 13;
        const x = Math.max(8, Math.min(this.scale.width - width - 8, anchorX));
        const y = Math.max(72, Math.min(this.scale.height - height - 8, anchorY));
        const keepTip = object => { this.tooltipObjects.push(object); return object; };
        const g = keepTip(this.add.graphics().setDepth(210));
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(x, y, width, height, 6);
        g.lineStyle(1, info.color, 0.7).strokeRoundedRect(x, y, width, height, 6);
        this.drawGlyph(g, type, x + 22, y + 23, info.color, 11);
        const label = (tx, ty, content, size = 11, color = '#c7dce6') =>
            keepTip(this.add.text(tx, ty, content, { fontFamily: 'monospace', fontSize: `${size}px`, color }).setDepth(211));
        label(x + 41, y + 14, info.label, 15, '#e3f0f5');
        label(x + pad, y + 48, info.description, 11, '#a6bfce');
        const rate = buildingId ? OverseerVNextCooling.bonus(this.model, buildingId) : 0;
        const active = buildingId ? OverseerVNextCooling.observed(this.model, buildingId) : false;
        if(buildingId)label(x + pad, y + 79, rate ? `CRYOPOMPE : +${Math.round(rate*100)}% CADENCE` :
            active ? 'REFROIDISSEMENT : AUCUN BONUS' : 'HORS VISION : BONUS INACTIF',10,rate?'#87b9e8':'#819eaf');
        if (!recipe) {
            if (type === 'cryopump') {
                label(x + pad, y + 101, 'PORTÉE : 8 CASES VOISINES', 10, '#87b9e8');
                label(x + pad, y + 125, 'ACTIVATION : SOUS VISION', 10, '#87b9e8');
                label(x + pad, y + 150, 'BONUS IMMÉDIAT +20%, SANS MALUS', 10, '#819eaf');
            } else if (type === 'perception_amplifier') {
                label(x + pad, y + 101, 'RADAR : BALAYAGE DU CHAMP ENTIER', 10, '#91ced1');
                label(x + pad, y + 125, 'UNE ONDE / 5 S (PLUS VITE SI FROID)', 10, '#91ced1');
                label(x + pad, y + 150, 'DÉTECTION 350 · MARQUE 2 S', 9, '#819eaf');
            } else if (type === 'laboratory') {
                label(x + pad, y + 105, 'PRODUIT : TECHNOLOGIE DE SOIN', 10, '#69d9a0');
                label(x + pad, y + 128, `1 TECHNOLOGIE / ${(30/(1+rate)).toFixed(1)} S SOUS VISION`, 10, '#b58aff');
                label(x + pad, y + 151, 'INVENTAIRE : PANNEAU DE DROITE', 9, '#819eaf');
            } else label(x + pad, y + 105, 'PRODUCTION NON SIMULÉE', 11, '#819eaf');
            return;
        }
        const drawItems = (title, entries, rowY) => {
            label(x + pad, rowY, title, 10, '#819eaf');
            let ix = x + 18;
            for (const [resource, quantity] of entries) {
                const style = this.resourceStyles.find(item => item.id === resource);
                if (!style) continue;
                this.drawResourceIcon(g, style, ix + 7, rowY + 27, 8);
                label(ix + 22, rowY + 19, String(quantity), 13, '#e3f0f5');
                ix += 76;
            }
        };
        const inputs = Object.entries(recipe.consumes);
        drawItems(OverseerVNextEconomy.MILITARY[type] ? 'COÛT PAR UNITÉ' : 'CONSOMME / CYCLE', inputs, y + 99);
        if (OverseerVNextEconomy.MILITARY[type]) {
            label(x + pad, y + 142, `CYCLE : ${(recipe.cycleMs / (1000*(1+rate))).toFixed(1)}s / UNITÉ`, 10, '#819eaf');
            label(x + 18, y + 162, `UNITÉS ${OverseerVNextEconomy.aliveUnits(this.model, type)}/${OverseerVNextEconomy.unitCapacity(this.model, type)}`, 11, '#62e7e1');
        } else {
            drawItems('PRODUIT / CYCLE', Object.entries(recipe.produces).filter(([key]) => !key.startsWith('unit_')), y + 138);
            label(x + width - 78, y + 168, `${(recipe.cycleMs/(1000*(1+rate))).toFixed(1)}s/cycle`, 9, '#819eaf');
        }
    },

    hideResourceTooltip() {
        if (this.resourceTooltip) this.resourceTooltip.destroy();
        this.resourceTooltip = null;
    },

    showResourceTooltip(style, x, y) {
        this.hideResourceTooltip();
        const tipX = Math.max(8, Math.min(this.scale.width - 190, x));
        const tipY = Math.max(72, Math.min(this.scale.height - 35, y));
        const coverage=style.flow?OverseerVNextCooling.coverage(this.model):null;
        const title=coverage?`Refroidissement : ${coverage.buildings} couverts`:style.label;
        this.resourceTooltip = this.add.text(tipX, tipY, title, {
            fontFamily: 'monospace', fontSize: '12px', color: '#e3f0f5',
            backgroundColor: '#0b1d2b', padding: { x: 9, y: 6 }
        }).setDepth(220);
    },

    hideWaveTooltip() {
        for (const object of this.waveTooltipObjects || []) object.destroy();
        this.waveTooltipObjects = [];
    },

    showWaveTooltip(index, x, y) {
        this.hideWaveTooltip();
        const wave = this.previewWaves[index];
        if (!wave) return;
        const groups = wave.enemies.filter(group => group.count > 0);
        const threat = OverseerVNextWaves.danger(wave);
        const elite = OverseerVNextWaves.elite(wave.number);
        const width = 242, height = (elite ? 116 : 104) + groups.length * 20;
        const tx = Math.max(8, Math.min(this.scale.width - width - 8, x - width / 2));
        const ty = Math.max(72, y - height - 15);
        const g = this.add.graphics().setDepth(230);
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(tx, ty, width, height, 6);
        g.lineStyle(1, elite ? 0xf4ba58 : 0xff6674, 0.7).strokeRoundedRect(tx, ty, width, height, 6);
        this.waveTooltipObjects.push(g);
        const text = (dx, dy, str, size = 12, color = '#dfeaf0') =>
            this.waveTooltipObjects.push(this.add.text(tx + dx, ty + dy, str, {
                fontFamily: 'monospace', fontSize: `${size}px`, color
            }).setDepth(231));
        text(13, 12, `VAGUE ${wave.number}${elite ? ' · ÉLITE' : ''}`, 15,
            elite ? '#f4ba58' : '#dfeaf0');
        text(13, 38, `MENACE ESTIMÉE  ${'●'.repeat(threat.level)}`, 11,
            elite ? '#f4ba58' : '#e9b6bf');
        if(elite) text(13, 57, 'RÉCOMPENSE : BÂTIMENT + TECHNO', 10, '#f4ba58');
        text(13, elite ? 78 : 66, 'COMPOSITION PRÉVISIONNELLE', 10, '#819eaf');
        groups.forEach((group, i) => {
            text(13, (elite ? 96 : 84) + i * 20,
                `×${group.count} · ${OverseerBattleUnitStyles.enemyLabel(group.type)}`, 11, '#e9b6bf');
        });
    },

    hideBattleUnitTooltip(clearPointer = true) {
        for (const object of this.battleTooltipObjects || []) object.destroy();
        this.battleTooltipObjects = [];
        this.battleTooltipId = null;
        this.battleTooltipTitle = null;
        this.battleTooltipBody = null;
        this.battleTooltipGraphics = null;
        if (clearPointer) this.battleHoverPointer = null;
    },

    onBattleUnitPointer(pointer) {
        this.battleHoverPointer = { x: pointer.x, y: pointer.y };
        this.refreshBattleUnitTooltip();
    },

    battleUnitAt(screenX, screenY) {
        const b = this.battleBounds;
        if (!b || screenX < b.x || screenX > b.x + b.w ||
            screenY < b.y || screenY > b.y + b.h) return null;
        let chosen = null, closest = Infinity;
        for (const id of this.battleUnits || []) {
            if (!this.world.has(id) || this.world.get(id, 'Health')?.hp <= 0) continue;
            const position = this.world.get(id, 'Position');
            if (!position) continue;
            const reaction = this.hitEffects.view(id);
            const baseRadius = Math.min(12, Math.max(6, b.w * 0.024));
            const style = this.battleUnitStyle(id);
            const radius = Math.max(11, baseRadius * (style.size || 1) * 1.35);
            const x = b.x + position.x * b.w / 1000 + reaction.x * baseRadius;
            const y = b.y + position.y * b.h / 600 + reaction.y * baseRadius;
            const distance = Math.hypot(screenX - x, screenY - y);
            if (distance <= radius && distance <= closest) {
                closest = distance;
                chosen = id; // Last painted wins on an exact overlap.
            }
        }
        return chosen;
    },

    battleUnitDescription(id) {
        const type = this.world.get(id, 'PreviewUnit')?.type || 'inconnu';
        const side = this.world.get(id, 'Faction')?.side;
        const hp = this.world.get(id, 'Health');
        const combat = this.world.get(id, 'Combat');
        const movement = this.world.get(id, 'Movement');
        const allyLabels = {
            unit_guard: 'Défenseur', unit_sniper: 'Tireur allié',
            unit_mecha: 'Unité blindée', unit_dronoid: 'Drone de soutien'
        };
        const name = side === 'player' ? (allyLabels[type] || type) :
            OverseerBattleUnitStyles.enemyLabel(type);
        const healing = combat.behavior === 'healer';
        const berserk = this.world.get(id, 'TechnologyBuff')?.type === 'berserk';
        const overclock = side === 'player' ? OverseerVNextZones.speedMultiplier(this.model) : 1;
        const interval = combat.cooldownMs / (berserk ? 1.5 : 1) / 1000;
        const states = [];
        if (berserk) states.push('Berserk');
        if (overclock > 1) states.push('Surcadencement');
        if (this.world.get(id, 'ThreatMark')) states.push('Ciblé');
        const temporary = this.world.get(id, 'TemporaryAlly');
        if (temporary) states.push('Renfort ' + Math.ceil(temporary.remainingMs / 1000) + ' s');
        const lines = [
            'Type : ' + type,
            'PV : ' + Math.max(0, hp.hp) + ' / ' + hp.maxHp,
            (healing ? 'Soin' : 'Dégâts') + ' : ' + combat.damage + ' · ' +
                (healing ? 'soutien' : combat.attackType === 'ranged' ? 'distance' : 'mêlée'),
            'Portée : ' + combat.range,
            'Cadence : ' + interval.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' s',
            'Vitesse : ' + movement.speed * overclock,
            ...(states.length ? ['État : ' + states.join(', ')] : [])
        ];
        return { name, side, body: lines.join('\n') };
    },

    refreshBattleUnitTooltip() {
        const pointer = this.battleHoverPointer, b = this.battleBounds;
        if (!pointer || !b || this.activeReward || this.runFinished || this.dragGhost) {
            this.hideBattleUnitTooltip(false);
            return;
        }
        const id = this.battleUnitAt(pointer.x, pointer.y);
        if (id === null) { this.hideBattleUnitTooltip(false); return; }
        const info = this.battleUnitDescription(id);
        const width = Math.min(238, b.w - 12), height = Math.min(162, b.h - 12);
        if (width < 145 || height < 120) { this.hideBattleUnitTooltip(false); return; }
        if (this.battleTooltipId !== id) {
            this.hideBattleUnitTooltip(false);
            const keep = object => { this.battleTooltipObjects.push(object); return object; };
            const color = info.side === 'player' ? 0x62e7e1 : 0xff6674;
            const g = keep(this.add.graphics().setDepth(220));
            g.fillStyle(0x0b1d2b, 0.97).fillRoundedRect(0, 0, width, height, 6);
            g.lineStyle(1, color, 0.85).strokeRoundedRect(0, 0, width, height, 6);
            this.battleTooltipGraphics = g;
            this.battleTooltipTitle = keep(this.add.text(0, 0, '', {
                fontFamily: 'monospace', fontSize: '12px',
                color: info.side === 'player' ? '#62e7e1' : '#ff6674'
            }).setDepth(221));
            this.battleTooltipBody = keep(this.add.text(0, 0, '', {
                fontFamily: 'monospace', fontSize: '10px', color: '#c7dce6', lineSpacing: 5
            }).setDepth(221));
            this.battleTooltipId = id;
        }
        const title = info.name.toUpperCase() + ' · ' + (info.side === 'player' ? 'ALLIÉ' : 'ENNEMI');
        if (this.battleTooltipTitle.text !== title && this.battleTooltipTitle.value !== title)
            this.battleTooltipTitle.setText(title);
        if (this.battleTooltipBody.text !== info.body && this.battleTooltipBody.value !== info.body)
            this.battleTooltipBody.setText(info.body);
        const x = Math.max(b.x + 6, Math.min(b.x + b.w - width - 6,
            pointer.x + 16 + width <= b.x + b.w ? pointer.x + 16 : pointer.x - width - 16));
        const y = Math.max(b.y + 6, Math.min(b.y + b.h - height - 6,
            pointer.y - height - 16 >= b.y ? pointer.y - height - 16 : pointer.y + 16));
        this.battleTooltipGraphics.setPosition(x, y);
        this.battleTooltipTitle.setPosition(x + 11, y + 9);
        this.battleTooltipBody.setPosition(x + 11, y + 31);
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextTooltips = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
