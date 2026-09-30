import {createContext,useContext} from "react";

// Text-size multiplier applied to every font through the --font-scale CSS variable.
export const FONT_SCALE_MIN=.8,FONT_SCALE_MAX=1.5,FONT_SCALE_STEP=.1;
const clampScale=(v:number)=>Math.min(FONT_SCALE_MAX,Math.max(FONT_SCALE_MIN,Math.round(v*10)/10));
export const stepFontScale=(scale:number,direction:1|-1)=>clampScale(scale+direction*FONT_SCALE_STEP);
export function parseFontScale(stored:string|null){
  const value=Number(stored);return stored!==null&&Number.isFinite(value)&&value>0?clampScale(value):1;
}
// Canvas and chart text is sized in JavaScript, so it reads the scale from context.
export const FontScaleContext=createContext(1);
export const useFontScale=()=>useContext(FontScaleContext);
