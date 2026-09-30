import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {tourSteps,type TourActions,type TourState} from "../components/lab/tutorial-steps";

const base:TourState={view:"receiver",stage:4,maskMode:"power",advanced:false,controlsOpen:true,sigma:.6e-9,selected:undefined,firstPulse:1,zoomed:false};
// Actions that apply to a plain state object, mirroring what the Lab's setters do.
function fakeActions(state:TourState):TourActions{
  return {
    setView:v=>{state.view=v;},setStage:s=>{state.stage=s;},setMaskMode:m=>{state.maskMode=m;},
    setAdvanced:a=>{state.advanced=a;},setControlsOpen:o=>{state.controlsOpen=o;},
    change:(key,value)=>{if(key==="sigma")state.sigma=value as number;},
    selectFirstPulse:()=>{state.selected=state.firstPulse;},clearSelection:()=>{state.selected=undefined;},focusCursor:()=>{state.zoomed=true;},resetView:()=>{state.zoomed=false;},
  };
}

test("tour has a welcome step, a finish step and unique ids",()=>{
  assert.ok(tourSteps.length>=15);
  assert.equal(new Set(tourSteps.map(s=>s.id)).size,tourSteps.length);
  assert.equal(tourSteps[0].target,undefined);
});

test("every step target is a data-tour attribute rendered by the lab components",()=>{
  const dir="components/lab",source=readdirSync(dir).filter(f=>f.endsWith(".tsx")).map(f=>readFileSync(dir+"/"+f,"utf8")).join("\n");
  for(const step of tourSteps)if(step.target)assert.ok(source.includes(`data-tour="${step.target}"`)||source.includes(`dataTour="${step.target}"`),step.id+" → "+step.target);
});

test("each action step waits for its own action and accepts the fallback",()=>{
  let state={...base};
  for(const step of tourSteps){
    step.before?.(fakeActions(state));
    if(!step.waitFor)continue;
    const start={...state};
    assert.equal(step.waitFor.done(start),false,step.id+" must not be done on entry");
    step.waitFor.doIt(fakeActions(state));
    assert.equal(step.waitFor.done(state),true,step.id+" must accept its fallback");
    state={...state};
  }
  assert.ok(tourSteps.filter(s=>s.waitFor).length>=6);
});
