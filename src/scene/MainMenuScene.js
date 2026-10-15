
// Fixed, orthogonal circuit routes. Their coordinates are fractions of the viewport:
// the middle stays quiet for the title and the three menu actions.
const OVERSEER_MENU_CIRCUITS = [
    [[0, .12], [.07, .12], [.07, .23], [.16, .23]],
    [[0, .25], [.04, .25], [.04, .39], [.13, .39], [.13, .44]],
    [[0, .49], [.085, .49], [.085, .59], [.17, .59]],
    [[0, .67], [.11, .67], [.11, .78], [.19, .78]],
    [[0, .90], [.06, .90], [.06, .82], [.14, .82]],
    [[0, .35], [.025, .35], [.025, .29], [.17, .29]],
    [[0, .77], [.045, .77], [.045, .70], [.12, .70]],
    [[0, .56], [.05, .56], [.05, .51], [.14, .51]],
    [[1, .11], [.93, .11], [.93, .21], [.82, .21]],
    [[1, .27], [.96, .27], [.96, .40], [.86, .40]],
    [[1, .45], [.91, .45], [.91, .52], [.83, .52]],
    [[1, .63], [.94, .63], [.94, .73], [.84, .73]],
    [[1, .87], [.91, .87], [.91, .81], [.83, .81]],
    [[1, .74], [.98, .74], [.98, .68], [.88, .68]],
    [[1, .36], [.975, .36], [.975, .29], [.85, .29]],
    [[.30, 0], [.30, .065], [.38, .065], [.38, .14]],
    [[.71, 0], [.71, .085], [.62, .085], [.62, .14]],
    [[.27, 1], [.27, .92], [.38, .92], [.38, .86]],
    [[.70, 1], [.70, .93], [.62, .93], [.62, .86]]
];
// New VNext entry screen. The previous menu remains in LegacyMainMenuScene.
class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create() {
        this.objects = [];
        this.transitioning = false;
        this.reducedMotion = typeof window !== 'undefined' &&
            !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this.cameras.main.fadeIn(280, 8, 18, 28);
        this.drawMenu();
        this.scale.on('resize', this.drawMenu, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.drawMenu, this);
        });
    }

    drawMenu() {
        if (this.transitioning) return;
        this.objects.forEach(object => object.destroy());
        this.objects = [];
        const keep = object => { this.objects.push(object); return object; };
        const { width: w, height: h } = this.scale;
        const cx = w / 2;
        const g = keep(this.add.graphics());

        g.fillStyle(0x08121c, 1).fillRect(0, 0, w, h);
        g.lineStyle(1, 0x1d3644, 0.9).lineBetween(16, 18, w - 16, 18);
        g.lineStyle(1, 0x1d3644, 0.6).lineBetween(16, h - 18, w - 16, h - 18);

        // The static traces and animated currents live behind every interactive element.
        this.circuitGraphics = keep(this.add.graphics());
        this.signalGraphics = keep(this.add.graphics());
        this.buildCircuitBackground(w, h);
        if (!this.reducedMotion) this.drawCircuitSignals();

        // Preserve the letter spacing, font family and colors of the current HUD.
        const brand = OverseerVNextBrand;
        const titleSize = Math.min(46, Math.max(25, Math.floor(w / 25)));
        const titleY = Math.max(86, h * 0.26);
        keep(this.add.text(cx, titleY, brand.title, {
            fontFamily: brand.fontFamily, fontSize: titleSize + 'px', color: brand.titleColor
        }).setOrigin(0.5));
        const subtitleY = titleY + titleSize * 0.90;
        keep(this.add.text(cx, subtitleY, brand.subtitle, {
            fontFamily: brand.fontFamily,
            fontSize: Math.min(13, Math.max(10, Math.floor(w / 85))) + 'px',
            color: brand.subtitleColor
        }).setOrigin(0.5));

        g.lineStyle(1, 0x2c6373, 0.7).lineBetween(cx - 120, subtitleY + 35, cx + 120, subtitleY + 35);
        g.fillStyle(0x62e7e1, 0.85).fillRect(cx - 14, subtitleY + 33, 28, 3);

        const top = Math.max(subtitleY + 100, h * 0.49);
        const spacing = Math.min(78, Math.max(57, (h - top - 65) / 3));
        const buttonWidth = Math.min(388, Math.max(248, w * 0.48));
        [
            { label: 'START A GAME', target: 'VNextScene' },
            { label: 'TALENTS', target: 'TalentScene', data: { fromMenu: true } },
            { label: 'OPTIONS', target: 'OptionsScene' }
        ].forEach((entry, i) => {
            const y = top + i * spacing;
            const surface = keep(this.add.rectangle(cx, y, buttonWidth, 54, 0x0a1a26, 0.87)
                .setStrokeStyle(1, 0x274457)
                .setInteractive({ useHandCursor: true }));
            const label = keep(this.add.text(cx - buttonWidth / 2 + 22, y, entry.label, {
                fontFamily: brand.fontFamily, fontSize: '16px', color: '#c7dce6'
            }).setOrigin(0, 0.5));
            const chevron = keep(this.add.text(cx + buttonWidth / 2 - 22, y, '›', {
                fontFamily: brand.fontFamily, fontSize: '22px', color: '#668fa4'
            }).setOrigin(1, 0.5));

            surface.on('pointerover', () => {
                surface.setFillStyle(0x102d3e, 1).setStrokeStyle(1, 0x62e7e1);
                label.setColor('#e2eef3');
                chevron.setColor('#62e7e1');
            });
            surface.on('pointerout', () => {
                surface.setFillStyle(0x0a1a26, 0.87).setStrokeStyle(1, 0x274457);
                label.setColor('#c7dce6');
                chevron.setColor('#668fa4');
            });
            surface.on('pointerdown', () => this.navigateTo(entry.target, entry.data));
        });
    }

    // Static circuit geometry is drawn only on create/resize, not every frame.
    buildCircuitBackground(width, height) {
        const g = this.circuitGraphics;
        this.circuitPaths = OVERSEER_MENU_CIRCUITS.map((route, index) => {
            const points = route.map(([x, y]) => ({
                x: Math.round(x * width), y: Math.round(y * height)
            }));
            const segments = [];
            let length = 0;

            g.lineStyle(1, 0x3b7481, 0.20 + (index % 4) * 0.035);
            for (let i = 1; i < points.length; i++) {
                const start = points[i - 1], end = points[i];
                const distance = Math.hypot(end.x - start.x, end.y - start.y);
                segments.push(distance);
                length += distance;
                g.lineBetween(start.x, start.y, end.x, end.y);
            }
            const terminal = points[points.length - 1];
            g.fillStyle(0x5596a4, 0.35).fillCircle(terminal.x, terminal.y, 2);
            if (index % 3 === 0) {
                g.lineStyle(1, 0x5596a4, 0.23).strokeCircle(terminal.x, terminal.y, 5);
            }
            return { points, segments, length };
        });

        // Three continuous impulses plus two intermittent ones. Distinct speeds
        // and staggered absences keep the visible count between three and five.
        const impulses = [
            { pathIndex: 2, speed: 26, start: 0.30 },
            { pathIndex: 10, speed: 33, start: 0.42 },
            { pathIndex: 17, speed: 22, start: 0.54 },
            { pathIndex: 5, speed: 38, start: 0.24, restartDelay: 155 },
            { pathIndex: 12, speed: 29, start: -110, restartDelay: 210 }
        ];
        this.circuitSignals = impulses.map(({ pathIndex, speed, start, restartDelay = 0 }) => ({
            pathIndex,
            distance: start < 0 ? start : this.circuitPaths[pathIndex].length * start,
            speed,
            restartDelay
        }));
        this.circuitFrameMs = 0;
    }

    pointOnCircuit(path, distance) {
        if (distance < 0 || distance > path.length) return null;
        for (let i = 0; i < path.segments.length; i++) {
            const segmentLength = path.segments[i];
            if (distance <= segmentLength) {
                const a = path.points[i], b = path.points[i + 1];
                const t = segmentLength ? distance / segmentLength : 0;
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            }
            distance -= segmentLength;
        }
        return path.points[path.points.length - 1];
    }

    drawCircuitSignals() {
        const g = this.signalGraphics;
        g.clear();
        for (const signal of this.circuitSignals) {
            const path = this.circuitPaths[signal.pathIndex];
            const head = this.pointOnCircuit(path, signal.distance);
            if (!head) continue;

            // Thin, short trailing current following bends (no large glow).
            for (let i = 3; i >= 0; i--) {
                const point = this.pointOnCircuit(path, signal.distance - i * 7);
                if (!point) continue;
                g.fillStyle(0x62e7e1, [0.60, 0.27, 0.15, 0.09][i])
                    .fillCircle(point.x, point.y, i === 0 ? 2.4 : 1.6);
            }
            g.fillStyle(0x62e7e1, 0.07).fillCircle(head.x, head.y, 5);
        }
    }

    // Phaser update delta is real elapsed milliseconds: menu movement is not
    // coupled to the simulation speed selected in the game.
    update(_time, delta) {
        if (this.transitioning || this.reducedMotion || !this.signalGraphics) return;
        this.circuitFrameMs += Math.min(Math.max(delta, 0), 100);
        if (this.circuitFrameMs < 40) return; // ~20-25 lightweight redraws/s.
        const elapsed = this.circuitFrameMs;
        this.circuitFrameMs = 0;
        for (const signal of this.circuitSignals) {
            const path = this.circuitPaths[signal.pathIndex];
            signal.distance += signal.speed * elapsed / 1000;
            if (signal.distance > path.length) {
                // Main currents loop immediately; the two extra currents rest
                // off-screen between passes, without ever exceeding five.
                signal.distance = signal.restartDelay
                    ? -signal.restartDelay
                    : signal.distance - path.length;
            }
        }
        this.drawCircuitSignals();
    }

    navigateTo(target, data) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.cameras.main.fadeOut(220, 8, 18, 28);
        this.time.delayedCall(220, () => this.scene.start(target, data));
    }
}
