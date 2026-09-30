"use client";
import {useMemo,useState} from "react";
import {Result} from "@/lib/dsp/types";
import {pulseValue} from "@/lib/dsp/engine";
import {spectrum,db} from "@/lib/dsp/numeric";
import {LinePlot} from "./plots";
import {Equation} from "./stage-inspector";
import {references} from "@/lib/scenarios";
import {Button} from "@/components/ui/button";
import {RangeControl} from "./controls";
export function BandwidthView({r}:{r:Result}){
 const c=r.config;
 const curves=useMemo(()=>{
  const size=8192,fs=32/Math.min(c.sigma,.6e-9),x=new Float64Array(size*2),ref=new Float64Array(size*2);
  const time=new Float64Array(size),wave=new Float64Array(size),base=new Float64Array(size);
  for(let i=0;i<size;i++){
   const t=(i-size/2)/fs,a=pulseValue(t,c),b=pulseValue(t,{...c,sigma:.6e-9});
   time[i]=t*1e9;x[2*i]=a[0];x[2*i+1]=a[1];ref[2*i]=b[0];ref[2*i+1]=b[1];
   wave[i]=c.family==="chirp"?Math.hypot(...a):a[0];base[i]=c.family==="chirp"?Math.hypot(...b):b[0];
  }
  const f=spectrum(x,fs,"rectangular"),g=spectrum(ref,fs,"rectangular"),fm=Math.max(...f.psd),gm=Math.max(...g.psd);
  return {time,frequency:Float64Array.from(f.frequency,v=>v/1e9),wave:[{name:"Current pulse",values:wave,color:"var(--blue)"},{name:"σ = 0.60 ns reference",values:base,color:"var(--muted-foreground)",dashed:true}],
   spectra:[{name:"Current spectrum",values:Float64Array.from(f.psd,v=>Math.max(-65,db(v/fm))),color:"var(--cyan)"},{name:"Reference spectrum",values:Float64Array.from(g.psd,v=>Math.max(-65,db(v/gm))),color:"var(--muted-foreground)",dashed:true}]};
 },[c]);
 const qualifies=r.sourceBandwidth>=500e6||r.sourceBandwidth/c.carrier>=.2;
 return <div className="learning-view">
  <div className="learning-lead"><p className="eyebrow">FOURIER EXPERIMENT</p><h2>Short in time. Broad in frequency.</h2><p>Adjust the envelope scale in the controls. These plots isolate one pulse, so the spectral comb of a pulse train does not obscure its envelope spectrum.</p></div>
  <div className="readouts"><div><span>Envelope scale</span><strong>{(c.sigma*1e9).toFixed(2)} <small>ns</small></strong></div><div><span>Source −10 dB bandwidth</span><strong>{(r.sourceBandwidth/1e9).toFixed(3)} <small>GHz</small></strong></div><div><span>Fractional bandwidth</span><strong>{(100*r.sourceBandwidth/c.carrier).toFixed(1)} <small>%</small></strong></div><div><span>Modeled UWB criterion</span><strong className={qualifies?"cyan":""}>{qualifies?"Met":"Not met"}</strong></div></div>
  <div className="chart-grid"><section className="plot-card"><div className="card-heading"><div><h2>Single-pulse waveform</h2></div></div><LinePlot x={curves.time} series={curves.wave} domain={[-Math.max(c.sigma*5e9,3),Math.max(c.sigma*5e9,3)]} xLabel="Time from center (ns)" yLabel={c.family==="chirp"?"Envelope (V)":"Envelope I (V)"} height={280}/></section>
   <section className="plot-card"><div className="card-heading"><div><h2>Single-pulse spectrum</h2></div></div><LinePlot x={curves.frequency} series={curves.spectra} domain={[-Math.max(r.sourceBandwidth/1e9,1.6),Math.max(r.sourceBandwidth/1e9,1.6)]} xLabel="Carrier offset (GHz)" yLabel="Power (dB rel. own peak)" height={280}/></section></div>
  <div className="lesson-grid"><article className="lesson-card"><span className="lesson-number">01</span><h3>Compress the time axis</h3><p>For a fixed pulse shape, time compression stretches the spectrum. Halving σ halves the duration and doubles the spectral width. Center frequency sets the oscillation rate; it is distinct from occupied bandwidth.</p><Equation tex="x(at)\\ \\longleftrightarrow\\ \\frac{1}{|a|}X\\!\\left(\\frac{f}{a}\\right)"/></article>
   <article className="lesson-card"><span className="lesson-number">02</span><h3>Use a precise width definition</h3><p>For an unchirped Gaussian, these relations use power FWHM in time and −10 dB power bandwidth in frequency. Their product is different from the familiar 0.441 power-FWHM time-bandwidth product.</p><Equation tex="T_{\\frac12}=2\\sqrt{\\ln2}\\,\\sigma,\\quad B_{10}=\\frac{\\sqrt{\\ln10}}{\\pi\\sigma}"/></article>
   <article className="lesson-card"><span className="lesson-number">03</span><h3>Bandwidth permits short signals</h3><p>A long chirp can span a broad band while remaining long in time. Its phase evolution raises the time-bandwidth product. A matched filter can produce a narrow output even though the transmitted pulse was long.</p><Equation tex="\\sigma_t\\sigma_f\\geq\\frac{1}{4\\pi}"/><p className="small-note">RMS spreads weighted by signal energy; frequency in Hz. Equality holds for a transform-limited Gaussian.</p></article>
   <article className="lesson-card"><span className="lesson-number">04</span><h3>Keep the comparison fair</h3><p>At fixed peak amplitude, shorter pulses contain less energy. At fixed energy, shortening the same shape raises its peak. The simulation reports ∫|I+jQ|²dt in V²·ns; conversion to joules requires a voltage convention and load impedance.</p><Equation tex="E_u=\\int|u(t)|^2dt\\ \\propto\\ A^2\\sigma"/></article></div>
  <p className="reference-note">The FCC UWB definition uses radiated −10 dB boundaries and an absolute bandwidth ≥500 MHz or fractional bandwidth ≥20%. Here the criterion is calculated on the modeled source spectrum with an idealized antenna. <a href={references[0].url} target="_blank" rel="noreferrer">Read the definition</a>.</p>
 </div>;
}
export function ApplicationsView({r,onScenario}:{r:Result;onScenario:(id:string)=>void}){
 const [separation,setSeparation]=useState(.3),B=r.sourceBandwidth,resolution=299792458/(2*B),delay=2*separation/299792458,d=r.detection!;
 return <div className="learning-view">
  <div className="learning-lead" data-tour="applications"><p className="eyebrow">WHERE BANDWIDTH EARNS ITS KEEP</p><h2>Measure time to understand distance.</h2><p>UWB is particularly useful when a receiver needs fine arrival-time detail: ranging, separating echoes, and short-range timing-based communication. Each application has a different receiver objective.</p></div>
  <section className="application-feature"><div><h3>Two reflectors, one resolution scale</h3><p>Set a hypothetical monostatic target separation and compare its round-trip delay with the bandwidth scale. This calculator follows the current source bandwidth; the actual two-echo experiment includes noise, filtering and peak detection.</p><RangeControl label="Target separation" value={separation} min={.02} max={2} step={.01} digits={2} unit="m" onChange={setSeparation}/><Button variant="outline" onClick={()=>onScenario("reflectors")}>Open two-reflector experiment</Button></div><div className="resolution-result"><Equation tex="\\Delta R\\approx\\frac{c}{2B}"/><strong>{(resolution*100).toFixed(1)} <small>cm</small></strong><span>Approximate range-resolution scale</span><p>{(delay*1e9).toFixed(2)} ns between returns · {separation/resolution>=1?"above":"below"} the c/(2B) scale</p></div></section>
  <div className="lesson-grid">{[
   {id:"multipath",title:"Indoor ranging",text:"Broad bandwidth can separate closely spaced propagation paths. First-arrival estimation avoids choosing a stronger later reflection, although blocked direct paths still introduce bias."},
   {id:"ppm",title:"Short-range communication",text:"A receiver can decode a bit from the pulse's arrival slot. Correlation, timing synchronization, multipath separation and noise all matter; bandwidth alone does not determine the bit-error rate."},
   {id:"overlap",title:"EW receiver education",text:"Follow wideband transients through spectral detection, fragment association and pulse descriptors. Compare the measured events with source truth to understand missed, split and merged pulses."},
   {id:"transient",title:"HPM transient measurement",text:"Explore a strong received transient, ADC overload and a modeled recovery time. Spectral width, peak amplitude, pulse energy and repetition interval are independent properties."}
  ].map(a=><article className="lesson-card" key={a.id}><h3>{a.title}</h3><p>{a.text}</p><Button variant="outline" onClick={()=>onScenario(a.id)}>Open experiment</Button></article>)}</div>
  {r.config.ppm&&<section className="plot-card detail-card"><div className="card-heading"><div><h2>PPM decoder decisions</h2></div><span className="tag">{d.ppm.errors} / {d.ppm.expected.length} symbol errors in this record</span></div><div className="symbol-grid">{d.ppm.expected.map((bit,i)=><div key={i} className={bit===d.ppm.decoded[i]?"symbol correct":"symbol wrong"}><span>SYMBOL {i+1}</span><strong>{d.ppm.decoded[i]}</strong><small>sent {bit} · early {d.ppm.early[i].toFixed(2)} / late {d.ppm.late[i].toFixed(2)}</small></div>)}</div><p className="plot-caption">Decoder: larger correlation peak in the early or late slot, assuming a known symbol clock. Transmitted bits are used only to score the decisions.</p></section>}
  <div className="lesson-card detail-card"><h3>Resolution is not accuracy</h3><p>The c/(2B) scale describes separating two comparable monostatic echoes. Single-arrival estimation error can be much smaller under favorable SNR and a known waveform, or much larger under multipath and bias. One-way ranging converts delay with c·τ; monostatic round-trip ranging uses c·τ/2.</p><p>Large bandwidth also admits more noise for a fixed noise spectral density. Long-range performance, wall penetration and detectability depend on additional propagation, power, antenna and receiver assumptions.</p></div>
  <div className="references"><h3>Further reading</h3>{references.map(ref=><a key={ref.url} href={ref.url} target="_blank" rel="noreferrer">{ref.name}</a>)}</div>
 </div>;
}
