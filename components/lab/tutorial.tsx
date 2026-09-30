"use client";
import {useEffect,useRef,useState,type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {Check,MousePointerClick,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import type {TourActions,TourState,TourStep} from "./tutorial-steps";

interface Box {top:number;left:number;width:number;height:number}
const PAD=6,GAP=12,EDGE=12;
const sameBox=(a:Box|null,b:Box|null)=>a===b||(!!a&&!!b&&Math.abs(a.top-b.top)<.5&&Math.abs(a.left-b.left)<.5&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5);
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const find=(target?:string)=>target?document.querySelector<HTMLElement>(`[data-tour="${target}"]`):null;

// Spotlight overlay and step card. Clicks outside the highlighted element are blocked;
// the element itself stays interactive so action steps can observe the user's real click.
export function Tutorial({steps,state,actions,onExit}:{steps:TourStep[];state:TourState;actions:TourActions;onExit:(finished:boolean)=>void}){
  const [index,setIndex]=useState(0),[armed,setArmed]=useState(false);
  const [hole,setHole]=useState<Box|null>(null),[card,setCard]=useState({width:380,height:260}),[view,setView]=useState(()=>({width:innerWidth,height:innerHeight}));
  const cardRef=useRef<HTMLDivElement>(null),actionsRef=useRef(actions),exitRef=useRef(onExit);
  useEffect(()=>{actionsRef.current=actions;exitRef.current=onExit;});
  const step=steps[index],last=index===steps.length-1;
  const go=(i:number)=>{setArmed(false);setIndex(clamp(i,0,steps.length-1));};
  const next=()=>last?onExit(true):go(index+1);

  // Step entry: apply its automatic actions, bring the target into view, and only accept
  // completion once the resulting state has rendered. Timers, unlike animation frames,
  // also run while the page is not being painted.
  useEffect(()=>{
    const current=steps[index];current.before?.(actionsRef.current);
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    let armTimer=0;
    const scrollTimer=window.setTimeout(()=>{
      const el=find(current.target);
      // Phones dock the card at the bottom, so bring targets to the top of the screen there.
      if(el)el.scrollIntoView({block:innerWidth<760||el.getBoundingClientRect().height>innerHeight*.7?"start":"center",behavior:reduced||document.hidden?"auto":"smooth"});
      armTimer=window.setTimeout(()=>setArmed(true),80);
    },30);
    cardRef.current?.focus({preventScroll:true});
    return()=>{clearTimeout(scrollTimer);clearTimeout(armTimer);};
  },[index,steps]);

  // Follow the target through scrolling and resizes; a slow poll catches layout changes
  // such as a recomputed result reflowing the page.
  useEffect(()=>{
    const measure=()=>{
      const r=find(step.target)?.getBoundingClientRect();
      const box=r&&r.width>0&&r.height>0?{top:r.top-PAD,left:r.left-PAD,width:r.width+2*PAD,height:r.height+2*PAD}:null;
      setHole(h=>sameBox(h,box)?h:box);
      setView(v=>v.width===innerWidth&&v.height===innerHeight?v:{width:innerWidth,height:innerHeight});
      const c=cardRef.current?.getBoundingClientRect();
      if(c)setCard(s=>Math.abs(s.width-c.width)<1&&Math.abs(s.height-c.height)<1?s:{width:c.width,height:c.height});
    };
    const first=window.setTimeout(measure,0),poll=setInterval(measure,200);
    addEventListener("scroll",measure,{capture:true,passive:true});addEventListener("resize",measure);
    return()=>{clearTimeout(first);clearInterval(poll);removeEventListener("scroll",measure,{capture:true});removeEventListener("resize",measure);};
  },[step.target]);

  const done=armed&&!!step.waitFor&&step.waitFor.done(state);
  useEffect(()=>{
    if(!done)return;
    const timer=setTimeout(()=>last?exitRef.current(true):go(index+1),700);return()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[done,index,last]);

  // Only Esc is bound: arrow keys belong to the sliders and menus the tour asks users to operate,
  // and the card's buttons are reachable with Tab and Enter.
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();exitRef.current(false);}};
    addEventListener("keydown",onKey);return()=>removeEventListener("keydown",onKey);
  },[]);

  const mobile=view.width<760;
  let placement:CSSProperties;
  if(mobile)placement={left:EDGE,right:EDGE,bottom:EDGE};
  else if(!hole)placement={left:(view.width-card.width)/2,top:Math.max(EDGE,(view.height-card.height)/2)};
  else{
    const below=hole.top+hole.height+GAP,above=hole.top-GAP-card.height,side=clamp(hole.top,EDGE,view.height-card.height-EDGE);
    let top=view.height-card.height-EDGE,left=clamp(hole.left,EDGE,view.width-card.width-EDGE);
    if(below+card.height<=view.height-EDGE)top=below;
    else if(above>=EDGE)top=above;
    else if(hole.left+hole.width+GAP+card.width<=view.width-EDGE){top=side;left=hole.left+hole.width+GAP;}
    else if(hole.left-GAP-card.width>=EDGE){top=side;left=hole.left-GAP-card.width;}
    placement={top,left};
  }

  const blockers:CSSProperties[]=hole?[
    {top:0,left:0,right:0,height:Math.max(0,hole.top)},
    {top:hole.top+hole.height,left:0,right:0,bottom:0},
    {top:hole.top,height:hole.height,left:0,width:Math.max(0,hole.left)},
    {top:hole.top,height:hole.height,left:hole.left+hole.width,right:0},
  ]:[{inset:0}];

  return createPortal(<div className="tour-layer">
    {blockers.map((b,i)=><div key={i} className={"tour-blocker"+(hole?"":" dim")} style={b} aria-hidden="true"/>)}
    {hole&&<div className="tour-spotlight" style={hole} aria-hidden="true"/>}
    <div ref={cardRef} className={"tour-card"+(mobile?" docked":"")} style={placement} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}>
      <div className="tour-head"><span className="eyebrow">STEP {index+1} / {steps.length}</span><Button variant="ghost" size="icon-sm" aria-label="Close tutorial" onClick={()=>onExit(false)}><X size={15}/></Button></div>
      <div className="tour-progress" aria-hidden="true"><i style={{width:(index+1)/steps.length*100+"%"}}/></div>
      <h2 id="tour-title" aria-live="polite">{step.title}</h2>
      <div id="tour-body">{step.body.split("\n\n").map((p,i)=><p key={i}>{p}</p>)}</div>
      {step.waitFor&&<p className={"tour-task"+(done?" done":"")}>{done?<Check size={15}/>:<MousePointerClick size={15}/>}<span>{done?"Done — moving on.":step.waitFor.hint}</span></p>}
      <div className="tour-actions">
        <Button variant="ghost" size="sm" onClick={()=>onExit(false)}>Skip tour</Button>
        <Button variant="outline" size="sm" disabled={index===0} onClick={()=>go(index-1)}>Back</Button>
        {step.waitFor&&!done?<Button size="sm" onClick={()=>step.waitFor!.doIt(actions)}>Do it for me</Button>:<Button size="sm" onClick={next}>{last?"Finish":"Next"}</Button>}
      </div>
    </div>
  </div>,document.body);
}
