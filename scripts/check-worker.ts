import {readFileSync,readdirSync} from "node:fs";
import {runInNewContext} from "node:vm";
import assert from "node:assert/strict";
import {defaults} from "../lib/dsp/types";

// Execute the built numerical worker as JavaScript in Node, without a browser.
// This checks bundling and transfer serialization, not browser loading or UI.
const directory="dist/client/_next/static";
const name=readdirSync(directory).find(v=>/^worker-.*\.js$/.test(v));
assert.ok(name,"Production worker bundle must exist");
const replies:Record<string,unknown>[]=[];
const self:{onmessage?:(event:unknown)=>void;postMessage:(message:unknown,options?:StructuredSerializeOptions)=>void}={
  postMessage:(message,options)=>{replies.push(structuredClone(message,options) as Record<string,unknown>);}
};
runInNewContext(readFileSync(`${directory}/${name}`,"utf8"),{self,performance,console},{timeout:10000});
self.onmessage!({data:{id:7,config:defaults}});
const result=replies[0] as {id:number;error?:string;result?:{iq:Float64Array;detection:{matchedCount:number;energyEvents:number[]}}};
assert.equal(result.error,undefined);assert.equal(result.id,7);assert.equal(result.result?.detection.matchedCount,5);
assert.equal(result.result?.iq.length,16384);assert.ok(result.result?.detection.energyEvents.length);
self.onmessage!({data:{id:8,config:{...defaults,sampleRate:15e9}}});
assert.equal(replies[1].id,8);assert.equal(typeof replies[1].error,"string");
console.log("Built worker: five baseline matches, transferred buffers intact, invalid configuration rejected.");
