import {simulateAcquisition} from "./engine";
import {analyze} from "./detection";
import {runValidation} from "./validation";
import type {Config} from "./types";
import {configSchema} from "../config-schema";
self.onmessage=(event: MessageEvent<{id:number;config:Config;type?:string;trials?:number}>)=>{
  const {id}=event.data;
  try {
    const config=configSchema.parse(event.data.config);
    if(event.data.type==="validate"){
      const trials=Math.max(1,Math.min(64,Math.round(event.data.trials??16)));
      if(!Number.isFinite(trials))throw new Error("Trial count must be finite");
      const validation=runValidation(config,trials,done=>self.postMessage({id,progress:done}));
      self.postMessage({id,validation});return;
    }
    const start=performance.now(),result=simulateAcquisition(config);
    result.detection=analyze(result);result.elapsed=performance.now()-start;
    const buffers:ArrayBuffer[]=[];const seen=new Set<ArrayBuffer>();
    const collect=(obj:unknown)=>{if(ArrayBuffer.isView(obj)){const b=obj.buffer as ArrayBuffer;if(!seen.has(b)){seen.add(b);buffers.push(b);}}else if(obj&&typeof obj==="object")for(const v of Object.values(obj))collect(v);};
    collect(result);self.postMessage({id,result},{transfer:buffers});
  }
  catch(e) { self.postMessage({id,error:e instanceof Error ? e.message:String(e)}); }
};
