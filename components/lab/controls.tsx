"use client";
import {Slider} from "@/components/ui/slider";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {useId} from "react";
export function RangeControl({label,value,min,max,step=1,unit="",digits=1,onChange,hint}:{
  label:string;value:number;min:number;max:number;step?:number;unit?:string;digits?:number;onChange:(v:number)=>void;hint?:string;
}){
  const id=useId();return <div className="range-control"><div className="control-label"><label id={id}>{label}</label><output>{value.toFixed(digits)} <span>{unit}</span></output></div><Slider value={[value]} min={min} max={max} step={step} onValueChange={v=>onChange(v[0])} aria-labelledby={id}/>{hint&&<p className="control-hint">{hint}</p>}</div>;
}
export function Choice({label,value,options,onChange}:{
  label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void;
}){
  const id=useId();return <div className="choice-control"><label id={id}>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger aria-labelledby={id} className="w-full"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>;
}
export function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){
  const id=useId();return <div className="toggle-control"><label htmlFor={id}>{label}</label><Switch id={id} checked={value} onCheckedChange={onChange}/></div>;
}
