import {test} from "node:test";
import assert from "node:assert/strict";
import {defaults} from "../lib/dsp/types";
import {fft,energy,random,powerAt,lowpass} from "../lib/dsp/numeric";
import {configSchema} from "../lib/config-schema";
import {simulateAcquisition,stft,pulseValue} from "../lib/dsp/engine";
import {analyze,inverseSTFT,matchedFilter,thresholdCells} from "../lib/dsp/detection";
import {scenarios,scenarioConfig} from "../lib/scenarios";

test("complex FFT round trip and Parseval energy",()=>{
  const r=random(12),x=Float64Array.from({length:2048},()=>r.normal()),f=fft(x),y=fft(f,true);
  let error=0;for(let i=0;i<x.length;i++)error=Math.max(error,Math.abs(x[i]-y[i]));
  assert.ok(error<1e-12);assert.ok(Math.abs(energy(x,1)-energy(f,1024))/energy(x,1)<1e-12);
});
test("Gaussian measured power FWHM and -10 dB bandwidth follow analytic values",()=>{
  const a=simulateAcquisition({...defaults,count:1,snr:40});
  const expectedT=2*Math.sqrt(Math.log(2))*defaults.sigma;
  const expectedB=Math.sqrt(Math.log(10))/(Math.PI*defaults.sigma);
  assert.ok(Math.abs(a.sourceWidth/expectedT-1)<.002);
  assert.ok(Math.abs(a.sourceBandwidth/expectedB-1)<.01);
  const b=simulateAcquisition({...defaults,count:1,sigma:defaults.sigma/2,normalization:"energy"});
  assert.ok(Math.abs(b.sourceEnergy/a.sourceEnergy-1)<1e-9);
  assert.ok(Math.abs(b.sourceBandwidth/a.sourceBandwidth-2)<.02);
});
test("unmasked STFT reconstructs complex samples including boundaries",()=>{
  const rng=random(80),x=Float64Array.from({length:4096},()=>rng.normal());
  for(const window of ["hann","hamming","rectangular"] as const){
    const c={...defaults,window,windowSize:128,fftSize:512,hop:32},tf=stft(x,c),y=inverseSTFT(tf,c,x.length/2);
    let e=0;for(let i=0;i<x.length;i++)e=Math.max(e,Math.abs(x[i]-y[i]));assert.ok(e<1e-12,window+" max error "+e);
  }
});
test("correlation peaks at the known fractional arrival within one sample",()=>{
  const c={...defaults,count:1},n=4096,fs=c.sampleRate,t0=90.123e-9,x=new Float64Array(n*2);
  for(let i=0;i<n;i++){const p=pulseValue(i/fs-t0,c);x[2*i]=p[0];x[2*i+1]=p[1];}
  const y=matchedFilter(x,c);let p=0;for(let i=1;i<y.length;i++)if(y[i]>y[p])p=i;
  assert.ok(Math.abs(p/fs-t0)<1/fs);
});
test("default isolated pulse train yields correct events and bounded timing error",()=>{
  const result=simulateAcquisition(defaults),d=analyze(result);
  console.log("default detection",{spots:d.spots.length,pulses:d.pulses.length,matches:d.matchedCount,false:d.falseEvents,rmseNs:d.timingRmse*1e9});
  assert.equal(d.matchedCount,5);assert.equal(d.falseEvents,0);assert.ok(d.timingRmse<.2e-9);
  assert.ok(d.unmaskedError<1e-12);
});
test("all scenarios produce finite numerical outputs and PPM decisions use correlation",()=>{
  for(const s of scenarios){
    const start=performance.now(),r=simulateAcquisition(scenarioConfig(s.id)),d=analyze(r);
    assert.ok(r.tf.power.every(Number.isFinite));assert.ok(d.recovered.every(Number.isFinite));
    console.log(s.id,{ms:Math.round(performance.now()-start),pulses:d.pulses.length,matched:d.matchedCount,truth:r.truth.length,clipped:r.clipped,ppm:d.ppm.errors});
    if(s.id==="ppm")assert.equal(d.ppm.errors,0);
  }
});
test("white-noise CFAR produces nontrivial, bounded empirical cell false alarms",()=>{
  const rng=random(62),x=Float64Array.from({length:16384},()=>rng.normal()),c={...defaults,detector:"ca" as const,pfa:.01};
  const tf=stft(x,c),d=thresholdCells(tf,c),rate=d.mask.reduce((s,v)=>s+v,0)/d.mask.length;
  console.log("correlated-STFT empirical Pfa",rate,"requested",c.pfa);
  assert.ok(rate>.001&&rate<.05);
});

