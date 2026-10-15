// Isolated VNext sandbox: ECS combat plus experimental, attention-driven production.
class VNextScene extends Phaser.Scene {
    constructor() { super({ key: 'VNextScene' }); }

    preload() { this.load.json('vnextLegacyStats', 'assets/game_stats.json'); }

    create() {
        this.model = OverseerVNextPreview.createModel(OverseerECS.World);
        this.world = this.model.world;
        this.visionRules = Object.create(Vision.prototype);
        this.visionRules.level = 0;
        this.visionRules.createPatterns(); // Same L shape and rotations as the playable prototype.
        this.attention = { x: 1, y: 1 };
        this.selectedType = null;
        this.movingId = null;
        this.speed = 1;
        this.baseHp = 100;
        this.ui = [];
        this.types = OverseerVNextBuildings.BUILDINGS;
        // The resource HUD borrows glyphs and colors from the corresponding buildings.
        // Cooling and data are placeholders: they have no ECS balances or simulation yet.
        this.resourceStyles = [
            { id: 'energy', label: 'Énergie', glyph: 'reactor', source: 'reactor', color: 0x35d8ef },
            { id: 'matter', label: 'Matière', glyph: 'extractor', source: 'extractor', color: 0x39dd92 },
            { id: 'cooling', label: 'Refroidissement', glyph: 'cooling', pending: true, color: 0x87b9e8 },
            { id: 'components', label: 'Composants', glyph: 'factory', source: 'factory', color: 0xf4ba58 },
            { id: 'data', label: 'Données', glyph: 'laboratory', pending: true, color: 0xb58aff }
        ];
        this.lastResourceChanges = {}; // Transient HUD feedback, not economy state.
        this.hoveredTile = null;
        this.tooltipObjects = [];
        this.waveTooltipObjects = [];
        this.waveClock = { number: 0, elapsedMs: 0, seed: 137 };
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed);

