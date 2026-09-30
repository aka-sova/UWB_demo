"use client";
import {RotateCcw,SlidersHorizontal} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Choice,RangeControl,Toggle} from "./controls";
import type {Config} from "@/lib/dsp/types";
import {scenarios} from "@/lib/scenarios";
export function ControlPanel({config:c,change,scenario,onScenario,reset,advanced}:{
 config:Config;change:(key:keyof Config,value:Config[keyof Config])=>void;scenario:string;onScenario:(id:string)=>void;reset:()=>void;advanced:boolean;
}){
 const choices=(values:number[],scale=1,suffix="")=>values.map(v=>({value:String(v*scale),label:v+suffix}));
 return <aside className="control-panel"><div className="panel-title"><SlidersHorizontal size={17}/><h2>Experiment controls</h2><Button variant="ghost" size="icon-sm" aria-label="Reset experiment" onClick={reset}><RotateCcw size={15}/></Button></div>
  <div className="scenario-picker"><Choice label="Predefined scenario" value={scenario} options={scenarios.map((s,i)=>({value:s.id,label:String(i+1).padStart(2,"0")+" · "+s.name}))} onChange={onScenario}/></div>
  <section className="control-section"><h3><span>01</span> Waveform</h3>
   <Choice label="Pulse family" value={c.family} options={[{value:"gaussian",label:"Gaussian RF pulse"},{value:"monocycle",label:"Gaussian monocycle"},{value:"doublet",label:"Gaussian doublet"},{value:"chirp",label:"Wideband chirp"}]} onChange={v=>change("family",v as Config["family"])}/>
   <RangeControl label="Envelope scale σ" value={c.sigma*1e9} min={.15} max={12} step={.05} digits={2} unit="ns" onChange={v=>change("sigma",v*1e-9)}/>
   <RangeControl label="Carrier frequency" value={c.carrier/1e9} min={2} max={10} step={.25} digits={2} unit="GHz" onChange={v=>change("carrier",v*1e9)}/>
   <RangeControl label="Pulse amplitude" value={c.amplitude} min={.1} max={6} step={.05} digits={2} unit="V" onChange={v=>change("amplitude",v)}/>
   <Choice label="Comparison basis" value={c.normalization} options={[{value:"peak",label:"Fixed peak amplitude"},{value:"energy",label:"Fixed energy · same shape"}]} onChange={v=>change("normalization",v as Config["normalization"])}/>
   {c.family==="chirp"&&<RangeControl label="Chirp sweep scale" value={c.chirpBandwidth/1e9} min={.2} max={3} step={.1} unit="GHz" onChange={v=>change("chirpBandwidth",v*1e9)}/>}
   <RangeControl label="Pulse interval" value={c.pri*1e9} min={32} max={160} step={1} digits={0} unit="ns" onChange={v=>change("pri",v*1e-9)}/>
   <RangeControl label="Pulse count" value={c.count} min={1} max={8} digits={0} onChange={v=>change("count",v)}/>
   {advanced&&<RangeControl label="RMS timing jitter" value={c.jitter*1e9} min={0} max={3} step={.1} unit="ns" onChange={v=>change("jitter",v*1e-9)}/>}
   <Toggle label="Pulse-position modulation" value={c.ppm} onChange={v=>change("ppm",v)}/>
   {c.ppm&&<RangeControl label="Early / late separation" value={c.slot*1e9} min={.5} max={16} step={.5} unit="ns" onChange={v=>change("slot",v*1e-9)}/>}
  </section>
  <section className="control-section"><h3><span>02</span> Channel</h3>
   <RangeControl label="Record SNR" value={c.snr} min={-25} max={40} digits={0} unit="dB" onChange={v=>change("snr",v)} hint="Primary pulse-train power / input complex noise power, averaged over 512 ns."/>
   <RangeControl label="Echo amplitude ratio" value={c.echoGain} min={0} max={2} step={.05} digits={2} unit="×" onChange={v=>change("echoGain",v)}/>
   <RangeControl label="Echo delay" value={c.echoDelay*1e9} min={.25} max={35} step={.25} digits={2} unit="ns" onChange={v=>change("echoDelay",v*1e-9)}/>
   <RangeControl label="Interferer amplitude" value={c.interference} min={0} max={2} step={.02} digits={2} unit="V" onChange={v=>change("interference",v)}/>
   {c.interference>0&&<RangeControl label="Interferer offset" value={c.interferenceOffset/1e9} min={-2.5} max={2.5} step={.05} digits={2} unit="GHz" onChange={v=>change("interferenceOffset",v*1e9)}/>}
   <Toggle label="Second pulse train" value={c.secondary} onChange={v=>change("secondary",v)}/>
   {c.secondary&&<><RangeControl label="Second-source offset" value={c.secondaryOffset/1e9} min={-.5} max={2.5} step={.05} digits={2} unit="GHz" onChange={v=>change("secondaryOffset",v*1e9)}/><RangeControl label="Second-source delay" value={c.secondaryDelay*1e9} min={0} max={50} step={.5} unit="ns" onChange={v=>change("secondaryDelay",v*1e-9)}/></>}
  </section>
  <section className="control-section"><h3><span>03</span> Front end & ADC</h3>
   <Choice label="Acquisition model" value={c.realRF?"rf":"iq"} options={[{value:"iq",label:"Complex I/Q equivalent"},{value:"rf",label:"Real RF → ADC → DDC"}]} onChange={v=>change("realRF",v==="rf")}/>
   <Choice label="Sample rate" value={String(c.sampleRate)} options={choices([4,8,16,32],1e9," GS/s")} onChange={v=>change("sampleRate",Number(v))}/>
   <RangeControl label="Receiver bandwidth" value={c.rxBandwidth/1e9} min={.5} max={10} step={.25} digits={2} unit="GHz" onChange={v=>change("rxBandwidth",v*1e9)}/>
   <RangeControl label="ADC resolution" value={c.bits} min={3} max={16} digits={0} unit="bits" onChange={v=>change("bits",v)}/>
   <RangeControl label="ADC full scale" value={c.fullScale} min={.2} max={6} step={.1} unit="±V" onChange={v=>change("fullScale",v)}/>
   <Toggle label="Anti-alias filter" value={c.antiAlias} onChange={v=>change("antiAlias",v)}/>
   {advanced||scenario==="transient"?<><RangeControl label="Receiver gain" value={c.gainDb} min={-12} max={24} digits={0} unit="dB" onChange={v=>change("gainDb",v)}/><RangeControl label="Limiter level" value={c.limiter} min={.2} max={10} step={.2} unit="V" onChange={v=>change("limiter",v)}/><RangeControl label="Recovery time constant" value={c.recovery*1e9} min={0} max={30} digits={0} unit="ns" onChange={v=>change("recovery",v*1e-9)}/></>:null}
  </section>
  <section className="control-section"><h3><span>04</span> Time-frequency analysis</h3>
   <Choice label="Window length" value={String(c.windowSize)} options={choices([32,64,128,256,512],1," samples")} onChange={v=>change("windowSize",Number(v))}/>
   <Choice label="FFT length" value={String(c.fftSize)} options={choices([64,128,256,512,1024],1," bins")} onChange={v=>change("fftSize",Number(v))}/>
   <Choice label="Window function" value={c.window} options={["hann","hamming","rectangular"].map(v=>({value:v,label:v[0].toUpperCase()+v.slice(1)}))} onChange={v=>change("window",v as Config["window"])}/>
   <Choice label="Hop size" value={String(c.hop)} options={choices([8,16,32,64,128],1," samples")} onChange={v=>change("hop",Number(v))}/>
   <p className="control-hint">Effective FFT ≥ window length; hop ≤ half the window. Applied values appear beneath the spectrogram.</p>
  </section>
  <section className="control-section"><h3><span>05</span> Detection & association</h3>
   <Choice label="Detection threshold" value={c.detector} options={[{value:"fixed",label:"Fixed noise-relative threshold"},{value:"ca",label:"Cell-averaging CFAR"},{value:"os",label:"Order-statistic CFAR"}]} onChange={v=>change("detector",v as Config["detector"])}/>
   {c.detector==="fixed"?<RangeControl label="Above noise estimate" value={c.thresholdDb} min={3} max={30} digits={0} unit="dB" onChange={v=>change("thresholdDb",v)}/>:<Choice label="Requested cell Pfa" value={String(c.pfa)} options={[.1,.01,.005,.001,.0001,.00001].map(v=>({value:String(v),label:v.toExponential(0)}))} onChange={v=>change("pfa",Number(v))}/>}
   {advanced&&<><RangeControl label="Training extent in time" value={c.training} min={2} max={12} digits={0} unit="frames" onChange={v=>change("training",v)}/><RangeControl label="Guard extent in time" value={c.guard} min={1} max={12} digits={0} unit="frames" onChange={v=>change("guard",v)} hint="Frequency guard = 4 × this value in bins; three outer frequency training bins."/></>}
   {c.detector!=="fixed"&&(advanced||c.snr<0)&&<RangeControl label="Energy-branch threshold" value={c.thresholdDb} min={3} max={30} digits={0} unit="dB" onChange={v=>change("thresholdDb",v)} hint="Above the rolling-energy median; independent of CFAR."/>}
   <RangeControl label="Minimum spot area" value={c.minCells} min={1} max={40} digits={0} unit="cells" onChange={v=>change("minCells",v)}/>
   <RangeControl label="Fragment joining gap" value={c.mergeGap*1e9} min={0} max={12} step={.25} digits={2} unit="ns" onChange={v=>change("mergeGap",v*1e-9)}/>
   <Toggle label="Reject persistent tones" value={c.rejectTones} onChange={v=>change("rejectTones",v)}/>
   <p className="control-hint">Tone rejection excludes frequency bins detected in more than 60% of frames before spot grouping.</p>
  </section>
 </aside>;
}
