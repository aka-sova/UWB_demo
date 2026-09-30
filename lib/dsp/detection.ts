import type {Config,Detection,Pulse,Result,Spot,TimeFrequency,TruthEvent} from "./types";
import {db,fft,halfPowerWidth,powerAt,spectrum} from "./numeric";
import {nominalTime,pulseValue,symbolFits} from "./engine";

function integral(values:Float64Array,rows:number,cols:number){
  const out=new Float64Array((rows+1)*(cols+1));
  for(let r=0;r<rows;r++){let sum=0;for(let c=0;c<cols;c++){sum+=values[r*cols+c];out[(r+1)*(cols+1)+c+1]=out[r*(cols+1)+c+1]+sum;}}
  return (r0:number,c0:number,r1:number,c1:number)=>out[(r1+1)*(cols+1)+c1+1]-out[r0*(cols+1)+c1+1]-out[(r1+1)*(cols+1)+c0]+out[r0*(cols+1)+c0];
}
const osCache=new Map<string,number>();
function osFactor(n:number,k:number,pfa:number){
  const key=[n,k,pfa].join(":");const cached=osCache.get(key);if(cached!==undefined)return cached;
  const logP=(a:number)=>{let v=0;for(let j=0;j<k;j++)v+=Math.log((n-j)/(n-j+a));return v;};
  let lo=0,hi=1;while(logP(hi)>Math.log(pfa))hi*=2;
  for(let it=0;it<45;it++){const m=(lo+hi)/2;if(logP(m)>Math.log(pfa))lo=m;else hi=m;}
  osCache.set(key,(lo+hi)/2);return (lo+hi)/2;
}
export function thresholdCells(tf:TimeFrequency,c:Config){
  const {frames:R,bins:C,power}=tf,mask=new Uint8Array(power.length),thresholds=new Float64Array(power.length),noise=new Float64Array(power.length);
  const sum=integral(power,R,C),tg=c.guard,fg=c.guard*4,tw=tg+c.training,fw=fg+3;
  const sorted=Array.from(power).sort((a,b)=>a-b),floor=Math.max(1e-30,sorted[Math.floor(sorted.length/2)]/Math.log(2));
  for(let r=0;r<R;r++)for(let f=0;f<C;f++){
    const idx=r*C+f;
    if(c.detector==="fixed"){noise[idx]=floor;thresholds[idx]=floor*Math.pow(10,c.thresholdDb/10);}
    else{
      const r0=Math.max(0,r-tw),r1=Math.min(R-1,r+tw),f0=Math.max(0,f-fw),f1=Math.min(C-1,f+fw);
      const g0=Math.max(0,r-tg),g1=Math.min(R-1,r+tg),h0=Math.max(0,f-fg),h1=Math.min(C-1,f+fg);
      const n=(r1-r0+1)*(f1-f0+1)-(g1-g0+1)*(h1-h0+1);
      if(c.detector==="ca"){
        const avg=Math.max(1e-30,(sum(r0,f0,r1,f1)-sum(g0,h0,g1,h1))/Math.max(1,n));
        noise[idx]=avg;thresholds[idx]=avg*n*(Math.pow(c.pfa,-1/n)-1);
      }else{
        const train:number[]=[];
        for(let i=r0;i<=r1;i++)for(let j=f0;j<=f1;j++)if(i<g0||i>g1||j<h0||j>h1)train.push(power[i*C+j]);
        train.sort((a,b)=>a-b);const k=Math.max(1,Math.ceil(train.length*.75)),stat=train[k-1];
        let expected=0;for(let j=0;j<k;j++)expected+=1/(n-j);
        noise[idx]=Math.max(1e-30,stat/expected);thresholds[idx]=Math.max(1e-30,stat)*osFactor(n,k,c.pfa);
      }
    }
    mask[idx]=power[idx]>thresholds[idx]?1:0;
  }
  return {mask,thresholds,noise};
}
export function connectedSpots(tf:TimeFrequency,mask:Uint8Array,minCells:number):Spot[]{
  const {frames:R,bins:C}=tf,visited=new Uint8Array(mask.length),spots:Spot[]=[];
  const dt=tf.times.length>1 ? tf.times[1]-tf.times[0]:0;
  for(let idx=0;idx<mask.length;idx++){
    if(!mask[idx]||visited[idx])continue;
    const queue=[idx],cells:number[]=[];visited[idx]=1;
    let start=Infinity,end=-Infinity,low=Infinity,high=-Infinity,e=0,weighted=0,peak=0;
    for(let q=0;q<queue.length;q++){
      const k=queue[q],r=Math.floor(k/C),f=k%C,p=tf.power[k];cells.push(k);
      start=Math.min(start,tf.times[r]-dt/2);end=Math.max(end,tf.times[r]+dt/2);
      low=Math.min(low,tf.frequencies[f]-tf.binSpacing/2);high=Math.max(high,tf.frequencies[f]+tf.binSpacing/2);
      e+=p;weighted+=p*tf.frequencies[f];peak=Math.max(peak,p);
      for(let dr=-1;dr<=1;dr++)for(let df=-1;df<=1;df++){
        const rr=r+dr,ff=f+df,j=rr*C+ff;
        if(rr>=0&&rr<R&&ff>=0&&ff<C&&!visited[j]&&mask[j]){visited[j]=1;queue.push(j);}
      }
    }
    if(cells.length>=minCells)spots.push({id:spots.length+1,cells,start,end,low,high,centroid:weighted/e,energy:e,peak});
  }
  return spots;
}
export function assemblePulses(tf:TimeFrequency,spots:Spot[],iq:Float64Array,c:Config,matched?:Float64Array):Pulse[]{
  const groups:Spot[][]=[];
  for(const s of [...spots].sort((a,b)=>a.start-b.start)){
    const found=groups.find(g=>{
      const end=Math.max(...g.map(v=>v.end)),start=Math.min(...g.map(v=>v.start));
      return s.start<=end+c.mergeGap && s.end>=start-c.mergeGap;
    });
    if(found)found.push(s);else groups.push([s]);
  }
  const pulses:Pulse[]=[],fs=c.sampleRate,n=iq.length/2;
  const recordPowers=Array.from({length:n},(_,i)=>powerAt(iq,i)).sort((a,b)=>a-b);
  const recordNoise=recordPowers[Math.floor(n/2)]/Math.log(2);
  const step=2*c.fullScale/2**c.bits,top=(2**(c.bits-1)-1)*step-step/2,bottom=-c.fullScale+step/2;
  const onRail=(k:number)=>!c.realRF&&(iq[2*k]>=top||iq[2*k]<=bottom||iq[2*k+1]>=top||iq[2*k+1]<=bottom);
  const smooth=(i:number)=>(powerAt(iq,i-1)+2*powerAt(iq,i)+powerAt(iq,i+1))/4;
  let lastPeak=-Infinity,lastWidth=0;
  for(const group of groups){
    const start=Math.max(0,Math.min(...group.map(s=>s.start))-tf.windowDuration/2);
    const end=Math.min(n/fs,Math.max(...group.map(s=>s.end))+tf.windowDuration/2);
    let peak=Math.max(1,Math.floor(start*fs));
    for(let i=peak+1;i<Math.min(n-1,Math.ceil(end*fs));i++)if(powerAt(iq,i)>powerAt(iq,peak))peak=i;
    const peaks=[peak];
    // Gaussian-envelope deblending: retain a second peak only if the intervening
    // valley falls below half of the weaker peak. No source event times are used.
    if(c.family==="gaussian"){
      const candidates:number[]=[];
      for(let i=Math.max(2,Math.floor(start*fs));i<Math.min(n-2,Math.ceil(end*fs));i++)
        if(smooth(i)>smooth(i-1)&&smooth(i)>=smooth(i+1)&&smooth(i)>.15*smooth(peak))candidates.push(i);
      candidates.sort((a,b)=>smooth(b)-smooth(a));
      for(const candidate of candidates){
        if(peaks.length>=16)break;
        const separate=peaks.every(p=>{if(Math.abs(candidate-p)<3)return false;let valley=Infinity;for(let i=Math.min(p,candidate);i<=Math.max(p,candidate);i++)valley=Math.min(valley,smooth(i));return valley<.5*Math.min(smooth(p),smooth(candidate));});
        if(separate)peaks.push(candidate);
      }
    }
    // First-arrival search: CFAR training around a strong arrival can mask an earlier, weaker
    // path. Look back for the earliest local maximum above the energy threshold over record noise.
    let firstPath=-1;
    if(c.searchBack>0){
      const earliest=Math.min(...peaks),w=halfPowerWidth(iq,peaks[0],fs),limit=recordNoise*10**(c.thresholdDb/10);
      const from=Math.max(2,Math.floor((earliest/fs-c.searchBack)*fs),Math.ceil(lastPeak+3*lastWidth*fs)),to=earliest-Math.ceil(3*w*fs);
      for(let i=from;i<to;i++)if(smooth(i)>limit&&smooth(i)>smooth(i-1)&&smooth(i)>=smooth(i+1)){firstPath=i;peaks.push(i);break;}
    }
    for(const refined of peaks.sort((a,b)=>a-b)){
    peak=refined;
    const p0=powerAt(iq,Math.max(0,peak-1)),p1=powerAt(iq,peak),p2=powerAt(iq,Math.min(n-1,peak+1));
    let time=(peak+Math.max(-.5,Math.min(.5,.5*(p0-p2)/(p0-2*p1+p2||1))))/fs;
    // A peak on the ADC rails is a flat plateau: its first sample is not the arrival time.
    if(matched&&c.family!=="gaussian"){
      // Derivative pulses peak on a lobe (±σ) and chirps have long envelopes: time the arrival
      // from the known-template correlation, which peaks at the pulse center.
      const radius=Math.ceil(2*c.sigma*fs);let m=Math.max(1,peak-radius);
      for(let i=m+1;i<=Math.min(n-2,peak+radius);i++)if(matched[i]>matched[m])m=i;
      const m0=matched[m-1],m1=matched[m],m2=matched[m+1];
      time=(m+Math.max(-.5,Math.min(.5,.5*(m0-m2)/(m0-2*m1+m2||1))))/fs;
    }else if(onRail(peak)){let l=peak,r=peak;while(l>0&&onRail(l-1))l--;while(r<n-1&&onRail(r+1))r++;time=(l+r)/2/fs;}
    const width=halfPowerWidth(iq,peak,fs),localSize=Math.min(2048,Math.max(256,2**Math.ceil(Math.log2(width*fs*8))));
    const local=new Float64Array(localSize*2),left=peak-localSize/2;
    let pulseEnergy=0,clipped=false;
    for(let j=0;j<localSize;j++){const k=left+j;if(k>=0&&k<n){local[2*j]=iq[2*k];local[2*j+1]=iq[2*k+1];if(Math.abs(k-peak)<=width*fs*2){pulseEnergy+=powerAt(iq,k)/fs;clipped ||= Math.abs(iq[2*k])>=c.fullScale*.99||Math.abs(iq[2*k+1])>=c.fullScale*.99;}}}
    const spec=spectrum(local,fs),max=Math.max(...spec.psd);
    let low=Infinity,high=-Infinity,weight=0,weighted=0;
    for(let j=0;j<spec.psd.length;j++)if(spec.psd[j]>=max*.1){low=Math.min(low,spec.frequency[j]);high=Math.max(high,spec.frequency[j]);weight+=spec.psd[j];weighted+=spec.psd[j]*spec.frequency[j];}
    const edge:number[]=[];
    for(let i=Math.max(0,Math.floor(start*fs));i<Math.min(n,Math.ceil(end*fs));i++)if(Math.abs(i-peak)>3*width*fs)edge.push(powerAt(iq,i));
    edge.sort((a,b)=>a-b);const noise=edge.length?edge[Math.floor(edge.length/2)]/Math.log(2):recordNoise;
    pulses.push({id:pulses.length+1,time,width,amplitude:Math.sqrt(p1),energy:pulseEnergy,frequency:c.carrier+weighted/Math.max(weight,1e-30),bandwidth:high-low,snr:db(p1/Math.max(1e-30,noise)),spotIds:group.map(v=>v.id),start,end,clipped,train:0,firstPath:refined===firstPath||undefined});
    if(refined>lastPeak){lastPeak=refined;lastWidth=width;}
    }
  }
  // Frequency-consistent candidate trains. This heuristic deliberately exposes ambiguous merges.
  const trainCenters:number[]=[];
  for(const p of pulses){let train=trainCenters.findIndex(f=>Math.abs(f-p.frequency)<Math.max(.15e9,p.bandwidth*.25));if(train<0){train=trainCenters.length;trainCenters.push(p.frequency);}p.train=train+1;}
  // Number trains by membership (ties by first appearance) so train 1 is the dominant candidate.
  const counts=trainCenters.map((_,i)=>pulses.filter(p=>p.train===i+1).length);
  const order=counts.map((_,i)=>i).sort((a,b)=>counts[b]-counts[a]||a-b),label=new Map(order.map((t,i)=>[t+1,i+1]));
  for(const p of pulses)p.train=label.get(p.train)!;
  return pulses;
}
export function inverseSTFT(tf:TimeFrequency,c:Config,n:number,mask?:Uint8Array){
  const y=new Float64Array(n*2),denom=new Float64Array(n),L=tf.window.length,F=tf.fullBins,hop=Math.min(c.hop,L/2);
  for(let frame=0;frame<tf.frames;frame++){
    const block=tf.complex.slice(frame*F*2,(frame+1)*F*2);
    if(mask){
      const keep=new Uint8Array(F);
      for(let b=0;b<tf.bins;b++)if(mask[frame*tf.bins+b])keep[(tf.indices[b]+F/2)%F]=1;
      for(let k=0;k<F;k++)if(!keep[k]){block[2*k]=0;block[2*k+1]=0;}
    }
    const samples=fft(block,true),start=frame*hop-L/2;
    for(let j=0;j<L;j++){const k=start+j;if(k>=0&&k<n){const w=tf.window[j];y[2*k]+=samples[2*j]*w;y[2*k+1]+=samples[2*j+1]*w;denom[k]+=w*w;}}
  }
  for(let k=0;k<n;k++)if(denom[k]>1e-15){y[2*k]/=denom[k];y[2*k+1]/=denom[k];}
  return y;
}
export function matchedFilter(iq:Float64Array,c:Config){
  const n=iq.length/2,half=Math.ceil(6*c.sigma*c.sampleRate),m=half*2+1,size=2**Math.ceil(Math.log2(n+m-1));
  const a=new Float64Array(size*2),b=new Float64Array(size*2);a.set(iq);let norm=0;
  for(let j=0;j<m;j++){const [re,im]=pulseValue((half-j)/c.sampleRate,{...c,amplitude:1,normalization:"peak"});b[2*j]=re;b[2*j+1]=-im;norm+=re*re+im*im;}
  const A=fft(a),B=fft(b);
  for(let k=0;k<size;k++){const ar=A[2*k],ai=A[2*k+1];A[2*k]=ar*B[2*k]-ai*B[2*k+1];A[2*k+1]=ar*B[2*k+1]+ai*B[2*k];}
  const conv=fft(A,true);
  return Float64Array.from({length:n},(_,i)=>Math.hypot(conv[2*(i+half)],conv[2*(i+half)+1])/Math.max(norm,1e-30));
}
function templateFit(iq:Float64Array,pulses:Pulse[],c:Config){
  const out=new Float64Array(iq.length),fs=c.sampleRate;
  for(const p of pulses){
    const sigma=c.family==="gaussian"?p.width/(2*Math.sqrt(Math.log(2))):c.sigma;
    const start=Math.max(0,Math.floor((p.time-6*sigma)*fs)),end=Math.min(iq.length/2,Math.ceil((p.time+6*sigma)*fs));
    const vals:number[]=[];let ar=0,ai=0,norm=0;
    for(let i=start;i<end;i++){
      const t=i/fs-p.time,[r,b]=pulseValue(t,{...c,sigma,amplitude:1,normalization:"peak"}),phase=2*Math.PI*(p.frequency-c.carrier)*t;
      const re=r*Math.cos(phase)-b*Math.sin(phase),im=r*Math.sin(phase)+b*Math.cos(phase);
      vals.push(re,im);ar+=iq[2*i]*re+iq[2*i+1]*im;ai+=iq[2*i+1]*re-iq[2*i]*im;norm+=re*re+im*im;
    }
    ar/=Math.max(norm,1e-30);ai/=Math.max(norm,1e-30);
    for(let i=start;i<end;i++){const j=(i-start)*2;out[2*i]+=ar*vals[j]-ai*vals[j+1];out[2*i+1]+=ar*vals[j+1]+ai*vals[j];}
  }
  return out;
}
export function evaluateEvents(pulses:Pulse[],truth:TruthEvent[],tolerance=2e-9){
  const candidates:{pi:number;ti:number;error:number}[]=[];
  pulses.forEach((p,pi)=>truth.forEach((t,ti)=>{const error=Math.abs(p.time-t.time);if(error<=tolerance)candidates.push({pi,ti,error});}));
  candidates.sort((a,b)=>a.error-b.error);const usedP=new Set<number>(),usedT=new Set<number>();let sum=0;
  for(const m of candidates)if(!usedP.has(m.pi)&&!usedT.has(m.ti)){usedP.add(m.pi);usedT.add(m.ti);pulses[m.pi].match=truth[m.ti].id;pulses[m.pi].error=pulses[m.pi].time-truth[m.ti].time;sum+=m.error*m.error;}
  return {matchedCount:usedP.size,missed:truth.length-usedT.size,falseEvents:pulses.length-usedP.size,timingRmse:usedP.size?Math.sqrt(sum/usedP.size):NaN};
}
export function analyze(r:Result):Detection{
  const c=r.config,det=thresholdCells(r.tf,c),candidateMask=det.mask.slice();
  if(c.rejectTones)for(let f=0;f<r.tf.bins;f++){
    let occupied=0;for(let t=0;t<r.tf.frames;t++)occupied+=candidateMask[t*r.tf.bins+f];
    if(occupied/r.tf.frames>.6)for(let t=0;t<r.tf.frames;t++)candidateMask[t*r.tf.bins+f]=0;
  }
  const matched=matchedFilter(r.iq,c),spots=connectedSpots(r.tf,candidateMask,c.minCells),pulses=assemblePulses(r.tf,spots,r.iq,c,matched);
  // Only retained components contribute to the reconstruction mask.
  const cleanMask=new Uint8Array(det.mask.length);for(const s of spots)for(const k of s.cells)cleanMask[k]=1;
  const recovered=inverseSTFT(r.tf,c,r.time.length,cleanMask),unmasked=inverseSTFT(r.tf,c,r.time.length);
  const fitted=templateFit(r.iq,pulses,c);
  let mse=0,roundTrip=0,total=0;
  for(let i=0;i<r.iq.length;i++){mse+=(r.iq[i]-recovered[i])**2;roundTrip+=(r.iq[i]-unmasked[i])**2;total+=r.iq[i]**2;}
  const energyTrace=new Float64Array(r.time.length),span=Math.max(1,Math.round(c.sigma*c.sampleRate));let rolling=0;
  for(let i=0;i<energyTrace.length;i++){rolling+=powerAt(r.iq,i);if(i>=span)rolling-=powerAt(r.iq,i-span);energyTrace[i]=rolling/Math.min(i+1,span);}
  const orderedEnergy=Array.from(energyTrace).sort((a,b)=>a-b);
  const energyThreshold=Math.max(1e-30,orderedEnergy[Math.floor(orderedEnergy.length/2)])*Math.pow(10,c.thresholdDb/10);
  const energyEvents:number[]=[];let energyPeak=-1;
  for(let i=0;i<=energyTrace.length;i++){
    if(i<energyTrace.length&&energyTrace[i]>energyThreshold){if(energyPeak<0||energyTrace[i]>energyTrace[energyPeak])energyPeak=i;}
    else if(energyPeak>=0){energyEvents.push((energyPeak-(span-1)/2)/c.sampleRate);energyPeak=-1;}
  }
  const train=pulses.filter(p=>p.train===1).sort((a,b)=>a.time-b.time),intervals=train.slice(1).map((p,i)=>p.time-train[i].time);
  const sorted=[...intervals].sort((a,b)=>a-b),pri=sorted.length?sorted[Math.floor(sorted.length/2)]:NaN;
  const priJitter=intervals.length?Math.sqrt(intervals.reduce((s,t)=>s+(t-pri)**2,0)/intervals.length):NaN;
  const expected:number[]=[],decoded:number[]=[],early:number[]=[],late:number[]=[];
  if(c.ppm)for(let j=0;j<c.count;j++){
    if(!symbolFits(j,c))continue;const nominal=nominalTime(j,c);
    const score=(t:number)=>{let v=0;const k=Math.round(t*c.sampleRate),radius=Math.max(1,Math.round(c.sigma*c.sampleRate));for(let i=Math.max(0,k-radius);i<Math.min(matched.length,k+radius+1);i++)v=Math.max(v,matched[i]);return v;};
    const a=score(nominal),b=score(nominal+c.slot);early.push(a);late.push(b);decoded.push(b>a?1:0);
    expected.push(r.truth.find(t=>t.id==="A"+(j+1))?.bit??0);
  }
  const evaluation=evaluateEvents(pulses,r.truth);
  return {...det,spots,pulses,recovered,fitted,matched,energyTrace,energyThreshold,energyEvents,...evaluation,
    reconstructionError:Math.sqrt(mse/Math.max(total,1e-30)),unmaskedError:Math.sqrt(roundTrip/Math.max(total,1e-30)),pri,priJitter,
    ppm:{expected,decoded,errors:expected.filter((v,i)=>v!==decoded[i]).length,early,late}};
}
