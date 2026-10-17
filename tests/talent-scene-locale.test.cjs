'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/scene/TalentScene.js'),'utf8');
const {Scene}=vm.runInNewContext(source+'\n({Scene:TalentScene});',{
 Phaser:{Scene:class{}},OverseerTalentCatalog:{trees:{}}
});
test('French talent dashboard uses French text irrespective of user language',()=>{
 const scene=new Scene();
 let loaded;
 scene.load={json:(key,file)=>{loaded={key,file};}};
 scene.preload();
 assert.equal(loaded.key,'gameTexts');
 assert.equal(loaded.file,'assets/game_texts_fr.json');
});
test('legacy talent names and descriptions are in French',()=>{
 const scene=new Scene();
 scene.gameTexts=JSON.parse(fs.readFileSync(path.join(root,'assets/game_texts_fr.json'),'utf8'));
 assert.equal(scene.name('starter_base_hp'),'Base renforcée');
 assert.equal(scene.name('adjacency_bonus_scrap'),'Adjacence Mines de Ferraille');
 assert.ok(scene.translate('talent_adjacency_bonus_scrap_description').includes('mines'));
});
