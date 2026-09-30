import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FONT_SCALE_MAX,FONT_SCALE_MIN,parseFontScale,stepFontScale} from "../components/lab/font-scale";

test("font scale steps by 10% and stops at its limits",()=>{
  assert.equal(stepFontScale(1,1),1.1);assert.equal(stepFontScale(1,-1),.9);
  assert.equal(stepFontScale(1.2,1),1.3);// no floating-point drift such as 1.2999999999999998
  assert.equal(stepFontScale(FONT_SCALE_MAX,1),FONT_SCALE_MAX);assert.equal(stepFontScale(FONT_SCALE_MIN,-1),FONT_SCALE_MIN);
});

test("stored font scale is validated",()=>{
  assert.equal(parseFontScale(null),1);assert.equal(parseFontScale("abc"),1);
  assert.equal(parseFontScale("1.3"),1.3);assert.equal(parseFontScale("9"),FONT_SCALE_MAX);assert.equal(parseFontScale("0.1"),FONT_SCALE_MIN);
});

test("every stylesheet font size follows --font-scale",()=>{
  const css=readFileSync("app/globals.css","utf8");
  const fixed=[...css.matchAll(/font(?:-size)?:[^;}]*?(?<!\*)\b\d+(?:\.\d+)?px(?!\*var\(--font-scale\))/g)].map(m=>m[0]);
  assert.deepEqual(fixed,[],"fixed pixel font sizes remain");
  for(const size of ["xs","sm","base","lg"])assert.ok(css.includes(`--text-${size}:calc(`),"Tailwind --text-"+size+" is scaled");
});
