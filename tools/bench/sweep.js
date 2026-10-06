const {go}=require('./setbench.js');const RESET=process.env.RESET||'';
const line=(lab,o)=>{const t={slots:0,cut:0,add:0,any:0,fpc:0,fpa:0};for(const k in o){const x=o[k];t.slots+=x.slots;t.cut+=x.cutHit.length;t.add+=x.addHit.length;t.any+=x.addAny.length;t.fpc+=x.fpCut.length;t.fpa+=x.fpAdd.length}
 const tr=o['Tramplesaurus Rex'],j=tr.jobs;const per=Object.keys(o).map(k=>k.slice(0,3)+' '+o[k].slots+'/'+o[k].cutHit.length+'/'+o[k].addHit.length).join('  ');
 console.log(lab.padEnd(44),'cut',String(t.cut).padStart(2),'add',String(t.add).padStart(2),'any',String(t.any).padStart(2),'| wrongCut',String(t.fpc).padStart(2),'wrongAdd',String(t.fpa).padStart(2),'| slots',String(t.slots).padStart(2),'| TR ramp',j.ramp[1],'draw',j.draw[1],'rem',j.removal[1],'wipe',j.wipe[1],'|',per);return t};
const cfgs=JSON.parse(process.env.CFGS);const t0=Date.now();
for(const c of cfgs)line(c,go('Object.assign({},'+(RESET||'{}')+','+c+')'));
console.error('sec',(Date.now()-t0)/1000);
