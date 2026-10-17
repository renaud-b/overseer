// Renderer-only pause/session menu; the ECS and persisted wallet are untouched.
(function(root){
'use strict';
class OverseerVNextPauseMenu {
 constructor(scene,onClose=()=>{}) {
  this.scene=scene;this.onClose=onClose;this.objects=[];this.confirm=false;this.closed=false;
 }
 keep(o){this.objects.push(o);return o;}
 clear(){this.objects.forEach(o=>o.destroy());this.objects=[];}
 text(x,y,value,size=13,color='#dfeaf0',depth=502){
  return this.keep(this.scene.add.text(x,y,value,{fontFamily:'monospace',
   fontSize:size+'px',color,wordWrap:{width:Math.max(165,this.width-42)}}).setDepth(depth));
 }
 action(x,y,label,callback,color='#62e7e1',depth=503){
  const obj=this.text(x,y,label,13,color,depth).setInteractive({useHandCursor:true});
  obj.on('pointerdown',callback);
  return obj;
 }
 open(){
  this.render();
  this.resize=()=>this.render();
  this.scene.scale.on('resize',this.resize);
 }
 render(){
  if(this.closed)return;
  this.clear();
  const {width:w,height:h}=this.scene.scale;
  this.width=Math.min(460,w-30);
  const x=(w-this.width)/2,top=Math.max(12,(h-335)/2),left=x+24;
  const g=this.keep(this.scene.add.graphics().setDepth(500));
  this.keep(this.scene.add.zone(w/2,h/2,w,h).setInteractive().setDepth(501));
  g.fillStyle(0x0b1d2b,1).fillRoundedRect(x,top,this.width,335,8);
  g.lineStyle(1,0x346274,0.9).strokeRoundedRect(x,top,this.width,335,8);
  this.text(left,top+19,'OVERSEER / SESSION',11,'#62e7e1');
  this.text(left,top+52,'MENU DE PAUSE',22);
  const wallet=this.scene.memoryShardsBalance();
  this.text(left,top+104,'ÉCLATS CONSERVÉS : '+wallet,12,'#f5b94f');
  this.action(left,top+155,'▶ REPRENDRE LA PARTIE',()=>this.close());
  this.action(left,top+203,'⚙ OPTIONS',()=>this.scene.openOptionsFromPause());
  this.action(left,top+252,'ABANDONNER LA PARTIE',()=>{this.confirm=true;this.render();},'#ff8a91');
  if(!this.confirm)return;
  const layer=this.keep(this.scene.add.graphics().setDepth(510));
  layer.fillStyle(0x08121c,0.62).fillRect(0,0,w,h);
  this.keep(this.scene.add.zone(w/2,h/2,w,h).setInteractive().setDepth(511));
  const cy=Math.max(12,(h-214)/2);
  layer.fillStyle(0x091923,1).fillRoundedRect(x+8,cy,this.width-16,214,6);
  layer.lineStyle(1,0xff6674,0.9).strokeRoundedRect(x+8,cy,this.width-16,214,6);
  this.text(left,cy+20,'ABANDONNER LA PARTIE ?',16,'#ff8a91',512);
  this.text(left,cy+62,'La sauvegarde de cette partie sera effacée.\nTes Éclats de mémoire et talents seront conservés.',11,'#dfeaf0',512);
  this.action(left,cy+161,'ANNULER',()=>{this.confirm=false;this.render();},'#62e7e1',513);
  this.action(x+this.width-172,cy+161,'CONFIRMER',()=>this.scene.abandonRun(),'#ff8a91',513);
 }
 close(silent=false){
  if(this.closed)return;
  this.closed=true;
  this.scene.scale.off('resize',this.resize);
  this.clear();
  if(!silent)this.onClose();
 }
}
root.OverseerVNextPauseMenu=OverseerVNextPauseMenu;
if(typeof module!=='undefined'&&module.exports)module.exports=OverseerVNextPauseMenu;
})(globalThis);
