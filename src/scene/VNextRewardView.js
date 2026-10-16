// Phaser-only presentation for reward overlay and choice presentations.
// ECS and reward decisions remain in existing gameplay systems.
(function (root) {
    'use strict';
    const methods = {

    drawArtifactReplacementOverlay() {
        const incoming=OverseerVNextArtifacts.get(this.activeReward?.pendingArtifact);
        if(!incoming)return;
        const equipped=OverseerVNextArtifacts.list(this.model);
        const w=this.scale.width,h=this.scale.height;
        const narrow=w<680;
        const columns=narrow?2:3,rows=narrow?3:2;
        const width=Math.min(narrow?560:720,w-32);
        const height=Math.min(narrow?580:480,h-24);
        const x=(w-width)/2,y=(h-height)/2;
        const g=this.keep(this.add.graphics().setDepth(300));
        g.fillStyle(0x08121c,0.93).fillRect(0,0,w,h);
        g.fillStyle(0x0b1d2b,1).fillRoundedRect(x,y,width,height,8);
        g.lineStyle(1,0xb58aff,0.72).strokeRoundedRect(x,y,width,height,8);
        this.keep(this.add.zone(w/2,h/2,w,h).setInteractive().setDepth(301))
            .setData('replacementBlocker',true);
        const title=(value,tx,ty,size,color,wrap=width-36)=>{
            return this.keep(this.add.text(tx,ty,value,{
                fontFamily:'monospace',fontSize:`${size}px`,color,
                wordWrap:{width:wrap}
            }).setDepth(302));
        };
        title('INVENTAIRE PLEIN · REMPLACER UN ARTEFACT',x+17,y+16,16,'#dfeaf0');
        title('NOUVEL ARTEFACT  →  '+incoming.label,x+17,y+47,13,'#c7a4ff');
        title(incoming.description,x+17,y+68,11,'#aec5d1');
        const top=y+133,footer=y+height-62;
        const gap=9,cardW=(width-34-(columns-1)*gap)/columns;
        const rowH=(footer-top-13)/rows;
        equipped.forEach((id,i)=>{
            const artifact=OverseerVNextArtifacts.get(id);
            const allowed=OverseerVNextArtifacts.canReplace(this.model,i,incoming.id);
            const col=i%columns,row=Math.floor(i/columns);
            const bx=x+17+col*(cardW+gap),by=top+row*rowH;
            const bh=Math.max(70,rowH-8);
            g.fillStyle(allowed?0x102c3c:0x19242b,1).fillRoundedRect(bx,by,cardW,bh,5);
            g.lineStyle(1,allowed?artifact.color:0x52606a,allowed?0.7:0.3)
                .strokeRoundedRect(bx,by,cardW,bh,5);
            this.drawArtifactGlyph(g,artifact,bx+19,by+20,9);
            title(`${i+1}. ${artifact.label}`,bx+34,by+12,11,allowed?'#dceaf0':'#82939e',cardW-44);
            title(allowed?'REMPLACER ↔':'REQUIS PAR UN AUTRE',bx+12,by+bh-26,10,
                allowed?'#b8a2fb':'#c48c8c',cardW-24);
            const zone=this.keep(this.add.zone(bx+cardW/2,by+bh/2,cardW,bh)
                .setInteractive({useHandCursor:allowed}).setDepth(304));
            zone.setData('artifactReplacementSlot',i);
            zone.on('pointerover',()=>{
                this.showArtifactTooltip(id,bx,by-123,310);
            });
            zone.on('pointerout',()=>this.hideArtifactTooltip());
            if(allowed)zone.on('pointerdown',()=>this.replaceArtifactReward(i));
        });
        title('Le nouvel artefact remplace définitivement celui choisi.',x+17,footer-4,
            10,'#91a9b8',width-225);
        const bw=185,bx=x+width-bw-17,by=y+height-50;
        g.fillStyle(0x243440,1).fillRoundedRect(bx,by,bw,33,4);
        g.lineStyle(1,0x849ba9,0.65).strokeRoundedRect(bx,by,bw,33,4);
        title('CONSERVER LES SIX',bx+14,by+10,11,'#dfeaf0',bw-20);
        const cancel=this.keep(this.add.zone(bx+bw/2,by+16,bw,33)
            .setInteractive({useHandCursor:true}).setDepth(304));
        cancel.setData('declineArtifactReplacement',true);
        cancel.on('pointerdown',()=>this.declineArtifactReward());
    },
    drawRewardOverlay() {
        this.hideBattleUnitTooltip();
        const reward = this.activeReward;
        if (!reward) return;
        if (reward.pendingArtifact) {
            this.drawArtifactReplacementOverlay();
            return;
        }
        const w = this.scale.width, h = this.scale.height;
        const width = Math.min(590, w - 32), x = (w - width) / 2, y = Math.max(95, h / 2 - 115);
        const g = this.keep(this.add.graphics().setDepth(300));
        g.fillStyle(0x08121c, 0.88).fillRect(0, 0, w, h);
        g.fillStyle(0x0b1d2b, 1).fillRoundedRect(x, y, width, 245, 8);
        g.lineStyle(1, 0x62e7e1, 0.7).strokeRoundedRect(x, y, width, 245, 8);
        // Full-screen hit target above the HUD, below the reward choices.
        // Phaser's default topOnly input dispatch keeps pointer events off the game.
        this.keep(this.add.zone(w / 2, h / 2, w, h)
            .setInteractive().setDepth(301)).setData('rewardBlocker', true);
        this.keep(this.add.text(x + 20, y + 19, `VAGUE ${reward.number} TERMINÉE`, {
            fontFamily:'monospace',fontSize:'17px',color:'#dfeaf0'
        }).setDepth(301));
        const paid=OverseerVNextMemoryShards.awarded(this.model,reward.number);
        const subtitle=paid ? `+${OverseerVNextMemoryShards.PER_WAVE} ÉCLAT DE MÉMOIRE · Choisissez une carte` :
            'Choisissez une carte · simulation en pause';
        this.keep(this.add.text(x + 20, y + 48, subtitle, {
            fontFamily:'monospace',fontSize:'11px',color:'#8daabb'
        }).setDepth(301));
        const stage=OverseerVNextRewards.current(reward);
        const stageNames = { building: 'BÂTIMENT', technology: 'TECHNOLOGIE', artifact: 'ARTEFACT' };
        const breadcrumb=reward.stages?.map((part,i)=>i===reward.index?'[ '+stageNames[part.kind]+' ]':stageNames[part.kind]+' ✓').join('   →   ') ||
            ('[ '+(stageNames[stage.kind]||'CHOIX')+' ]');
        this.keep(this.add.text(x+width/2,y+68,breadcrumb,{
            fontFamily:'monospace',fontSize:'11px',color:'#b58aff'
        }).setOrigin(0.5,0).setDepth(301));
        reward.options.forEach((type, i) => {
            const techStyles={
                'tech:healing_field':{color:0x69d9a0,label:'Régénération'},
                'tech:berserk':{color:0xf4a261,label:'Berserk'},
                'tech:stasis_field':{color:0x87b9e8,label:'Stase'},
                'tech:overclock':{color:0x62e7e1,label:'Surcadencement'},
                'tech:overload':{color:0xf5b94f,label:'Surcharge'},
                'tech:emp_field':{color:0xb5a7ff,label:'Impulsion EMP'},
                'tech:reinforcements':{color:0x44dc91,label:'Renforts'}
            };
            const artifact = type.startsWith('artifact:') ? OverseerVNextArtifacts.get(type.slice(9)) : null;
            const building = artifact || techStyles[type] || OverseerVNextBuildings.getBuilding(type);
            const cardW = (width - 56) / 3, cx = x + 14 + i * (cardW + 14), cy = y + 113;
            g.fillStyle(0x123047).fillRoundedRect(cx, cy, cardW, 108, 5);
            g.lineStyle(1, building.color, 0.7).strokeRoundedRect(cx, cy, cardW, 108, 5);
            const iconG = this.keep(this.add.graphics().setDepth(301));
            if (artifact) this.drawArtifactGlyph(iconG, artifact, cx + cardW / 2, cy + 27, 13);
            else if (type.startsWith('tech:')) {
                iconG.lineStyle(2, building.color, 1).lineBetween(cx + cardW / 2 - 7, cy + 27, cx + cardW / 2 + 7, cy + 27);
                iconG.lineBetween(cx + cardW / 2, cy + 20, cx + cardW / 2, cy + 34);
            } else this.drawGlyph(iconG, type, cx + cardW / 2, cy + 27, building.color, 13);
            this.keep(this.add.text(cx + cardW / 2, cy + 53, building.label, {
                fontFamily:'monospace',fontSize:'12px',color:'#dfeaf0'
            }).setOrigin(0.5, 0).setDepth(301));
            const zone = this.keep(this.add.zone(cx + cardW / 2, cy + 54, cardW, 108)
                .setInteractive({useHandCursor:true}).setDepth(302));
            zone.setData('reward', type);
            zone.on('pointerover', () => {
                if (artifact) {
                    this.showArtifactTooltip(artifact.id, cx + cardW / 2, cy - 130, 310);
                    return;
                }
                if (type.startsWith('tech:')) {
                    this.showTechnologyTooltip(type.slice(5), cx + cardW / 2 - 145, cy - 185, 310);
                    return;
                }
                this.showCardTooltip(type, cx + cardW / 2, cy - 205);
                // Reward selection overlay is above the game HUD (depth 300).
                // Reuse the same building popup, but draw it over the overlay.
                this.tooltipObjects.forEach(object => object.setDepth(310));
            });
            zone.on('pointerout', () => {
                this.hideBuildingTooltip();
                this.hideTechnologyTooltip();
                this.hideArtifactTooltip();
            });
            zone.on('pointerdown', () => this.chooseReward(type));
        });
    }
    };
    function install(Scene) { Object.assign(Scene.prototype, methods); }
    const api = Object.freeze({ install });
    root.OverseerVNextRewardView = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
