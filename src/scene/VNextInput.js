// VNext Phaser input adapters and target hit-testing.
// Methods preserve the VNextScene contract while simulation state remains ECS-owned.
(function (root) {
    'use strict';
    const methods = {
    gridIndex(x, y) {
        const { x: gx, y: gy, size, cell } = this.gridLayout;
        if (x < gx || y < gy || x >= gx + size || y >= gy + size) return -1;
        return Math.floor((y - gy) / cell) * 5 + Math.floor((x - gx) / cell);
    },

    onKey(event) {
        if (this.activeReward) {
            if (event.code === 'Space') event.preventDefault();
            return;
        }
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
    },

    onDragStart(pointer, object) {
        if (this.activeReward) return;
        this.hideTechnologyTooltip();
        this.hideBattleUnitTooltip();
        const technology=object.getData('technology');
        if(OverseerVNextTechnologies.TYPES.includes(technology)){this.techDrag=technology;this.dragGhost=this.add.graphics();this.dragGhost.lineStyle(2,0x69d9a0,1).strokeCircle(0,0,16);this.dragGhost.setPosition(pointer.x,pointer.y).setDepth(300);return;}
        const type = object.getData('palette');
        if (!type) return;
        this.dragType = type;
        this.dragGhost = this.add.graphics();
        this.drawGlyph(this.dragGhost, type, 0, 0, this.types.find(t => t.id === type).color, 21);
        this.dragGhost.setPosition(pointer.x, pointer.y).setDepth(300);
    },

    onDrag(pointer, object) {
        if ((object.getData('palette')||object.getData('technology')) && this.dragGhost) this.dragGhost.setPosition(pointer.x, pointer.y);
    },

    onDragEnd(pointer, object) {
        if (this.activeReward) {
            this.dragGhost?.destroy();
            this.dragGhost = null;
            this.dragType = null;
            return;
        }
        if(OverseerVNextTechnologies.TYPES.includes(object.getData('technology'))) {
            const technology=object.getData('technology');
            const target=technology==='overload' ? this.baseTechnologyTarget(pointer.x,pointer.y) : this.technologyTarget(pointer.x,pointer.y);
            if(target && OverseerVNextTechnologies.consume(this.model,technology)) {
                this.castTechnology(object.getData('technology'),target);
                this.saveCurrentGame();
            }
            this.dragGhost?.destroy();this.dragGhost=null;this.techDrag=null;this.buildUi();return;
        }
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
        if (placed !== null) this.saveCurrentGame();
    },

    technologyTarget(x,y) {
        const b=this.battleBounds;
        if(!b || x<b.x || y<b.y || x>b.x+b.w || y>b.y+b.h)return null;
        return {x:(x-b.x)*1000/b.w,y:(y-b.y)*600/b.h};
    },

    baseTechnologyTarget(x,y) {
        const l=this.layout;
        if(!l || x<l.boardX || x>l.boardX+l.boardW || y<l.mainTop || y>l.mainBottom)return null;
        return {x:500,y:300}; // Global base effect; no positional simulation target.
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextInput = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