test("ADC outputs stay on signed quantizer levels and report overload",()=>{
  const c={...defaults,bits:4,amplitude:6,fullScale:.2},r=simulateAcquisition(c),step=2*c.fullScale/2**c.bits;
  assert.ok(r.clipped>0);
  for(const v of r.adc){assert.ok(v>=-c.fullScale&&v<=c.fullScale-step);assert.ok(Math.abs(v/step-Math.round(v/step))<1e-12);}
});
test("seeded acquisition is reproducible and a new seed changes only stochastic samples",()=>{
  const a=simulateAcquisition(defaults),b=simulateAcquisition(defaults),c=simulateAcquisition({...defaults,seed:43});
  assert.deepEqual(a.iq,b.iq);assert.deepEqual(a.source,c.source);assert.notDeepEqual(a.iq,c.iq);
});
test("anti-alias filtering removes an out-of-band tone before low-rate sampling",()=>{
  const c={...defaults,sampleRate:4e9,interference:1,interferenceOffset:2.5e9,rxBandwidth:8e9,snr:40};
  const unfiltered=simulateAcquisition({...c,antiAlias:false}),filtered=simulateAcquisition({...c,antiAlias:true});
  assert.ok(energy(filtered.iq,c.sampleRate)<.02*energy(unfiltered.iq,c.sampleRate));
});
test("offline FIR compensates group delay on an isolated impulse",()=>{
  const impulse=new Float64Array(1024);impulse[512]=1;
  const output=lowpass(impulse,16e9,2e9);let peak=0;
  for(let i=1;i<512;i++)if(powerAt(output,i)>powerAt(output,peak))peak=i;
  assert.equal(peak,256);
});
test("two-reflector preset resolves both echoes with bounded timing error",()=>{
  const r=simulateAcquisition(scenarioConfig("reflectors")),d=analyze(r);
  assert.equal(d.matchedCount,2);assert.equal(d.falseEvents,0);assert.ok(d.timingRmse<.15e-9);
  assert.ok(d.energyThreshold>0);assert.ok(d.energyEvents.every(Number.isFinite));
});
test("all presets satisfy parameter bounds and invalid sample rates are rejected",()=>{
  for(const s of scenarios)assert.equal(configSchema.safeParse(scenarioConfig(s.id)).success,true,s.id);
  assert.equal(configSchema.safeParse({...defaults,sampleRate:15e9}).success,false);
  assert.equal(configSchema.safeParse({...defaults,sigma:NaN}).success,false);
});
test("real-RF DDC rejects its aliased 2fc mixing image",()=>{
  // fc = 3 GHz at 8 GS/s: the 2fc product aliases to +2 GHz and must not reach the I/Q record.
  const c={...scenarioConfig("sampling"),sampleRate:8e9 as const,snr:40,bits:16},r=simulateAcquisition(c);
  const {frequency,psd}=r.spectrum,peak=Math.max(...psd);
  let image=0;for(let i=0;i<frequency.length;i++)if(Math.abs(frequency[i]-2e9)<.1e9)image=Math.max(image,psd[i]);
  assert.ok(10*Math.log10(image/peak)<-40,"image "+(10*Math.log10(image/peak)).toFixed(1)+" dB");
});
test("receiver filter noise bandwidth follows the bandwidth control",()=>{
  for(const rxBandwidth of [.5e9,1e9,6e9]){
    // Subtract a noise-free record so pulse energy does not bias the noise-bandwidth estimate.
    const r=simulateAcquisition({...defaults,snr:-25,rxBandwidth}),clean=simulateAcquisition({...defaults,snr:40,rxBandwidth});
    const ratio=(energy(r.front,1)-energy(clean.front,1))/(energy(r.channel,1)-energy(clean.channel,1)),expected=rxBandwidth/64e9;
    assert.ok(Math.abs(ratio/expected-1)<.15,rxBandwidth/1e9+" GHz: measured "+(ratio*64).toFixed(2)+" GHz");
  }
});
test("limiter with recovery holds overload at the limit and suppresses only later samples",()=>{
  const c={...scenarioConfig("transient"),snr:40,fullScale:6,echoGain:0},r=simulateAcquisition(c),fs=c.sampleRate;
  let peak=0;for(let i=0;i<r.front.length/2;i++)peak=Math.max(peak,Math.sqrt(powerAt(r.front,i)));
  assert.ok(peak>.98*c.limiter&&peak<=c.limiter*1.001,"peak "+peak.toFixed(3)+" V for a "+c.limiter+" V limit");
  // Recovery memory: the falling edge is attenuated relative to the rising edge.
  const center=Math.round(r.truth[0].time*fs),d=Math.round(1e-9*fs),before=Math.sqrt(powerAt(r.front,center-d)),after=Math.sqrt(powerAt(r.front,center+d));
  assert.ok(after<before,"after "+after.toFixed(3)+" before "+before.toFixed(3));
});
