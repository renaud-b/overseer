// Phaser-only presentation for wave timeline and wave labels.
// ECS and reward decisions remain in existing gameplay systems.
(function (root) {
    'use strict';
    const methods = {
    updateWaveTimeline() {
        if (!this.waveCountdownLabel) return;
        const seconds = Math.ceil((this.previewWaves[0].dueAtMs - this.waveClock.elapsedMs) / 1000);
        this.waveCountdownLabel.setText(String(seconds));
        this.paintWaveTimeline();
    },

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
            marker.label.setPosition(visible?x-4:-100,visible?y-16:-100);
            if(visible){
                const count=OverseerVNextWaves.danger(wave).level;
                const special=OverseerVNextWaves.elite(wave.number);
                const color=special?0xf4ba58:0xff6674;
                g.fillStyle(color,0.94);
                for(let n=0;n<count;n++)g.fillCircle(x+(n-(count-1)/2)*7,y,3);
                if(special)g.lineStyle(1.2,color,0.65)
                    .strokeCircle(x,y,19);
            }
        });
    },

    drawFooter() {
        const l = this.layout, y = l.h - 44;
        const x1 = l.m + 70, x2 = l.w - l.m - 18;
        this.waveTimelineBounds = { x1, x2, y };
        const clock = this.keep(this.add.graphics());
        clock.lineStyle(2, 0x62e7e1, 0.85).strokeCircle(l.m + 30, y, 21);
        this.waveCountdownLabel = this.text(l.m + 30, y, '', 15, '#e2eef3').setOrigin(0.5, 0.5);
        this.waveGraphics = this.keep(this.add.graphics());
        this.waveMarkers = this.previewWaves.map((wave, i) => {
            const label = this.text(-100, -100, String(wave.number), 10, '#e9b6bf');
            const zone = this.keep(this.add.zone(-100, -100, 44, 36).setInteractive({ useHandCursor: true }));
            zone.setData('wave', i);
            zone.on('pointerover', () => this.showWaveTooltip(i, zone.x, y));
            zone.on('pointerout', () => this.hideWaveTooltip());
            return { zone, label };
        });
        this.updateWaveTimeline();
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextWaveView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
