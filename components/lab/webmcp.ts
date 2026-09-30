"use client";
import {useEffect,useRef} from "react";
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
interface Registry{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}
export function useLabTools(actions:{read:()=>unknown;configure:(patch:unknown)=>Promise<unknown>;select:(id:string)=>Promise<unknown>}){
 const current=useRef(actions);
 useEffect(()=>{current.current=actions;},[actions]);
 useEffect(()=>{
  const registry=(document as Document&{modelContext?:Registry}).modelContext;if(!registry?.registerTool)return;
  const controller=new AbortController();
  const tools:Tool[]=[
   {name:"read_uwb_receiver",title:"Inspect receiver results",description:"Read current UWB simulation settings, processing state and pulse detection summary.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>current.current.read()},
   {name:"select_uwb_scenario",title:"Activate an experiment",description:"Activate a predefined UWB experiment and compute its receiver results.",inputSchema:{type:"object",properties:{scenario:{type:"string",enum:["bandwidth","reflectors","multipath","interference","weak","overlap","windows","sampling","transient","chirp","ppm"]}},required:["scenario"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input)=>{if(!input||typeof input!=="object"||typeof (input as {scenario?:unknown}).scenario!=="string")throw new Error("scenario must be a preset identifier");return current.current.select((input as {scenario:string}).scenario);}},
   {name:"configure_uwb_experiment",title:"Change receiver parameters",description:"Update UWB controls and wait for the computed result. Frequencies and sample rate are in Hz; sigma and echoDelay are in seconds; SNR is in dB.",inputSchema:{type:"object",properties:{sigma:{type:"number",minimum:.15e-9,maximum:12e-9},snr:{type:"number",minimum:-25,maximum:40},echoDelay:{type:"number",minimum:.25e-9,maximum:35e-9},echoGain:{type:"number",minimum:0,maximum:2},sampleRate:{type:"number",enum:[4e9,8e9,16e9,32e9]},detector:{type:"string",enum:["fixed","ca","os"]},minCells:{type:"integer",minimum:1,maximum:40}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input)=>current.current.configure(input)}
  ];
  for(const t of tools)try{void Promise.resolve(registry.registerTool(t,{signal:controller.signal})).catch(()=>{});}catch{/* Unsupported registries leave the ordinary interface usable. */}
  return()=>controller.abort();
 },[]);
}
