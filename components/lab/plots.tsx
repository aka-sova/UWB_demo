"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {CartesianGrid,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import type {Result} from "@/lib/dsp/types";
import {db} from "@/lib/dsp/numeric";
import {useFontScale} from "./font-scale";
import {cfarExtents,pulseSupport} from "@/lib/dsp/detection";
// Spectrogram plot margins; the label gutters grow with the text size.
const frame=(scale:number)=>({L:Math.round(58*scale),T:Math.round(14*scale),R:16,B:Math.round(32*scale)});
export function LinePlot({x,series,domain,xLabel,yLabel,cursor,onCursor,height=220}:{
  x:ArrayLike<number>;series:{name:string;values:ArrayLike<number>;color:string;dashed?:boolean}[];
  domain:[number,number];xLabel:string;yLabel:string;cursor?:number;onCursor?:(x:number)=>void;height?:number;
}){
  const scale=useFontScale();
  const data=useMemo(()=>{
    const indices:number[]=[];let a=0,b=x.length-1;
    while(a<b&&x[a]<domain[0])a++;while(b>a&&x[b]>domain[1])b--;
    const stride=Math.max(1,Math.floor((b-a)/600));
    for(let i=a;i<=b;i+=stride) {
      const keep=new Set<number>([i]);
      for(const s of series){let lo=i,hi=i;for(let j=i+1;j<Math.min(i+stride,b+1);j++){if(s.values[j]<s.values[lo])lo=j;if(s.values[j]>s.values[hi])hi=j;}keep.add(lo);keep.add(hi);}
      indices.push(...Array.from(keep).sort((u,v)=>u-v));
    }
    return indices.map(i=>Object.fromEntries([["x",x[i]],...series.map((s,k)=>["s"+k,s.values[i]])]));
  },[x,series,domain]);
  return <div className="line-plot" style={{height}} aria-label={yLabel+" versus "+xLabel}>
    <span className="plot-unit">{yLabel}</span>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:20,right:15,left:-12,bottom:12}}
      onMouseMove={e=>{const v=e?.activeLabel;if(typeof v==="number")onCursor?.(v);}}>
      <CartesianGrid stroke="var(--plot-grid)" strokeDasharray="2 5" vertical={false}/>
      <XAxis dataKey="x" type="number" domain={domain} allowDataOverflow tickCount={7} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tickFormatter={v=>Number(v).toFixed(Math.abs(domain[1]-domain[0])<10?1:0)} fontSize={12*scale} label={{value:xLabel,position:"insideBottomRight",offset:-9,fill:"var(--muted-foreground)",fontSize:12*scale}}/>
      <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={Math.round(60*scale)} fontSize={12*scale} tickFormatter={v=>Math.abs(v)>=10?v.toFixed(0):v.toFixed(2)}/>
      <Tooltip contentStyle={{background:"var(--popover)",border:"1px solid var(--border)",borderRadius:8,fontSize:13*scale,color:"var(--foreground)"}} labelFormatter={v=>Number(v).toFixed(3)+" "+xLabel} formatter={(v,n)=>[Number(v).toPrecision(4),n]} isAnimationActive={false}/>
      {series.map((s,i)=><Line key={s.name} dataKey={"s"+i} name={s.name} type="linear" stroke={s.color} strokeWidth={1.6} dot={false} isAnimationActive={false} strokeDasharray={s.dashed?"4 3":undefined}/>)}
      {cursor!==undefined&&cursor>=domain[0]&&cursor<=domain[1]&&<ReferenceLine x={cursor} stroke="var(--amber)" strokeDasharray="4 4"/>}
    </LineChart></ResponsiveContainer>
  </div>;
}
const stops=[[7,17,31],[26,40,85],[29,101,159],[39,183,178],[244,209,98]];
function color(v:number){const q=Math.max(0,Math.min(.99999,v))*(stops.length-1),i=Math.floor(q),t=q-i;return stops[i].map((c,k)=>Math.round(c+(stops[i+1][k]-c)*t));}
export function Spectrogram({result,domain,cursor,onCursor,mode="power",selectedPulse,inspect=false}:{
  result:Result;domain:[number,number];cursor:number;onCursor:(ns:number)=>void;mode?:"power"|"mask"|"spots";selectedPulse?:number;inspect?:boolean;
}){
  const ref=useRef<HTMLCanvasElement>(null),scale=useFontScale();
  const raster=useRef<{result:Result;mask:boolean;image:HTMLCanvasElement}|null>(null);
  const [frequency,setFrequency]=useState(0);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const draw=()=>{
      const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
      canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
      const ctx=canvas.getContext("2d");if(!ctx)return;ctx.scale(ratio,ratio);
      const W=rect.width,H=rect.height,{L,T,R,B}=frame(scale),w=W-L-R,h=H-T-B;
      const style=getComputedStyle(canvas),muted=style.getPropertyValue("--muted-foreground"),grid=style.getPropertyValue("--border");
      ctx.clearRect(0,0,W,H);
      const tf=result.tf;
      let img=raster.current?.image;
      if(!img||raster.current?.result!==result||raster.current?.mask!==(mode==="mask")){
      img=document.createElement("canvas");img.width=tf.frames;img.height=tf.bins;
      const ictx=img.getContext("2d")!,pixels=ictx.createImageData(img.width,img.height);
      for(let t=0;t<tf.frames;t++)for(let f=0;f<tf.bins;f++){
        const idx=t*tf.bins+f,v=mode==="mask"?(result.detection?.mask[idx]?1:0):(db(tf.power[idx]/tf.maxPower)+55)/55;
        const c=color(v),p=((tf.bins-1-f)*tf.frames+t)*4;pixels.data[p]=c[0];pixels.data[p+1]=c[1];pixels.data[p+2]=c[2];pixels.data[p+3]=255;
      }
      ictx.putImageData(pixels,0,0);raster.current={result,mask:mode==="mask",image:img};
      }
      ctx.imageSmoothingEnabled=false;
      // Frame m is centered at m·hop and bin f at frequencies[f]: offset the source rectangle by half a
      // pixel so pixel centers, not edges, land on the time and frequency axes and on the overlays.
      const frameNs=Math.min(result.config.hop,result.config.windowSize/2)/result.config.sampleRate*1e9;
      ctx.drawImage(img,domain[0]/frameNs+.5,.5,(domain[1]-domain[0])/frameNs,tf.bins-1,L,T,w,h);
      const fx=(t:number)=>L+(t*1e9-domain[0])/(domain[1]-domain[0])*w;
      const fmin=tf.frequencies[0],fmax=tf.frequencies[tf.bins-1],fy=(f:number)=>T+h-(f-fmin)/(fmax-fmin)*h;
      ctx.save();ctx.beginPath();ctx.rect(L,T,w,h);ctx.clip();
      if(inspect&&result.config.detector!=="fixed"){
        const c=result.config,dt=Math.min(c.hop,c.windowSize/2)/c.sampleRate;
        const t=Math.max(0,Math.min(tf.frames-1,Math.round(cursor*1e-9/dt)));
        const f=Math.max(0,Math.min(tf.bins-1,Math.round((frequency-fmin)/tf.binSpacing)));
        const box=(rt:number,rf:number,stroke:string)=>{
          const left=fx((Math.max(0,t-rt)-.5)*dt),right=fx((Math.min(tf.frames-1,t+rt)+.5)*dt);
          const top=fy(fmin+(Math.min(tf.bins-1,f+rf)+.5)*tf.binSpacing),bottom=fy(fmin+(Math.max(0,f-rf)-.5)*tf.binSpacing);
          ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(left,top,right-left,bottom-top);
        };
        const n=cfarExtents(tf,c);box(n.timeOuter,n.freqOuter,"#49dbd0");box(n.timeGuard,n.freqGuard,"#f7bd65");box(0,0,"#ffffff");
      }
      if(mode==="spots"&&result.detection)for(const s of result.detection.spots){ctx.strokeStyle="#f7bd65";ctx.lineWidth=1;ctx.strokeRect(fx(s.start),fy(s.high),Math.max(3,fx(s.end)-fx(s.start)),Math.max(3,fy(s.low)-fy(s.high)));}
      // Pulse support: the box around the spots the pulse was built from, and a cross at its
      // estimated arrival time and centre frequency whose vertical bar spans ±BW10/2.
      if(selectedPulse!==undefined&&result.detection){const p=result.detection.pulses.find(v=>v.id===selectedPulse);if(p){
        const b=pulseSupport(p,result.detection.spots),x0=fx(b.start),y0=fy(b.high),bw=Math.max(2,fx(b.end)-x0),bh=Math.max(2,fy(b.low)-y0);
        ctx.fillStyle="rgba(244,209,98,.12)";ctx.fillRect(x0,y0,bw,bh);ctx.strokeStyle="#f7bd65";ctx.lineWidth=2;ctx.strokeRect(x0,y0,bw,bh);
        const tx=fx(p.time),cf=p.frequency-result.config.carrier;
        // Dark halo under a white stroke keeps the cross visible over the bright pulse core.
        for(const [color,width] of [["rgba(4,9,18,.75)",4],["#ffffff",1.5]] as const){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(tx,fy(cf+p.bandwidth/2));ctx.lineTo(tx,fy(cf-p.bandwidth/2));ctx.moveTo(tx-6,fy(cf));ctx.lineTo(tx+6,fy(cf));ctx.stroke();}
        ctx.font=11*scale+"px ui-monospace, monospace";ctx.fillStyle="#f7bd65";ctx.fillText("P"+String(p.id).padStart(2,"0"),x0+2,y0>T+14*scale?y0-4:y0+bh+12*scale);
      }}
      if(cursor>=domain[0]&&cursor<=domain[1]){ctx.strokeStyle="#f7bd65";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(fx(cursor*1e-9),T);ctx.lineTo(fx(cursor*1e-9),T+h);ctx.stroke();ctx.setLineDash([]);}
      ctx.restore();ctx.font=12*scale+"px ui-monospace, monospace";ctx.fillStyle=muted;ctx.strokeStyle=grid;
      for(let i=0;i<5;i++){const value=fmin+(fmax-fmin)*i/4;ctx.fillText((value/1e9).toFixed(1),10,fy(value)+4*scale);}
      for(let i=0;i<7;i++){const v=domain[0]+i*(domain[1]-domain[0])/6;ctx.fillText(v.toFixed(0),L+i*w/6-8*scale,T+h+20*scale);}
      ctx.fillText("ns",W-22*scale,H-2);ctx.fillText("GHz",8,11*scale);
    };
    const observer=new ResizeObserver(draw);observer.observe(canvas);draw();return()=>observer.disconnect();
  },[result,domain,cursor,mode,selectedPulse,inspect,frequency,scale]);
  return <canvas ref={ref} className="spectrogram-canvas" role="img" aria-label={"Time-frequency spectrogram; "+result.tf.frames+" frames and "+result.tf.bins+" frequency bins. Click to position cursor."}
    onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),{L,T,R,B}=frame(scale),t=(e.clientX-r.left-L)/(r.width-L-R),f=1-(e.clientY-r.top-T)/(r.height-T-B);onCursor(domain[0]+Math.max(0,Math.min(1,t))*(domain[1]-domain[0]));setFrequency(result.tf.frequencies[0]+Math.max(0,Math.min(1,f))*(result.tf.frequencies[result.tf.bins-1]-result.tf.frequencies[0]));}}/>;
}
export const magnitude=(x:Float64Array)=>Float64Array.from({length:x.length/2},(_,i)=>Math.hypot(x[2*i],x[2*i+1]));
export const real=(x:Float64Array)=>Float64Array.from({length:x.length/2},(_,i)=>x[2*i]);
