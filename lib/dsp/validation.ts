import type {Config} from "./types";
import {simulateAcquisition,stft} from "./engine";
import {analyze,thresholdCells} from "./detection";
import {random} from "./numeric";
export interface ValidationResult {
  trials:number;events:number;matched:number;missed:number;falseEvents:number;
  probability:number;cellFalseAlarm:number;requestedPfa:number;timingRmse:number;
  roundTripError:number;meanMs:number;maxMs:number;config:Config;
}
export function runValidation(config:Config,trials:number,onProgress:(done:number)=>void):ValidationResult{
  let events=0,matched=0,missed=0,falseEvents=0,cells=0,falseCells=0,timeSum=0,errorSum=0,maxMs=0,roundTripError=0;
  for(let j=0;j<trials;j++){
    const c={...config,seed:config.seed+j*7919},start=performance.now(),r=simulateAcquisition(c),d=analyze(r),ms=performance.now()-start;
    events+=r.truth.length;matched+=d.matchedCount;missed+=d.missed;falseEvents+=d.falseEvents;
    if(d.matchedCount)errorSum+=d.timingRmse**2*d.matchedCount;
    timeSum+=ms;maxMs=Math.max(maxMs,ms);roundTripError=Math.max(roundTripError,d.unmaskedError);
    // Separate noise-only records estimate per-cell Pfa; this does not use the pulse mask.
    const rng=random(c.seed+200000),noise=Float64Array.from({length:r.iq.length},()=>rng.normal()/Math.sqrt(2));
    const tf=stft(noise,c),nd=thresholdCells(tf,c);cells+=nd.mask.length;
    falseCells+=nd.mask.reduce((s,v)=>s+v,0);onProgress(j+1);
  }
  return {trials,events,matched,missed,falseEvents,probability:matched/Math.max(1,events),cellFalseAlarm:falseCells/Math.max(1,cells),
    requestedPfa:config.pfa,timingRmse:matched?Math.sqrt(errorSum/matched):NaN,roundTripError,meanMs:timeSum/trials,maxMs,config};
}