        OverseerVNextCards.initialize(this.model);
        OverseerVNextEconomy.initialize(this.model);
        this.applyAttention();
        this.resetBattle();
        this.buildUi();
        this.input.keyboard.on('keydown', this.onKey, this);
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);
        this.scale.on('resize', this.buildUi, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.buildUi, this);
            this.input.keyboard.off('keydown', this.onKey, this);
            this.input.off('dragstart', this.onDragStart, this);
            this.input.off('drag', this.onDrag, this);
            this.input.off('dragend', this.onDragEnd, this);
        });
    }

    keep(object) { this.ui.push(object); return object; }

    text(x, y, value, size = 14, color = '#dfeaf0') {
        return this.keep(this.add.text(x, y, value, {
            fontFamily: 'monospace', fontSize: `${size}px`, color
        }));
    }

    panel(g, x, y, w, h) {
        g.fillStyle(0x0a1a26, 0.75).fillRoundedRect(x, y, w, h, 7);
        g.lineStyle(1, 0x213b4a, 0.8).strokeRoundedRect(x, y, w, h, 7);
    }

    buildUi() {
        if (!this.model) return;
        if (this.dragGhost) { this.dragGhost.destroy(); this.dragGhost = null; }
        this.hideBuildingTooltip();
        this.hideResourceTooltip();
        this.hideWaveTooltip();
        this.ui.forEach(object => object.destroy());
        this.ui = [];
        const w = this.scale.width, h = this.scale.height;
        const m = 16, gap = 12, mainTop = 82, mainBottom = h - 126;
        const leftW = Math.min(244, Math.max(178, w * 0.18));
        const rightW = w >= 1160 ? 112 : 0;
        const centerX = m + leftW + gap;
        const centerRight = w - m - (rightW ? rightW + gap : 0);
        const centerW = centerRight - centerX;
        const boardW = Math.min(440, Math.max(205, centerW * 0.45));
        this.layout = {
            w, h, m, leftW, rightW, mainTop, mainBottom,
            centerX, centerRight, boardX: centerX, boardW,
            battleX: centerX + boardW + gap,
            battleW: centerW - boardW - gap,
            rightX: w - m - rightW
        };
        const g = this.keep(this.add.graphics());
        g.fillStyle(0x08121c).fillRect(0, 0, w, h);
        g.lineStyle(1, 0x1d3644, 0.9).lineBetween(m, 65, w - m, 65);
        this.text(m + 6, 19, 'O V E R S E E R', 23, '#e2eef3');
        this.text(m + 7, 49, 'VNEXT  /  LABORATOIRE VISUEL', 10, '#86a6ba');
        this.drawSpeedControls(w);
        this.panel(g, m, mainTop, leftW, mainBottom - mainTop);
        this.panel(g, centerX, mainTop, boardW, mainBottom - mainTop);
        this.panel(g, this.layout.battleX, mainTop, this.layout.battleW, mainBottom - mainTop);
        if (rightW) this.panel(g, this.layout.rightX, mainTop, rightW, mainBottom - mainTop);
        this.panel(g, m, h - 112, w - m * 2, 96);
        this.drawPalette();
        this.drawBoard();
        this.drawBattlePanel();
        this.resourceLabels = {};
        this.resourceStatusLabels = {};
        this.compactResources = null;
        this.compactResourceDeltas = null;
        if (rightW) this.drawRightPanel();
        else this.drawCompactResources();
        this.drawFooter();
        this.updateResourceHud();
        this.paintBoard();
        this.paintBattle();
        if (this.hoveredTile !== null) this.showBuildingTooltip(this.hoveredTile);
    }

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
        legacy.on('pointerdown', () => this.scene.start('GameScene'));
        const menu = this.text(w - 59, 24, 'MENU', 12, '#7b9aad');
        menu.setPadding(5).setInteractive({ useHandCursor: true });
        menu.on('pointerdown', () => this.scene.start(window.selectedLanguage ? 'MainMenuScene' : 'HomeScene'));
    }

    selectSpeed(speed) {
        if (speed === 0 && this.speed > 0) this.lastSpeed = this.speed;
        this.speed = speed;
        this.buildUi();
    }

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
            this.text(x + 53, y + 38, recipe ? 'PRODUCTION EXPÉRIMENTALE' : 'À IMPLÉMENTER', 10, '#7393a8');
            const hit = this.keep(this.add.zone(x + cw / 2, y + 32, cw, 65).setInteractive({ useHandCursor: true }));
            hit.setData('palette', typeId);
            hit.on('pointerover', () => this.showCardTooltip(typeId, x + cw, y + 10));
            hit.on('pointerout', () => this.hideBuildingTooltip());
            hit.on('pointerdown', () => {
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
        this.text(l.m + 13, l.mainBottom - 53, 'Coûts de pose non définis', 10, '#7292a6');
    }

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
    }

    drawBoard() {
        const l = this.layout;
        this.text(l.boardX + 16, l.mainTop + 17, 'BASE  5 × 5', 15);
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
    }

    gridIndex(x, y) {
        const { x: gx, y: gy, size, cell } = this.gridLayout;
        if (x < gx || y < gy || x >= gx + size || y >= gy + size) return -1;
        return Math.floor((y - gy) / cell) * 5 + Math.floor((x - gx) / cell);
    }

    clickTile(index) {
        const existing = OverseerVNextPreview.buildingAt(this.model, index);
        if (this.movingId !== null) {
            if (OverseerVNextPreview.moveBuilding(this.model, this.movingId, index)) this.movingId = null;
        } else if (this.selectedType && !existing) {
            const placed = OverseerVNextCards.play(this.model, this.selectedType, index);
            if (placed !== null) {
                this.selectedType = null;
                this.buildUi();
            }
        } else if (existing && !this.selectedType) {
            this.movingId = existing;
        }
        this.paintBoard();
        this.refreshPaletteSelection();
        this.updateBoardHint();
        if (this.hoveredTile !== null) this.showBuildingTooltip(this.hoveredTile);
        this.updateResourceHud();
    }

    updateBoardHint() {
        if (!this.boardHint) return;
        this.boardHint.setText(this.movingId !== null ? 'Déplacer : choisir une case libre' :
            this.selectedType ? 'Choisir une case libre' : 'ZQSD / WASD : vision   E : tourner');
    }

    hideBuildingTooltip() {
        for (const object of this.tooltipObjects || []) object.destroy();
        this.tooltipObjects = [];
        this.hoveredTile = null;
    }

    showBuildingTooltip(index) {
        this.hideBuildingTooltip();
        const id = OverseerVNextPreview.buildingAt(this.model, index);
        if (id === null) return;
        const type = this.world.get(id, 'Building').type;
        const { x: gx, y: gy, cell } = this.gridLayout;
        const cx = gx + (index % 5 + 0.5) * cell;
        const cy = gy + (Math.floor(index / 5) + 0.5) * cell;
        this.renderBuildingTooltip(type, cx + cell * 0.48, cy - 92);
    }

    showCardTooltip(type, x, y) {
        this.hideBuildingTooltip();
        this.renderBuildingTooltip(type, x + 12, y);
    }

    renderBuildingTooltip(type, anchorX, anchorY) {
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
        label(x + pad, y + 77, 'CONSTRUCTION : COÛT À DÉFINIR', 10, '#819eaf');
        if (!recipe) {
            label(x + pad, y + 105, 'PRODUCTION NON SIMULÉE', 11, '#819eaf');
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
        drawItems(type === 'barracks' ? 'COÛT PAR UNITÉ' : 'CONSOMME / CYCLE', inputs, y + 99);
        drawItems(type === 'barracks' ? 'FABRIQUE / UNITÉ' : 'PRODUIT / CYCLE', Object.entries(recipe.produces).filter(([key]) => key !== 'unit_guard'), y + 138);
        if (type === 'barracks') label(x + 18, y + 162, '1 UNITÉ DE BASE', 11, '#62e7e1');
        else label(x + width - 78, y + 168, `${recipe.cycleMs / 1000}s/cycle`, 9, '#819eaf');
    }

    drawGlyph(g, type, x, y, color, r) {
        g.lineStyle(2, color, 1);
        if (type === 'reactor') g.strokeCircle(x, y, r * 0.75);
        else if (type === 'extractor') {
            g.strokeEllipse(x, y, r * 1.5, r * 0.95);
            g.lineBetween(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
        } else if (type === 'factory') {
            const points = Array.from({ length: 6 }, (_, i) => ({
                x: x + Math.cos(Math.PI * i / 3) * r,
                y: y + Math.sin(Math.PI * i / 3) * r
            }));
            g.strokePoints(points, true);
        } else if (type === 'laboratory') {
            g.strokePoints([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], true);
        } else {
            g.strokeRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
        }
    }

    paintBoard() {
        if (!this.boardGraphics || !this.gridLayout) return;
        const g = this.boardGraphics;
        g.clear();
        const { x, y, size, cell } = this.gridLayout;
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
            this.drawGlyph(g, type, p.x, p.y, active ? style.color : 0x5b7687, cell * 0.18);
            const progress = this.world.get(id, 'Production');
            if (active && progress && progress.cooldownMs > 0) {
                // Small progress indicator, driven by ECS state, not a Phaser timer.
                const px = p.x - cell * 0.25, py = p.y + cell * 0.36, pw = cell * 0.5;
                g.fillStyle(0x294354, 0.8).fillRect(px, py, pw, 3);
                g.fillStyle(progress.blocked ? 0xff6674 : 0x62e7e1, 0.95)
                    .fillRect(px, py, pw * Math.min(1, progress.elapsedMs / progress.cooldownMs), 3);
            }
            if (id === this.movingId) g.lineStyle(2, 0xffffff, 0.9).strokeCircle(p.x, p.y, cell * 0.4);
        });
    }

    applyAttention() {
        const offsets = this.visionRules.visionPatterns[this.visionRules.patternIndex];
        const indices = offsets.map(({ x, y }) => (this.attention.y + y) * 5 + this.attention.x + x);
        return OverseerVNextPreview.setObserved(this.model, indices);
    }

    changeAttention(dx, dy, rotate = false) {
        const candidate = { x: this.attention.x + dx, y: this.attention.y + dy };
        const nextRotation = (this.visionRules.patternIndex + (rotate ? 1 : 0)) % 4;
        const pattern = this.visionRules.visionPatterns[nextRotation];
        if (!pattern.every(p => candidate.x + p.x >= 0 && candidate.x + p.x < 5 &&
                                  candidate.y + p.y >= 0 && candidate.y + p.y < 5)) return false;
        this.attention = candidate;
        this.visionRules.patternIndex = nextRotation;
        this.applyAttention();
        this.paintBoard();
        this.updateResourceHud();
        return true;
    }

    onKey(event) {
        if (event.code === 'Space') { event.preventDefault(); this.selectSpeed(this.speed === 0 ? (this.lastSpeed || 1) : 0); return; }
        if (['Digit1', 'Digit2', 'Digit3', 'Digit5'].includes(event.code)) {
            this.selectSpeed(Number(event.code.slice(-1))); return;
        }
        if (event.code === 'KeyE') { this.changeAttention(0, 0, true); return; }
        const key = event.key.toLowerCase();
        const azerty = window.keyboardLayout === 'azerty';
        const arrows = {
            arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0]
        };
        const move = arrows[key] || (key === (azerty ? 'z' : 'w') ? [0, -1] :
            key === (azerty ? 'q' : 'a') ? [-1, 0] : key === 's' ? [0, 1] : key === 'd' ? [1, 0] : null);
        if (move) this.changeAttention(...move);
    }

    onDragStart(pointer, object) {
        const type = object.getData('palette');
        if (!type) return;
        this.dragType = type;
        this.dragGhost = this.add.graphics();
        this.drawGlyph(this.dragGhost, type, 0, 0, this.types.find(t => t.id === type).color, 21);
        this.dragGhost.setPosition(pointer.x, pointer.y).setDepth(300);
    }

    onDrag(pointer, object) {
        if (object.getData('palette') && this.dragGhost) this.dragGhost.setPosition(pointer.x, pointer.y);
    }

    onDragEnd(pointer, object) {
        if (!object.getData('palette')) return;
        const index = this.gridIndex(pointer.x, pointer.y);
        const placed = index !== -1 ? OverseerVNextCards.play(this.model, object.getData('palette'), index) : null;
        this.dragGhost?.destroy();
        this.dragGhost = null;
        this.dragType = null;
        this.selectedType = null;
        this.paintBoard();
        this.updateBoardHint();
        this.buildUi();
    }

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
    }

    hideResourceTooltip() {
        if (this.resourceTooltip) this.resourceTooltip.destroy();
        this.resourceTooltip = null;
    }

    showResourceTooltip(style, x, y) {
        this.hideResourceTooltip();
        const tipX = Math.max(8, Math.min(this.scale.width - 190, x));
        const tipY = Math.max(72, Math.min(this.scale.height - 35, y));
        this.resourceTooltip = this.add.text(tipX, tipY, style.label, {
            fontFamily: 'monospace', fontSize: '12px', color: '#e3f0f5',
            backgroundColor: '#0b1d2b', padding: { x: 9, y: 6 }
        }).setDepth(220);
    }

    drawCompactResources() {
        const l = this.layout, x = l.m + 17, startY = l.mainBottom - 156;
        const g = this.keep(this.add.graphics());
        this.compactResources = {};
        this.compactResourceDeltas = {};
        this.resourceStyles.filter(style => !style.pending).forEach((style, i) => {
            const y = startY + i * 21;
            this.drawResourceIcon(g, style, x + 8, y + 7, 8);
            const color = `#${style.color.toString(16).padStart(6, '0')}`;
            this.compactResources[style.id] = this.text(x + 25, y - 2, '0', 14, color);
            this.compactResourceDeltas[style.id] = this.text(l.m + l.leftW - 17, y, '—', 11, '#7898aa').setOrigin(1, 0);
            this.resourceHoverZone(style, x, y - 3, l.leftW - 32, 22, x + 7, y - 30);
        });
    }

    resourceHoverZone(style, x, y, w, h, tipX, tipY) {
        const zone = this.keep(this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive());
        zone.setData('resource', style.id);
        zone.on('pointerover', () => this.showResourceTooltip(style, tipX, tipY));
        zone.on('pointerout', () => this.hideResourceTooltip());
        return zone;
    }

    drawBattlePanel() {
        const l = this.layout;
        this.text(l.battleX + 15, l.mainTop + 17, 'CHAMP DE BATAILLE', 15);
        const { battleX, battleW, mainTop, mainBottom } = l;
        this.battleBounds = { x: battleX + 12, y: mainTop + 48, w: battleW - 24, h: mainBottom - mainTop - 96 };
        const g = this.keep(this.add.graphics());
        const b = this.battleBounds;
        g.lineStyle(1, 0x1c3949, 0.5).lineBetween(b.x + b.w * 0.52, b.y, b.x + b.w * 0.52, b.y + b.h);
        this.battleGraphics = this.keep(this.add.graphics());
        this.battleStatus = this.text(l.battleX + 15, mainBottom - 38, '', 11, '#8eabbc');
    }

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
    }

    // Statuses report real ECS activation/blockage. A recent delta reports only
    // the last actual balance change, never a fabricated continuous rate.
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
    }

    noteResourceChanges(previous, dt) {
        const balance = this.world.get(this.model.game, 'Resources');
        for (const id of ['energy', 'matter', 'components']) {
            const old = this.lastResourceChanges[id];
            if (old) old.remainingMs -= dt;
            const change = balance[id] - previous[id];
            if (change) this.lastResourceChanges[id] = { change, remainingMs: 2300 };
        }
    }

    updateResourceHud() {
        if (!this.model || !this.world.hasComponent(this.model.game, 'Resources')) return;
        const balance = this.world.get(this.model.game, 'Resources');
        for (const style of this.resourceStyles) {
            if (style.pending) continue;
            this.resourceLabels[style.id]?.setText(String(balance[style.id]));
            this.compactResources?.[style.id]?.setText(String(balance[style.id]));
            const recent = this.lastResourceChanges[style.id];
            const delta = recent?.remainingMs > 0
                ? `${recent.change > 0 ? '+' : ''}${recent.change}` : '—';
            const color = recent?.remainingMs > 0
                ? (recent.change > 0 ? '#69e5ac' : '#ff9e8c') : '#7898aa';
            for (const status of [this.resourceStatusLabels[style.id], this.compactResourceDeltas?.[style.id]]) {
                status?.setText(delta);
                status?.setColor(color);
            }
        }
    }

    hideWaveTooltip() {
        for (const object of this.waveTooltipObjects || []) object.destroy();
        this.waveTooltipObjects = [];
    }

    showWaveTooltip(index, x, y) {
        this.hideWaveTooltip();
        const wave = this.previewWaves[index];
        if (!wave) return;
        const width = 214, height = 105;
        const tx = Math.max(8, Math.min(this.scale.width - width - 8, x - width / 2));
        const ty = Math.max(72, y - height - 15);
        const g = this.add.graphics().setDepth(230);
        g.fillStyle(0x0b1d2b, 0.98).fillRoundedRect(tx, ty, width, height, 6);
        g.lineStyle(1, 0xff6674, 0.7).strokeRoundedRect(tx, ty, width, height, 6);
        g.lineStyle(2, 0xff6674).strokeCircle(tx + 23, ty + 57, 8);
        this.waveTooltipObjects.push(g);
        const text = (dx, dy, str, size = 12, color = '#dfeaf0') =>
            this.waveTooltipObjects.push(this.add.text(tx + dx, ty + dy, str, {
                fontFamily: 'monospace', fontSize: `${size}px`, color
            }).setDepth(231));
        text(13, 12, `VAGUE ${wave.number}`, 15);
        text(42, 49, `×${wave.enemies[0].count} · Ennemi de base`, 11, '#e9b6bf');
        text(13, 80, 'Composition prévisionnelle', 10, '#819eaf');
    }

    updateWaveTimeline() {
        if (!this.waveCountdownLabel) return;
        const seconds = Math.ceil((this.previewWaves[0].dueAtMs - this.waveClock.elapsedMs) / 1000);
        this.waveCountdownLabel.setText(`Vague ${this.waveClock.number + 1} dans ${seconds}s (temps de jeu)`);
        this.paintWaveTimeline();
    }

    spawnEnemyUnit(type, index, count) {
        const config = this.cache.json.get('vnextLegacyStats').enemies.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        // Fan out spawn positions without altering stats or attack behavior.
        const x = 800 + (index % 3) * 14, y = 100 + ((index * 47) % 400);
        this.world.set(id, 'Position', { x, y });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'enemy' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 220, behavior: config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        this.battleUnits.push(id);
    }

    triggerWave(wave) {
        for (const group of wave.enemies) {
            for (let i = 0; i < group.count; i++) this.spawnEnemyUnit(group.type, i, group.count);
        }
        // Preview markers slide forward; the wave plan itself remains deterministic.
        this.previewWaves = OverseerVNextWaves.preview(8, this.waveClock.seed, this.waveClock.number);
        this.buildUi();
    }

    paintWaveTimeline() {
        if (!this.waveGraphics || !this.waveMarkers) return;
        const g=this.waveGraphics, {x1,x2,y}=this.waveTimelineBounds, horizonMs=360000;
        g.clear();
        g.lineStyle(1,0x29495b,0.8).lineBetween(x1,y,x2,y);
        g.lineStyle(2,0xff6674,0.95).lineBetween(x1,y-13,x1,y+13);
        this.previewWaves.forEach((wave,i)=>{
            const x=x1+(wave.dueAtMs-this.waveClock.elapsedMs)/horizonMs*(x2-x1);
            const visible=x>=x1&&x<=x2, marker=this.waveMarkers[i];
            marker.zone.setPosition(visible?x:-100,visible?y:-100);
            marker.label.setPosition(visible?x-4:-100,visible?y-23:-100);
            if(visible){
                g.fillStyle(0xff6674,0.94).fillCircle(x,y,5);
                g.lineStyle(1,0xff6674,0.55).strokeCircle(x,y,9);
            }
        });
    }

    drawFooter() {
        const l=this.layout,y=l.h-102;
        this.text(l.m+15,y,'VAGUES / TIMELINE',14);
        const x1=l.m+230,x2=l.w-290;
        this.waveTimelineBounds={x1,x2,y:y+18};
        this.waveGraphics=this.keep(this.add.graphics());
        this.waveMarkers=this.previewWaves.map((wave,i)=>{
            const label=this.text(-100,-100,String(wave.number),10,'#e9b6bf');
            const zone=this.keep(this.add.zone(-100,-100,25,35).setInteractive({useHandCursor:true}));
            zone.setData('wave',i);
            zone.on('pointerover',()=>this.showWaveTooltip(i,zone.x,this.waveTimelineBounds.y));
            zone.on('pointerout',()=>this.hideWaveTooltip());
            return {zone,label};
        });
        this.waveCountdownLabel=this.text(l.m+15,y+36,'',11,'#829fb1');
        this.updateWaveTimeline();
        const replay=this.text(l.w-203,y+36,'↻ REJOUER LE COMBAT',12,'#6de8e8');
        replay.setPadding(5).setInteractive({useHandCursor:true});
        replay.on('pointerdown',()=>this.resetBattle());
    }

    resetBattle() {
        (this.battleUnits || []).forEach(id => { if (this.world.has(id)) this.world.destroy(id); });
        this.battleUnits = [];
        this.baseHp = 100;
        const stats = this.cache.json.get('vnextLegacyStats');
        const lineup = [
            ['player', 'unit_guard', 200, 185], ['player', 'unit_sniper', 260, 305],
            ['player', 'unit_dronoid', 230, 425], ['enemy', 'basic_monster', 650, 180],
            ['enemy', 'basic_monster', 720, 390], ['enemy', 'ranged_monster', 790, 275],
            ['enemy', 'base_rusher', 870, 460]
        ];
        lineup.forEach(([side, type, x, y]) => {
            const config = (side === 'player' ? stats.units : stats.enemies).find(d => d.id === type);
            if (!config) return;
            const id = this.world.create(this.model.game);
            this.world.set(id, 'Position', { x, y });
            this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
            this.world.set(id, 'Faction', { side });
            this.world.set(id, 'Movement', { speed: config.speed });
            this.world.set(id, 'Combat', {
                damage: config.attack_damage, range: config.attack_range,
                attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
                elapsedMs: 0, detectionRadius: side === 'player' ? 400 : 220,
                behavior: config.behavior || null
            });
            this.world.set(id, 'PreviewUnit', { type });
            this.battleUnits.push(id);
        });
        this.paintBattle();
    }

    spawnFriendlyUnit(type) {
        const stats = this.cache.json.get('vnextLegacyStats');
        const config = stats.units.find(unit => unit.id === type);
        if (!config) return;
        const id = this.world.create(this.model.game);
        this.world.set(id, 'Position', { x: 195, y: 290 });
        this.world.set(id, 'Health', { hp: config.hp, maxHp: config.hp });
        this.world.set(id, 'Faction', { side: 'player' });
        this.world.set(id, 'Movement', { speed: config.speed });
        this.world.set(id, 'Combat', {
            damage: config.attack_damage, range: config.attack_range,
            attackType: config.attack_type, cooldownMs: config.attack_speed * 1000,
            elapsedMs: 0, detectionRadius: 400, behavior: config.behavior || null
        });
        this.world.set(id, 'PreviewUnit', { type });
        this.battleUnits.push(id);
    }

    paintBattle() {
        if (!this.battleGraphics || !this.battleBounds) return;
        const g = this.battleGraphics, b = this.battleBounds;
        g.clear();
        const p = (x, y) => ({ x: b.x + b.w * x / 1000, y: b.y + b.h * y / 600 });
        const base = p(65, 300);
        g.lineStyle(1, 0x48b8c4, 0.65).strokeCircle(base.x, base.y, 12);
        g.lineStyle(1, 0x48b8c4, 0.3).strokeCircle(base.x, base.y, 21);
        for (const id of this.battleUnits) {
            if (!this.world.has(id)) continue;
            const hp = this.world.get(id, 'Health');
            if (hp.hp <= 0) continue;
            const pos = this.world.get(id, 'Position');
            const side = this.world.get(id, 'Faction').side;
            const q = p(pos.x, pos.y);
            const color = side === 'player' ? 0x38d9f1 : 0xff5c79;
            g.lineStyle(2, color, 0.98);
            const r = Math.min(12, Math.max(6, b.w * 0.024));
            if (side === 'player') {
                g.strokeTriangle(q.x, q.y - r, q.x + r, q.y + r, q.x - r, q.y + r);
            } else {
                g.strokeCircle(q.x, q.y, r * 0.8);
                g.fillStyle(color, 0.5).fillCircle(q.x, q.y, r * 0.26);
            }
            g.fillStyle(0x23404e, 0.8).fillRect(q.x - 11, q.y - r - 9, 22, 3);
            g.fillStyle(side === 'player' ? 0x44dc91 : 0xff5e79, 1)
                .fillRect(q.x - 11, q.y - r - 9, 22 * Math.max(0, hp.hp / hp.maxHp), 3);
        }
        if (this.battleStatus) {
            const alive = side => this.battleUnits.filter(id => this.world.has(id) &&
                this.world.get(id, 'Faction').side === side && this.world.get(id, 'Health').hp > 0).length;
            this.battleStatus.setText(`Alliés ${alive('player')}   Menaces ${alive('enemy')}   Base ${this.baseHp}/100`);
        }
    }

    update(time, delta) {
        if (!this.model || this.speed === 0 || !this.battleUnits) return;
        const dt = Math.min(delta, 60) * this.speed;
        for (const wave of OverseerVNextWaves.advance(this.waveClock, dt)) this.triggerWave(wave);
        this.updateWaveTimeline();
        const previousResources = { ...this.world.get(this.model.game, 'Resources') };
        const economyEvents = OverseerVNextEconomy.step(this.model, dt);
        for (const event of economyEvents) {
            if (event.type === 'unit-produced') this.spawnFriendlyUnit(event.unitType);
        }
        this.noteResourceChanges(previousResources, dt);
        this.updateResourceHud();
        this.paintBoard();
        const players = this.battleUnits.filter(id => this.world.has(id) && this.world.get(id, 'Faction').side === 'player' && this.world.get(id, 'Health').hp > 0);
        const enemies = this.battleUnits.filter(id => this.world.has(id) && this.world.get(id, 'Faction').side === 'enemy' && this.world.get(id, 'Health').hp > 0);
        for (const id of [...players, ...enemies]) {
            if (this.world.get(id, 'Health').hp <= 0) continue;
            const side = this.world.get(id, 'Faction').side;
            const events = OverseerCombat.stepUnit(this.world, id, dt, {
                opponents: side === 'player' ? enemies : players,
                base: side === 'enemy' && this.baseHp > 0 ? { x: 65, y: 300 } : null,
                patrol: side === 'player' ? { x: 280, y: 300 } : null
            });
            events.forEach(e => { if (e.type === 'base-attack') this.baseHp = Math.max(0, this.baseHp - e.damage); });
        }
        OverseerCombat.separateUnits(this.world, this.battleUnits);
        this.paintBattle();
    }
}
