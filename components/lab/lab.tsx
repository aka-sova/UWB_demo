"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {AudioLines,ChevronRight,Sun,Moon,FlaskConical,Focus,Play,Pause,StepForward,PanelLeftClose,PanelLeftOpen,ZoomIn,ZoomOut,ChevronLeft} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Config,defaults,Result} from "@/lib/dsp/types";
import {scenarios,scenarioConfig} from "@/lib/scenarios";
import {configSchema} from "@/lib/config-schema";
import {ControlPanel} from "./control-panel";
import {ReceiverView} from "./receiver-view";
import {BandwidthView,ApplicationsView} from "./learning-views";
import {ValidationView} from "./validation-view";
import {stages} from "./stage-inspector";
import {Toggle} from "./controls";
import {useLabTools} from "./webmcp";
import {createDspWorker} from "@/lib/dsp/create-worker";

export default function Lab(){
 const [config,setConfig]=useState<Config>(defaults),[result,setResult]=useState<Result>(),[theme,setTheme]=useState("dark");
 const [busy,setBusy]=useState(true),[error,setError]=useState(""),[cursor,setCursor]=useState(64),[domain,setDomain]=useState<[number,number]>([0,512]);
 const [scenario,setScenario]=useState("bandwidth"),[stage,setStage]=useState(4),[view,setView]=useState("receiver"),[advanced,setAdvanced]=useState(false);
 const [maskMode,setMaskMode]=useState<"power"|"mask"|"spots">("power"),[selected,setSelected]=useState<number>(),[representation,setRepresentation]=useState("envelope");
 const [playing,setPlaying]=useState(false),[controlsOpen,setControlsOpen]=useState(true);
 const worker=useRef<Worker|null>(null),job=useRef(0);
 const pending=useRef<{signature:string;resolve:(v:unknown)=>void;reject:(e:Error)=>void}[]>([]);
 const summary=(r:Result)=>({parameters:r.config,pulses:r.detection?.pulses.length,matches:r.detection?.matchedCount,missed:r.detection?.missed,falseEvents:r.detection?.falseEvents,sourceBandwidthHz:r.sourceBandwidth,sourceWidthSeconds:r.sourceWidth,elapsedMs:r.elapsed});
 useEffect(()=>{
  // Hydrate browser-only preferences after the server and first client render agree.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setTheme(localStorage.getItem("uwb-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
  if(window.innerWidth<760)setControlsOpen(false);
  const w=createDspWorker();worker.current=w;
  w.onmessage=e=>{
   if(e.data.id!==job.current)return;
   setBusy(false);
   if(e.data.error){setError(e.data.error);pending.current.forEach(p=>p.reject(new Error(e.data.error)));pending.current=[];}
   else{const r=e.data.result as Result;setResult(r);setError("");const signature=JSON.stringify(r.config);pending.current=pending.current.filter(p=>{if(p.signature===signature){p.resolve(summary(r));return false;}return true;});}
  };
  w.onerror=e=>{setError(e.message||"The computation worker failed. Reload to restart it.");setBusy(false);setPlaying(false);pending.current.forEach(p=>p.reject(new Error("Computation worker failed")));pending.current=[];};
  return()=>{w.terminate();pending.current.forEach(p=>p.reject(new Error("Laboratory closed")));};
 },[]);
 useEffect(()=>{document.documentElement.classList.toggle("dark",theme==="dark");localStorage.setItem("uwb-theme",theme);},[theme]);
 useEffect(()=>{
  job.current++;const id=job.current,signature=JSON.stringify(config);
  pending.current=pending.current.filter(p=>{if(p.signature!==signature){p.reject(new Error("Configuration superseded by a newer change"));return false;}return true;});
  const timer=setTimeout(()=>{setBusy(true);worker.current?.postMessage({id,config});},130);return()=>clearTimeout(timer);
 },[config]);
 useEffect(()=>{if(!playing||busy||error)return;const timer=setTimeout(()=>setConfig(c=>({...c,seed:(c.seed+1)>>>0})),750);return()=>clearTimeout(timer);},[playing,busy,error,config.seed]);
 const change=(key:keyof Config,value:Config[keyof Config])=>{
  setPlaying(false);setConfig(c=>({...c,[key]:value}));setSelected(undefined);
 };
 const chooseScenario=(id:string)=>{
  const s=scenarios.find(v=>v.id===id);if(!s)throw new Error("Unknown scenario");
  const next=scenarioConfig(id);setConfig(next);setScenario(id);setSelected(undefined);setPlaying(false);setView("receiver");
  setCursor(s.focus??64);setDomain(s.focus?[Math.max(0,s.focus-22),Math.min(512,s.focus+22)]:[0,512]);
  setStage(id==="sampling"?3:id==="transient"?2:id==="overlap"?6:4);
  setMaskMode(id==="overlap"?"spots":"power");return next;
 };
 const awaitConfig=(next:Config)=>new Promise<unknown>((resolve,reject)=>{pending.current.push({signature:JSON.stringify(next),resolve,reject});setConfig({...next});});
 useLabTools({
  read:()=>({state:busy?"computing":error?"error":"ready",scenario,view,stage:stages[stage].name,error: error||undefined,...(result?summary(result):{})}),
  configure:async patch=>{
   if(!patch||typeof patch!=="object"||Array.isArray(patch))throw new Error("Parameters must be an object");
   const allowed=["sigma","snr","echoDelay","echoGain","sampleRate","detector","minCells"];
   if(Object.keys(patch).some(k=>!allowed.includes(k)))throw new Error("Unsupported parameter");
   const next=configSchema.parse({...config,...patch});setPlaying(false);return awaitConfig(next);
  },
  select:async id=>{const next=chooseScenario(id);return awaitConfig(next);}
 });
 const selectedScenario=scenarios.find(s=>s.id===scenario)!;
 const modified=JSON.stringify(config)!==JSON.stringify(scenarioConfig(scenario));
 const focus=()=>setDomain(domain[1]-domain[0]<510?[0,512]:[Math.max(0,cursor-10),Math.min(512,cursor+10)]);
 const zoom=(factor:number)=>{const center=(domain[0]+domain[1])/2,width=Math.min(512,Math.max(2,(domain[1]-domain[0])*factor));const left=Math.max(0,Math.min(512-width,center-width/2));setDomain([left,left+width]);};
 const pan=(direction:number)=>{const width=domain[1]-domain[0],left=Math.max(0,Math.min(512-width,domain[0]+direction*width/3));setDomain([left,left+width]);};
 return <div className="lab-shell">
  <header className="topbar"><Link href="/" className="brand"><span className="brand-symbol"><AudioLines size={25}/></span><div><strong>UWB <span>Signal Lab</span></strong><small>INTERACTIVE RECEIVER LABORATORY</small></div></Link>
   <div className="top-actions"><span className="course-tag">EW / HPM</span><Toggle label="Graduate detail" value={advanced} onChange={setAdvanced}/><Button variant="ghost" size="icon" aria-label="Toggle color theme" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>{theme==="dark"?<Sun/>:<Moon/>}</Button></div></header>
  <div className="workspace-heading"><div className="breadcrumb"><Button size="icon-sm" variant="ghost" aria-label={controlsOpen?"Hide controls":"Show controls"} onClick={()=>setControlsOpen(!controlsOpen)}>{controlsOpen?<PanelLeftClose size={16}/>:<PanelLeftOpen size={16}/>}</Button><FlaskConical size={16}/><span>Experiments</span><ChevronRight size={14}/><strong>{selectedScenario.name}</strong>{modified&&<span className="modified-tag">Modified</span>}</div><span className="compute-status" aria-live="polite">{busy?"Computing · plots show last result":result?result.elapsed.toFixed(0)+" ms · seed "+result.config.seed:"Ready"}</span></div>
  <div className={"workspace "+(!controlsOpen?"controls-closed":"")}>
   {controlsOpen&&<ControlPanel config={config} change={change} scenario={scenario} onScenario={chooseScenario} reset={()=>chooseScenario(scenario)} advanced={advanced}/>}
   <main className="lab-main">
    <div className="experiment-intro"><div><p className="eyebrow">EXPERIMENT {String(scenarios.indexOf(selectedScenario)+1).padStart(2,"0")} / {String(scenarios.length).padStart(2,"0")}</p><h1>{selectedScenario.title}</h1><p>{selectedScenario.description}</p></div><div className="transport"><Button variant={playing?"secondary":"default"} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?"Pause":"Run"}</Button><Button variant="outline" aria-label="Step one noise realization" disabled={busy} onClick={()=>{setPlaying(false);setConfig(c=>({...c,seed:(c.seed+1)>>>0}));}}><StepForward size={15}/><span>Step</span></Button></div></div>
    <Tabs value={view} onValueChange={setView} className="main-tabs"><TabsList variant="line"><TabsTrigger value="receiver">Receiver laboratory</TabsTrigger><TabsTrigger value="bandwidth">Bandwidth explorer</TabsTrigger><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="validation">Validation</TabsTrigger></TabsList>
     {error&&<div role="alert" className="error-box">{error}</div>}
     {result&&result.detection?<>
      <TabsContent value="receiver">
       <nav className="pipeline" aria-label="Receiver stages">{stages.map((s,i)=><button className={"stage "+(stage===i?"active":"")} key={s.name} aria-pressed={stage===i} onClick={()=>{setStage(i);if(i===5)setMaskMode("mask");if(i===6)setMaskMode("spots");}}><span>{String(i+1).padStart(2,"0")}</span><strong>{s.name}</strong>{i<6&&<ChevronRight size={14}/>}</button>)}</nav>
       <div className="plot-toolbar"><span>Cursor <b>{cursor.toFixed(3)} ns</b> · view {domain[0].toFixed(1)}–{domain[1].toFixed(1)} ns</span><div><Button variant="ghost" size="icon-sm" aria-label="Pan earlier" onClick={()=>pan(-1)}><ChevronLeft/></Button><Button variant="ghost" size="icon-sm" aria-label="Pan later" onClick={()=>pan(1)}><ChevronRight/></Button><Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={()=>zoom(.5)}><ZoomIn/></Button><Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={()=>zoom(2)}><ZoomOut/></Button><Button variant="outline" size="sm" onClick={focus}><Focus size={14}/>{domain[1]-domain[0]<510?"Full record":"Focus cursor"}</Button></div></div>
       <ReceiverView r={result} stage={stage} advanced={advanced} theme={theme} domain={domain} cursor={cursor} setCursor={setCursor} selected={selected} setSelected={setSelected} maskMode={maskMode} setMaskMode={setMaskMode} representation={representation} setRepresentation={setRepresentation}/>
       <section className="insight-strip"><span className="insight-icon">∿</span><div><h2>{selectedScenario.question}</h2><p>{selectedScenario.observation}</p></div></section>
       {config.ppm&&<div className="ppm-prompt"><span>Decoded symbols: <b>{result.detection.ppm.decoded.join(" ")}</b> · {result.detection.ppm.errors} errors</span><Button variant="outline" size="sm" onClick={()=>setView("applications")}>Inspect symbol decisions</Button></div>}
      </TabsContent>
      <TabsContent value="bandwidth"><BandwidthView r={result}/></TabsContent>
      <TabsContent value="applications"><ApplicationsView r={result} onScenario={chooseScenario}/></TabsContent>
      <TabsContent value="validation"><ValidationView config={config} result={result}/></TabsContent>
     </>:<div className="loading-panel" role="status">Computing the first received signal…</div>}
    </Tabs>
    <footer className="lab-footer"><span>512 ns record · {result?.time.length??"—"} samples · SI units</span><span>Run advances noise realizations; physical time is shown on the axes.</span></footer>
   </main>
  </div>
 </div>;
}
