import {mkdirSync,writeFileSync} from "node:fs";
import {runValidation} from "../lib/dsp/validation";
import {scenarioConfig} from "../lib/scenarios";

const results=["bandwidth","reflectors","weak","ppm"].map(id=>{
  const result=runValidation(scenarioConfig(id),16,()=>{});
  console.log(id,JSON.stringify({matched:result.matched,events:result.events,falseEvents:result.falseEvents,timingPs:result.timingRmse*1e12,cellPfa:result.cellFalseAlarm,meanMs:result.meanMs}));
  return {scenario:id,...result};
});
mkdirSync("docs",{recursive:true});
writeFileSync("docs/validation-results.json",JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),runtime:process.version,platform:process.platform,method:"16 seeded records per scenario; separate white-noise STFT records for per-cell false-alarm measurement. Node timings exclude UI rendering.",results},null,2)+"\n");
