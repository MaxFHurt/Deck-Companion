const {run,ctx,fs}=require('./h.js');ctx.__T=JSON.parse(fs.readFileSync(__dirname+'/data/truth.json'));
const MAP={removal:['removal','creature-removal','spot-removal','bite','edict'],wipe:['boardwipe'],ramp:['ramp','mana-rock','mana-dork'],draw:['draw'],counter:['counterspell'],tutor:['tutor'],protect:['protection','gives-hexproof','gives-indestructible','gives-protection','fog']};ctx.__M=MAP;
const r=run(`(()=>{const out={};const S={};for(const j in __M){S[j]=new Set();__M[j].forEach(k=>(__T[k]||[]).forEach(n=>S[j].add(norm(n))))}
 // a wipe is not counted as missed spot removal and vice versa
 const cards=LIB.filter(c=>c.cmd&&!/\\bLand\\b/.test(frontType(c)));
 for(const j in __M){let tp=0,fp=0,fn=0;const FP=[],FN=[];cards.forEach(c=>{c._t=undefined;const R=tags(c).roles;const has=R.has(j)||(j==='removal'&&R.has('wipe')),tr=j==='tutor'?(S[j].has(c._n)&&!S.ramp.has(c._n)):S[j].has(c._n);if(has&&tr)tp++;else if(has){fp++;if(c.r&&c.r<3000)FP.push(c.n)}else if(tr){fn++;if(c.r&&c.r<2500)FN.push(c.n)}});
  out[j]={truth:S[j].size,tagged:tp+fp,precision:Math.round(100*tp/Math.max(1,tp+fp)),recall:Math.round(100*tp/Math.max(1,tp+fn)),FP:FP.slice(0,14),FN:FN.sort((a,b)=>find(a).r-find(b).r).slice(0,22)}}
 const chk=['Monstrous Onslaught','Arachnogenesis','Bite Down',"Ezuri's Predation",'Whiptongue Hydra','Thrashing Brontodon','Meteor Golem','Palace Jailer','Acidic Slime','Scrapshooter','Collective Resistance','Kogla, the Titan Ape','Heroic Intervention','Avenge','Swiftfoot Boots','Whispersilk Cloak'].map(n=>{const c=find(n);return n+': app ['+[...tags(c).roles].join(',')+'] truth ['+Object.keys(S).filter(j=>S[j].has(c._n)).join(',')+']'});
 return {out,chk}})()`);
for(const j in r.out){const o=r.out[j];console.log(j.padEnd(8),'truth',String(o.truth).padStart(5),'tagged',String(o.tagged).padStart(5),'precision',o.precision+'%','recall',o.recall+'%');if(process.env.V){console.log('   missed (popular):',o.FN.join('; '));console.log('   wrongly tagged (popular):',o.FP.join('; '))}}
console.log(r.chk.join('\n'));
