// VNext talent configuration. Rendering only; progression logic is in core.
class TalentScene extends Phaser.Scene {
    constructor() {
        super('TalentScene');
        this.talentTrees = OverseerTalentCatalog.trees;
        this.palette = {bg:0x08121c,panel:0x0b1d2b,border:0x294b5b,cyan:0x62e7e1,ink:'#e2eef3',muted:'#86a6ba',amber:'#f5b94f'};
    }
    init(data={}) { this.fromMenu = data.fromMenu !== false; }
    preload() {
        const lang = (typeof window !== 'undefined' && window.selectedLanguage) || 'en';
        this.load.json('gameTexts', 'assets/game_texts_' + lang + '.json');
    }
    storage() { try { return localStorage; } catch (_) { return null; } }
    translate(key) { return this.gameTexts?.ui?.[key] || key; }
    create() {
        this.gameTexts = this.cache.json.get('gameTexts') || {};
        this.progress = OverseerTalentProgression.read(this.storage());
        this.activeTree = 'foundation'; // legacy category, no longer used for navigation
        this.selectedId = null;
        this.zoom = .6;
        this.pan = {x:0,y:0};
        this.dragging = null;
        this.reducedMotion = !!(typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        this.cameras.main.fadeIn(250,8,18,28);
        this.scale.on('resize', this.render, this);
        this.input.on('wheel', this.onWheel, this);
        this.input.on('pointerdown',this.onBackgroundDown,this);
        this.input.on('pointermove',this.onDrag,this);
        this.input.on('pointerup',this.onDragEnd,this);
        this.events.once('shutdown', () => {
            this.scale.off('resize',this.render,this);
            this.input.off('wheel',this.onWheel,this);
            this.input.off('pointerdown',this.onBackgroundDown,this);
            this.input.off('pointermove',this.onDrag,this);
            this.input.off('pointerup',this.onDragEnd,this);
        });
        this.render();
    }
    bounds() {
        const w=this.scale.width,h=this.scale.height;
        const side=Math.min(330,Math.max(235,w*.28));
        return {w,h,side,area:{x:18,y:133,w:Math.max(190,w-side-58),h:Math.max(120,h-211)},panelX:w-side-22};
    }
    render() {
        if(!this.scale?.width || !this.scale?.height)return;
        if(this.layers) this.layers.forEach(o=>o.destroy());
        this.layers=[];
        const keep=o=>(this.layers.push(o),o);
        const p=this.palette,b=this.bounds();
        const g=keep(this.add.graphics());
        g.fillStyle(p.bg,1).fillRect(0,0,b.w,b.h);
        g.lineStyle(1,p.border,.9).lineBetween(18,19,b.w-18,19);
        g.lineStyle(1,p.border,.7).lineBetween(18,b.h-20,b.w-18,b.h-20);
        keep(this.add.text(25,32,'OVERSEER / CONFIGURATION',{fontFamily:'monospace',fontSize:'11px',color:p.muted}));
        keep(this.add.text(25,54,'ÉVOLUTION DU NOYAU',{fontFamily:'monospace',fontSize:'24px',color:p.ink}));
        keep(this.add.text(b.w-22,54,'✦ '+this.progress.shards+' ÉCLATS DE MÉMOIRE',{fontFamily:'monospace',fontSize:'13px',color:p.amber}).setOrigin(1,0));
        const trees=['foundation','architecture','evolution','ascension'];
        const labels=['FONDATIONS','ARCHITECTURE','ÉVOLUTION','ASCENSION'];
        keep(this.add.text(25,107,'RÉSEAU UNIFIÉ  /  4 DOMAINES',{fontFamily:'monospace',fontSize:'11px',color:'#7faebb'}));
        keep(this.add.text(b.w-b.side-48,107,'EXPLORER  •  ZOOM  •  DÉPLACER',{fontFamily:'monospace',fontSize:'10px',color:p.muted}).setOrigin(1,0));
        g.fillStyle(p.panel,1).fillRoundedRect(b.area.x,b.area.y,b.area.w,b.area.h,6);
        g.lineStyle(1,p.border,1).strokeRoundedRect(b.area.x,b.area.y,b.area.w,b.area.h,6);
        const area=b.area;
        const nodes=this.layoutUnified();
        const position=new Map(nodes.map(n=>[n.key,this.toScreen(n,area)]));
        for(const n of nodes) {
            if(n.category==='core')continue;
            const a=position.get(n.parentKey),c=position.get(n.key);
            if(a&&c){const active=this.progress.unlocked.includes(n.id);g.lineStyle(active?2:1,active?p.cyan:0x3e7382,active?.85:.5);g.lineBetween(a.x,a.y,c.x,c.y);}
        }
        const regions=[
            {key:'foundation',label:'FONDATIONS',x:-360,y:-255,color:'#69dcd4'},
            {key:'architecture',label:'ARCHITECTURE',x:360,y:-255,color:'#e8bc72'},
            {key:'evolution',label:'ÉVOLUTION',x:-360,y:190,color:'#ca9add'},
            {key:'ascension',label:'ASCENSION',x:360,y:190,color:'#9db7e8'}
        ];
        for(const region of regions){
            const r=this.toScreen({_x:region.x,_y:region.y},area);
            if(r.x>area.x+10&&r.x<area.x+area.w-10&&r.y>area.y+10&&r.y<area.y+area.h-10)
              keep(this.add.text(r.x,r.y,region.label,{fontFamily:'monospace',fontSize:Math.max(9,12*this.zoom)+'px',color:region.color}).setOrigin(.5));
        }
        for(const n of nodes) {
            const v=position.get(n.key);
            if(v.x<area.x+28||v.x>area.x+area.w-28||v.y<area.y+28||v.y>area.y+area.h-40)continue;
            const unlocked=this.progress.unlocked.includes(n.id);
            const available=OverseerTalentProgression.canUnlock(this.progress,n);
            const selected=this.selectedId===n.key;
            const color=unlocked?p.cyan:available?0xf5b94f:0x506d7c;
            const circle=keep(this.add.circle(v.x,v.y,Math.max(9,20*this.zoom),unlocked?0x194850:0x172b38,1).setStrokeStyle(selected?3:1.5,color).setInteractive({useHandCursor:true}));
            circle.on('pointerdown',()=>{this.suppressDrag=true;this.selectedId=n.key;this.render();});
            keep(this.add.text(v.x,v.y,this.glyph(n.id),{fontFamily:'monospace',fontSize:Math.max(8,12*this.zoom)+'px',color:unlocked?'#aef8ef':'#b5cbd5'}).setOrigin(.5));
            if(this.zoom>=.7)keep(this.add.text(v.x,v.y+Math.max(16,25*this.zoom),this.shortName(n.id),{fontFamily:'monospace',fontSize:'9px',color:unlocked?'#d7e9ef':'#859eaf'}).setOrigin(.5));
        }
        this.renderDetails(keep,g,b);
        keep(this.add.text(24,b.h-53,'MOLETTE : ZOOM   ·   GLISSER : DÉPLACER',{fontFamily:'monospace',fontSize:'10px',color:p.muted}));
        const center=keep(this.add.text(area.x+area.w-10,b.h-53,'RECENTRER',{fontFamily:'monospace',fontSize:'11px',color:'#8ecacb'}).setOrigin(1,0).setInteractive({useHandCursor:true}));
        center.on('pointerdown',()=>{this.zoom=.6;this.pan={x:0,y:0};this.render();});
        const back=keep(this.add.text(b.w-25,b.h-54,'RETOUR AU MENU  ›',{fontFamily:'monospace',fontSize:'12px',color:p.ink}).setOrigin(1,0).setInteractive({useHandCursor:true}));
        back.on('pointerdown',()=>this.scene.start('MainMenuScene'));
    }
    glyph(id) {return id==='root'?'◎':id.includes('vision')||id.includes('scanner')?'◇':id.includes('unit')||id.includes('guard')?'✚':id.includes('resource')||id.includes('scrap')?'▣':'✦';}
    shortName(id){const s=this.translate('talent_'+id+'_label');return s==='talent_'+id+'_label'?id.replaceAll('_',' ').slice(0,20):s.slice(0,22);}
    layoutUnified() {
        const groups=['foundation','architecture','evolution','ascension'];
        const centers={foundation:{x:-360,y:-255},architecture:{x:360,y:-255},evolution:{x:-360,y:190},ascension:{x:360,y:190}};
        const nodes=[{id:'root',key:'core:root',category:'core',_x:0,_y:0,cost:0}];
        for(const category of groups){
            const tree=(this.talentTrees[category]||[]).filter(t=>t.id!=='root');
            const byId=new Map(tree.map(n=>[n.id,n]));
            const children=new Map();
            tree.forEach(n=>{if(n.parent&&byId.has(n.parent)){const list=children.get(n.parent)||[];list.push(n);children.set(n.parent,list);}});
            const roots=tree.filter(n=>!n.parent||!byId.has(n.parent));
            let next=0;
            const ordered=[];
            const visit=(n,depth)=>{const cs=children.get(n.id)||[];cs.forEach(c=>visit(c,depth+1));const x=cs.length?(cs[0]._localX+cs[cs.length-1]._localX)/2:next++*110;n._localX=x;n._depth=depth;ordered.push(n);};
            roots.forEach(n=>visit(n,0));
            const mid=(Math.max(0,next-1)*110)/2;
            const center=centers[category];
            for(const n of ordered){
                nodes.push({...n,key:category+':'+n.id,category,parentKey:byId.has(n.parent)?category+':'+n.parent:'core:root',_x:center.x+(n._localX-mid),_y:center.y+65+n._depth*105});
            }
        }
        return nodes;
    }
    toScreen(n,area){return {x:area.x+area.w/2+n._x*this.zoom+this.pan.x,y:area.y+65+n._y*this.zoom+this.pan.y};}
    onBackgroundDown(pointer){const a=this.bounds().area;if(this.suppressDrag){this.suppressDrag=false;return;}if(pointer.x>=a.x&&pointer.x<=a.x+a.w&&pointer.y>=a.y&&pointer.y<=a.y+a.h)this.dragging={x:pointer.x,y:pointer.y,px:this.pan.x,py:this.pan.y};}
    onDrag(pointer){if(!this.dragging||!pointer.isDown)return;this.pan={x:this.dragging.px+pointer.x-this.dragging.x,y:this.dragging.py+pointer.y-this.dragging.y};this.render();}
    onDragEnd(){this.dragging=null;this.suppressDrag=false;}
    onWheel(pointer,objects,dx,dy){const a=this.bounds().area;if(pointer.x<a.x||pointer.x>a.x+a.w||pointer.y<a.y||pointer.y>a.y+a.h)return;this.zoom=Math.max(.35,Math.min(1.8,this.zoom+(dy>0?-.1:.1)));this.render();}
    renderDetails(keep,g,b){
        const p=this.palette,x=b.panelX,w=b.side,h=b.area.h;
        g.fillStyle(p.panel,1).fillRoundedRect(x,b.area.y,w,h,6);
        g.lineStyle(1,p.border).strokeRoundedRect(x,b.area.y,w,h,6);
        keep(this.add.text(x+16,b.area.y+18,'ANALYSE DU TALENT',{fontFamily:'monospace',fontSize:'11px',color:'#62e7e1'}));
        const talent=this.layoutUnified().find(t=>t.key===this.selectedId);
        if(!talent){keep(this.add.text(x+16,b.area.y+70,'SÉLECTIONNEZ UN NŒUD',{fontFamily:'monospace',fontSize:'13px',color:p.muted,wordWrap:{width:w-30}}));return;}
        keep(this.add.text(x+16,b.area.y+49,this.shortName(talent.id),{fontFamily:'monospace',fontSize:'16px',color:p.ink,wordWrap:{width:w-32}}));
        const key='talent_'+talent.id+'_description';
        const desc=this.translate(key);
        keep(this.add.text(x+16,b.area.y+100,desc===key?'Description à préciser lors de la migration VNext.':desc,{fontFamily:'monospace',fontSize:'12px',color:'#afc9d5',wordWrap:{width:w-32},lineSpacing:6}));
        const unlocked=this.progress.unlocked.includes(talent.id);
        const affordable=OverseerTalentProgression.canUnlock(this.progress,talent);
        const by=b.area.y+h-79;
        keep(this.add.text(x+16,by-33,unlocked?'DÉBLOQUÉ':('COÛT  '+talent.cost+' ÉCLATS'),{fontFamily:'monospace',fontSize:'12px',color:unlocked?'#62e7e1':p.amber}));
        const button=keep(this.add.rectangle(x+w/2,by+14,w-32,41,affordable?0x164b55:0x203440).setStrokeStyle(1,affordable?p.cyan:p.border));
        keep(this.add.text(x+w/2,by+14,unlocked?'ACTIF':affordable?'DÉBLOQUER':'INDISPONIBLE',{fontFamily:'monospace',fontSize:'12px',color:affordable?'#c4f9f4':p.muted}).setOrigin(.5));
        if(affordable){button.setInteractive({useHandCursor:true}).on('pointerdown',()=>{const result=OverseerTalentProgression.purchase(this.storage(),talent);if(result.ok){this.progress=result.state;this.render();}});}
    }
}
