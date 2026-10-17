// VNext talent dashboard: stable layout, four domains, no camera navigation.
class TalentScene extends Phaser.Scene {
    constructor() {
        super('TalentScene');
        this.talentTrees = OverseerTalentCatalog.trees;
        this.palette = { bg:0x08121c, panel:0x0b1d2b, border:0x294b5b, cyan:0x62e7e1, ink:'#e2eef3', muted:'#86a6ba', amber:'#f5b94f' };
        this.domains = [
            {id:'foundation',label:'FONDATIONS',color:0x62e7e1},
            {id:'architecture',label:'ARCHITECTURE',color:0xe5b86f},
            {id:'evolution',label:'ÉVOLUTION',color:0xbd9be0},
            {id:'ascension',label:'ASCENSION',color:0x9ebbed}
        ];
    }
    init(data={}) {this.fromMenu=data.fromMenu!==false;}
    preload() {
        // This dashboard's controls are French-only: keep legacy talent labels
        // in French too, whatever language was selected elsewhere in the app.
        this.load.json('gameTexts','assets/game_texts_fr.json');
    }
    storage() {try{return localStorage;}catch(_){return null;}}
    translate(key) {return this.gameTexts?.ui?.[key]||key;}
    name(id) {
        const key='talent_'+id+'_label',value=this.translate(key);
        return value===key?id.replaceAll('_',' '):value;
    }
    create() {
        this.gameTexts=this.cache.json.get('gameTexts')||{};
        this.progress=OverseerTalentProgression.read(this.storage());
        this.selectedId=null;
        this.cameras.main.fadeIn(250,8,18,28);
        this.scale.on('resize',this.render,this);
        this.events.once('shutdown',()=>this.scale.off('resize',this.render,this));
        this.render();
    }
    bounds() {
        const w=this.scale.width,h=this.scale.height;
        const side=Math.max(215,Math.min(308,Math.floor(w*.235)));
        const area={x:16,y:121,w:Math.max(300,w-side-52),h:Math.max(260,h-189)};
        return {w,h,side,area,panelX:area.x+area.w+12};
    }
    text(keep,x,y,value,size=12,color=this.palette.ink,extra={}) {
        return keep(this.add.text(x,y,value,{fontFamily:'monospace',fontSize:size+'px',color,...extra}));
    }
    render() {
        if(!this.scale?.width||!this.scale?.height)return;
        if(this.layers)this.layers.forEach(x=>x.destroy());
        this.layers=[];
        const keep=x=>(this.layers.push(x),x);
        const b=this.bounds(),p=this.palette,g=keep(this.add.graphics());
        g.fillStyle(p.bg).fillRect(0,0,b.w,b.h);
        g.lineStyle(1,p.border,.8).lineBetween(16,18,b.w-16,18);
        g.lineStyle(1,p.border,.8).lineBetween(16,b.h-20,b.w-16,b.h-20);
        this.text(keep,17,30,'OVERSEER / CONFIGURATION',10,p.muted);
        this.text(keep,17,50,'ÉVOLUTION DU NOYAU',Math.min(23,Math.max(16,Math.floor(b.w/65))));
        this.text(keep,b.w-17,51,'✦ '+this.progress.shards+' ÉCLATS DE MÉMOIRE',12,p.amber).setOrigin(1,0);
        this.text(keep,17,99,'SYSTÈME DE TALENTS  /  4 DOMAINES',10,p.muted);
        const margin=12,halfW=(b.area.w-margin*3)/2,halfH=(b.area.h-margin*3)/2;
        const boxes=this.domains.map((d,i)=>({
            ...d,x:b.area.x+margin+(i%2)*(halfW+margin),
            y:b.area.y+margin+Math.floor(i/2)*(halfH+margin),w:halfW,h:halfH
        }));
        for(const box of boxes)this.renderDomain(keep,g,box);
        this.renderCore(keep,g,b);
        this.renderDetails(keep,g,b);
        this.text(keep,18,b.h-53,'SÉLECTIONNER UN TALENT POUR VOIR SES EFFETS',10,p.muted);
        const back=this.text(keep,b.w-17,b.h-53,'RETOUR AU MENU  ›',12,p.ink).setOrigin(1,0).setInteractive({useHandCursor:true});
        back.on('pointerdown',()=>this.scene.start('MainMenuScene'));
    }
    renderCore(keep,g,b) {
        const cx=b.area.x+b.area.w/2,cy=b.area.y+b.area.h/2;
        // A compact hub floating over the four panels, with no crossing network spaghetti.
        g.fillStyle(0x08121c,1).fillCircle(cx,cy,34);
        g.lineStyle(2,this.palette.cyan,.9).strokeCircle(cx,cy,31);
        g.lineStyle(1,this.palette.cyan,.35).strokeCircle(cx,cy,23);
        this.text(keep,cx,cy-8,'◎',20,'#b9fff8').setOrigin(.5);
        this.text(keep,cx,cy+13,'NOYAU',9,'#b9fff8').setOrigin(.5);
    }
    renderDomain(keep,g,box) {
        const p=this.palette;
        g.fillStyle(p.panel,1).fillRoundedRect(box.x,box.y,box.w,box.h,6);
        g.lineStyle(1,p.border,.95).strokeRoundedRect(box.x,box.y,box.w,box.h,6);
        g.lineStyle(2,box.color,.8).lineBetween(box.x+13,box.y+14,box.x+36,box.y+14);
        this.text(keep,box.x+43,box.y+9,box.label,11,'#dcebf1');
        if(box.id==='ascension'){
            g.fillStyle(0x081722,.82).fillRoundedRect(box.x+7,box.y+30,box.w-14,box.h-37,5);
            g.lineStyle(1,0x496071,.5).strokeRoundedRect(box.x+7,box.y+30,box.w-14,box.h-37,5);
            this.text(keep,box.x+box.w/2,box.y+box.h*.43,'◇',28,'#637c8c').setOrigin(.5);
            this.text(keep,box.x+box.w/2,box.y+box.h*.60,'SIGNAL INCONNU',12,'#8496a7').setOrigin(.5);
            this.text(keep,box.x+box.w/2,box.y+box.h*.73,'DÉBLOCAGE ULTÉRIEUR',10,'#667e8d').setOrigin(.5);
            return;
        }
        const tree=(this.talentTrees[box.id]||[]).filter(t=>t.id!=='root'&&(!t.legacy||this.progress.unlocked.includes(t.id)));
        const positions=box.id==='foundation'?this.foundationPositions(tree,box):this.domainPositions(tree,box);
        if(box.id==='foundation')this.foundationHeadings(keep,g,box);
        // Connections are strictly inside each domain, with a small root hub per panel.
        for(const node of tree){
            const c=positions.get(node.id),parent=positions.get(node.parent);
            if(!c||!parent)continue;
            const active=this.progress.unlocked.includes(node.id);
            g.lineStyle(active?2:1,active?p.cyan:box.color,active?.72:.26);
            g.lineBetween(parent.x,parent.y,c.x,c.y);
        }
        const root=positions.get('root');
        g.fillStyle(0x163742).fillCircle(root.x,root.y,9);
        g.lineStyle(1,box.color,.75).strokeCircle(root.x,root.y,9);
        for(const node of tree){
            const xy=positions.get(node.id);if(!xy)continue;
            const unlocked=this.progress.unlocked.includes(node.id);
            const available=OverseerTalentProgression.canUnlock(this.progress,node);
            const selected=this.selectedId===box.id+':'+node.id;
            const border=unlocked?p.cyan:node.planned?box.color:available?p.amber:0x54717d;
            const r=Math.max(9,Math.min(15,box.w/30));
            const circle=keep(this.add.circle(xy.x,xy.y,r,unlocked?0x1a5056:0x152e3a).setStrokeStyle(selected?3:1.4,border).setInteractive({useHandCursor:true}));
            circle.on('pointerdown',()=>{this.selectedId=box.id+':'+node.id;this.render();});
            this.text(keep,xy.x,xy.y,this.glyph(node.id),10,unlocked?'#c4fff5':'#9bb6c4').setOrigin(.5);
            // One short caption per node, clipped by size rather than rendered outside its panel.
            const name=box.id==='foundation'?this.foundationCaption(node.id):this.name(node.id);
            const limit=box.id==='foundation'?Math.max(7,Math.floor(box.w/4/6)):Math.max(8,Math.floor(box.w/3/7));
            this.text(keep,xy.x,xy.y+r+4,name.length>limit?name.slice(0,limit-1)+'…':name,9,unlocked?'#d9edf2':'#9bb1c0').setOrigin(.5,0);
        }
    }
    foundationCaption(id) {
        return ({
            starter_base_hp:'Noyau +PV',starter_reinforcement:'Renfort +1',
            defense_marksman:'Tireur +1',defense_medic:'Soigneur +1',
            vision_boost:'Vision I',resource_node_scanner:'Vision II',artifact_scanner:'Vision III',
            production_extraction:'Extraction',production_components:'Composants',
            production_efficiency:'Efficacité',production_automation:'Automat.',
            starter_tech:'Recherche I',starter_spell_building:'Recherche II',
            spell_charge_boost:'Recherche III'
        })[id]||this.name(id);
    }
    foundationHeadings(keep,g,box) {
        const labels=['DÉFENSE','VISION','PRODUCTION','TECHNO.'];
        labels.forEach((label,i)=>{
            const left=box.x+i*box.w/4,center=left+box.w/8;
            if(i)g.lineStyle(1,box.color,.12).lineBetween(left,box.y+35,left,box.y+box.h-9);
            this.text(keep,center,box.y+37,label,Math.max(8,Math.min(10,box.w/45)),'#a9c8d3').setOrigin(.5,0);
        });
    }
    foundationPositions(tree,box) {
        const positions=new Map([['root',{x:box.x+box.w/2,y:box.y+30}]]);
        const cols=[
            ['starter_base_hp','starter_reinforcement','defense_marksman','defense_medic','starter_drone','starter_guard'],
            ['vision_boost','resource_node_scanner','artifact_scanner'],
            ['production_extraction','production_components','production_efficiency','production_automation'],
            ['starter_tech','starter_spell_building','spell_charge_boost']
        ];
        const baseY=box.y+76,dy=Math.max(34,(box.h-116)/3);
        cols.forEach((ids,i)=>{
            const x=box.x+(i+.5)*box.w/4;
            ids.forEach((id,j)=>{
                if(!tree.some(n=>n.id===id))return;
                const depth=id==='production_automation'?2:
                    ['production_components','production_efficiency','starter_reinforcement','starter_drone'].includes(id)?1:
                    ['starter_guard','defense_marksman','defense_medic','artifact_scanner','spell_charge_boost'].includes(id)?2:j;
                const dx=id==='production_components'||id==='defense_marksman'?-box.w/22:
                    id==='production_efficiency'||id==='defense_medic'?box.w/22:0;
                positions.set(id,{x:x+dx,y:baseY+depth*dy});
            });
        });
        return positions;
    }
    domainPositions(tree,box) {
        const result=new Map(),rootX=box.x+box.w/2,rootY=box.y+41;
        result.set('root',{x:rootX,y:rootY});
        const byId=new Map(tree.map(t=>[t.id,t]));
        const children=new Map();
        for(const t of tree){const key=byId.has(t.parent)?t.parent:'root';const list=children.get(key)||[];list.push(t);children.set(key,list);}
        const roots=children.get('root')||[];
        const availableHeight=Math.max(55,box.h-113);
        // A column per independent root, with equally spaced levels.
        roots.forEach((root,index)=>{
            const cx=box.x+(index+1)*box.w/(roots.length+1);
            const queue=[{node:root,depth:0}];
            const descendants=[];
            while(queue.length){const item=queue.shift();descendants.push(item);for(const c of children.get(item.node.id)||[])queue.push({node:c,depth:item.depth+1});}
            const levels=Math.max(1,...descendants.map(d=>d.depth+1));
            const rows=new Map();
            for(const item of descendants){const list=rows.get(item.depth)||[];list.push(item.node);rows.set(item.depth,list);}
            for(const [depth,items] of rows)items.forEach((n,j)=>{
                const span=Math.min(64,box.w/(Math.max(roots.length,1)*2));
                result.set(n.id,{x:cx+(j-(items.length-1)/2)*span,y:rootY+30+(depth+.5)*availableHeight/levels});
            });
        });
        return result;
    }
    glyph(id){return id.includes('vision')||id.includes('scanner')?'◇':id.includes('unit')||id.includes('guard')?'✚':id.includes('resource')||id.includes('scrap')?'▣':'✦';}
    selected() {
        if(!this.selectedId)return null;
        const [domain,id]=this.selectedId.split(':');
        const talent=(this.talentTrees[domain]||[]).find(n=>n.id===id);
        return talent?{...talent,domain}:null;
    }
    renderDetails(keep,g,b) {
        const p=this.palette,x=b.panelX,w=b.side,h=b.area.h;
        g.fillStyle(p.panel,1).fillRoundedRect(x,b.area.y,w,h,6);
        g.lineStyle(1,p.border).strokeRoundedRect(x,b.area.y,w,h,6);
        this.text(keep,x+16,b.area.y+18,'ANALYSE DU TALENT',11,'#62e7e1');
        const talent=this.selected();
        if(!talent){this.text(keep,x+16,b.area.y+68,'Sélectionnez un talent\npour afficher ses détails.',12,p.muted,{wordWrap:{width:w-32}});return;}
        const label=this.domains.find(d=>d.id===talent.domain)?.label||talent.domain;
        this.text(keep,x+16,b.area.y+48,label,10,p.amber);
        this.text(keep,x+16,b.area.y+72,this.name(talent.id),15,p.ink,{wordWrap:{width:w-32}});
        const descKey='talent_'+talent.id+'_description',desc=this.translate(descKey);
        this.text(keep,x+16,b.area.y+128,talent.description|| (desc===descKey?'Effet à préciser pour VNext.':desc),12,'#adc6d3',{wordWrap:{width:w-32},lineSpacing:5});
        const unlocked=this.progress.unlocked.includes(talent.id);
        const parent=talent.parent&&talent.parent!=='root'?talent.parent:null;
        const prereq=(parent&&!this.progress.unlocked.includes(parent))||(talent.prerequisites||[]).some(id=>!this.progress.unlocked.includes(id))||(talent.anyPrerequisites?.length&&!talent.anyPrerequisites.some(id=>this.progress.unlocked.includes(id)))||(talent.excludes||[]).some(id=>this.progress.unlocked.includes(id));
        const affordable=OverseerTalentProgression.canUnlock(this.progress,talent);
        const foot=b.area.y+h-119;
        this.text(keep,x+16,foot,'PRÉREQUIS : '+(parent?this.name(parent):'NOYAU'),10,p.muted,{wordWrap:{width:w-32}});
        this.text(keep,x+16,foot+32,unlocked?'ÉTAT : DÉBLOQUÉ':talent.planned?'ÉTAT : À VENIR':prereq?'ÉTAT : PRÉREQUIS MANQUANT':this.progress.shards<talent.cost?'ÉTAT : ÉCLATS INSUFFISANTS':'ÉTAT : DISPONIBLE',10,unlocked?'#62e7e1':p.amber,{wordWrap:{width:w-32}});
        this.text(keep,x+16,foot+58,unlocked?'ACTIF':talent.planned?'PRIX PROVISOIRE : '+talent.cost+' ÉCLATS':'COÛT : '+talent.cost+' ÉCLATS',11,unlocked?'#62e7e1':p.amber);
        const y=b.area.y+h-29;
        const button=keep(this.add.rectangle(x+w/2,y,w-32,38,affordable?0x164b55:0x203440).setStrokeStyle(1,affordable?p.cyan:p.border));
        this.text(keep,x+w/2,y,unlocked?'DÉBLOQUÉ':talent.planned?'À VENIR':affordable?'DÉBLOQUER':'INDISPONIBLE',11,affordable?'#c4f9f4':p.muted).setOrigin(.5);
        if(affordable)button.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
            const result=OverseerTalentProgression.purchase(this.storage(),talent);
            if(result.ok){this.progress=result.state;this.render();}
        });
    }
}
