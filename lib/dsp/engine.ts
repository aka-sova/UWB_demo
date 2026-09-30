import {Config, Result, TimeFrequency, TruthEvent, DURATION, REFERENCE_RATE} from "./types";
import {energy, fft, halfPowerWidth, lowpass, powerAt, random, resample, spectrum, windowValues} from "./numeric";

export function pulseValue(t: number, c: Config): [number,number] {
  const u=t/c.sigma;
  if(Math.abs(u)>7) return [0,0];
  let value=Math.exp(-u*u/2);
  if(c.family==="monocycle") value*=u*Math.exp(.5);
  if(c.family==="doublet") value*=1-u*u;
  const phase=c.family==="chirp" ? Math.PI*c.chirpBandwidth/(2*c.sigma*Math.sqrt(Math.log(10)))*t*t : 0;
  const norm=c.normalization==="energy" ? Math.sqrt(.6e-9/c.sigma) : 1;
  return [c.amplitude*norm*value*Math.cos(phase),c.amplitude*norm*value*Math.sin(phase)];
}
// Offset of the DDC's 2fc mixing product after aliasing into [−fs/2, fs/2).
export function ddcImage(carrier: number, fs: number) {
  const f=-2*carrier;return f-fs*Math.round(f/fs);
}
export function stft(x: Float64Array, c: Config): TimeFrequency {
  const n=x.length/2, L=c.windowSize, F=Math.max(c.fftSize,L), hop=Math.min(c.hop,L/2);
  const frames=Math.floor((n-1)/hop)+1, w=windowValues(L,c.window);
  let sum=0,ww=0; for(const v of w){sum+=v;ww+=v*v;}
  const span=Math.min(c.sampleRate*.9,Math.max(c.rxBandwidth,3e9));
  const selected:number[]=[];
  for(let k=0;k<F;k++) if(Math.abs((k-F/2)*c.sampleRate/F)<=span/2) selected.push(k);
  const bins=selected.length,indices=Int32Array.from(selected);
  const times=Float64Array.from({length:frames},(_,i)=>i*hop/c.sampleRate);
  const frequencies=Float64Array.from(selected,k=>(k-F/2)*c.sampleRate/F);
  const power=new Float64Array(frames*bins),complex=new Float64Array(frames*F*2);
  const buf=new Float64Array(F*2);let maxPower=0;
  for(let m=0;m<frames;m++) {
    buf.fill(0); const start=m*hop-L/2;
    for(let j=0;j<L;j++) {const idx=start+j;if(idx>=0&&idx<n){buf[2*j]=x[2*idx]*w[j];buf[2*j+1]=x[2*idx+1]*w[j];}}
    const z=fft(buf); complex.set(z,m*F*2);
    for(let b=0;b<bins;b++){
      const k=(selected[b]+F/2)%F,v=powerAt(z,k)/(c.sampleRate*ww);
      power[m*bins+b]=v;maxPower=Math.max(maxPower,v);
    }
  }
  return {times,frequencies,power,complex,bins,frames,fullBins:F,indices,maxPower,window:w,
    enbw:c.sampleRate*ww/(sum*sum),windowDuration:L/c.sampleRate,binSpacing:c.sampleRate/F};
}
export function simulateAcquisition(c: Config): Result {
  const started=performance.now(), fs=REFERENCE_RATE, n=Math.round(DURATION*fs), rng=random(c.seed);
  const truth:TruthEvent[]=[], source=new Float64Array(n*2), channel=new Float64Array(n*2);
  const first=c.count===1 ? 200e-9 : 64e-9;
  for(let j=0;j<c.count;j++) {
    const bit=c.ppm ? (random(c.seed+500+j).uniform()>.5 ? 1:0) : undefined;
    const t=first+j*c.pri+(bit ? c.slot:0)+c.jitter*rng.normal();
    if(t> DURATION-20e-9) continue;
    truth.push({id:"A"+(j+1),time:t,source:"A",kind:"direct",bit});
    if(c.echoGain>0 && t+c.echoDelay<DURATION) truth.push({id:"E"+(j+1),time:t+c.echoDelay,source:"A",kind:"echo"});
    if(c.secondary) {
      const second=first+j*c.pri*1.08+c.secondaryDelay;
      if(second<DURATION-10e-9) truth.push({id:"B"+(j+1),time:second,source:"B",kind:"direct"});
    }
  }
  for(const e of truth) {
    const scale=e.kind==="echo" ? c.echoGain : e.source==="B" ? .7 : 1;
    const offset=e.source==="B" ? c.secondaryOffset:0;
    const start=Math.max(0,Math.floor((e.time-7*c.sigma)*fs)), end=Math.min(n,Math.ceil((e.time+7*c.sigma)*fs));
    for(let i=start;i<end;i++) {
      const t=i/fs-e.time,[pr,pi]=pulseValue(t,c),p=2*Math.PI*offset*t;
      const re=scale*(pr*Math.cos(p)-pi*Math.sin(p)),im=scale*(pr*Math.sin(p)+pi*Math.cos(p));
      channel[2*i]+=re;channel[2*i+1]+=im;
      if(e.kind==="direct"&&e.source==="A") {source[2*i]+=re;source[2*i+1]+=im;}
    }
  }
  const signalPower=energy(source,fs)/DURATION;
  const noisePower=signalPower/Math.pow(10,c.snr/10), sd=Math.sqrt(noisePower/2);
  for(let i=0;i<n;i++) {
    const phase=2*Math.PI*c.interferenceOffset*i/fs;
    channel[2*i]+=sd*rng.normal()+c.interference*Math.cos(phase);
    channel[2*i+1]+=sd*rng.normal()+c.interference*Math.sin(phase);
  }
  let front=lowpass(channel,fs,c.rxBandwidth/2);
  const gain=Math.pow(10,c.gainDb/20);
  let recovery=1;
  const recoverAlpha=c.recovery>0 ? 1-Math.exp(-1/(fs*c.recovery)):1;
  for(let i=0;i<n;i++) {
    const magnitude=Math.sqrt(powerAt(front,i))*gain;
    if(c.recovery===0) recovery=1;
    else if(magnitude>c.limiter) recovery=Math.min(recovery,c.limiter/magnitude);
    else recovery+=(1-recovery)*recoverAlpha;
    const scale=gain*Math.min(1,c.limiter/Math.max(magnitude,1e-30))*recovery;
    front[2*i]*=scale;front[2*i+1]*=scale;
  }
  if(c.realRF) {
    const rf=new Float64Array(front.length);
    for(let i=0;i<n;i++){const phase=2*Math.PI*c.carrier*i/fs;rf[2*i]=front[2*i]*Math.cos(phase)-front[2*i+1]*Math.sin(phase);}
    front=rf;
  }
  const filtered=c.antiAlias ? lowpass(front,fs,.44*c.sampleRate,95):front;
  const step=fs/c.sampleRate, adc=resample(filtered,step), count=adc.length/2;
  const quant=2*c.fullScale/Math.pow(2,c.bits), maxCode=Math.pow(2,c.bits-1)-1, minCode=-Math.pow(2,c.bits-1);
  let clipped=0;
  for(let i=0;i<count;i++){
    if(adc[2*i]>=c.fullScale||adc[2*i]<-c.fullScale||adc[2*i+1]>=c.fullScale||adc[2*i+1]<-c.fullScale)clipped++;
    for(let j=0;j<2;j++)adc[2*i+j]=Math.min(maxCode,Math.max(minCode,Math.round(adc[2*i+j]/quant)))*quant;
  }
  let iq:Float64Array=new Float64Array(adc);
  if(c.realRF) {
    for(let i=0;i<count;i++){const phase=2*Math.PI*c.carrier*i/c.sampleRate; iq[2*i]=2*adc[2*i]*Math.cos(phase);iq[2*i+1]=-2*adc[2*i]*Math.sin(phase);}
    // The mixer's 2fc product aliases to wrap(−2fc); keep the low-pass cutoff halfway to it.
    const image=Math.abs(ddcImage(c.carrier,c.sampleRate));
    iq=lowpass(iq,c.sampleRate,Math.max(c.sampleRate/128,Math.min(c.rxBandwidth/2,.35*c.sampleRate,image/2)));
  }
  const isolated=new Float64Array(n*2);
  let peak=0;
  for(let i=0;i<n;i++){const p=pulseValue(i/fs-DURATION/2,c);isolated[2*i]=p[0];isolated[2*i+1]=p[1];if(powerAt(isolated,i)>powerAt(isolated,peak))peak=i;}
  const isoSpectrum=spectrum(isolated,fs,"rectangular"), max=Math.max(...isoSpectrum.psd);
  let lo=Infinity,hi=-Infinity;
  for(let i=0;i<n;i++)if(isoSpectrum.psd[i]>=max*.1){lo=Math.min(lo,isoSpectrum.frequency[i]);hi=Math.max(hi,isoSpectrum.frequency[i]);}
  return {config:c,time:Float64Array.from({length:count},(_,i)=>i/c.sampleRate),
    source:resample(source,step),channel:resample(channel,step),front:resample(front,step),adc,iq,truth,
    spectrum:spectrum(iq,c.sampleRate),tf:stft(iq,c),clipped,
    sourceBandwidth:hi-lo,sourceWidth:halfPowerWidth(isolated,peak,fs),
    sourceEnergy:energy(isolated,fs),sourcePeak:Math.sqrt(powerAt(isolated,peak)),noisePower,elapsed:performance.now()-started};
}
