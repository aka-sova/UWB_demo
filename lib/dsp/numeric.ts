import FFT from "fft.js";
const plans = new Map<number, FFT>();
export function plan(n: number): FFT {
  let f = plans.get(n);
  if (!f) { f = new FFT(n); plans.set(n, f); }
  return f;
}
export function fft(x: Float64Array, inverse = false): Float64Array {
  const out = new Float64Array(x.length);
  if (inverse) plan(x.length / 2).inverseTransform(out, x);
  else plan(x.length / 2).transform(out, x);
  return out;
}
export const db = (v: number) => 10 * Math.log10(Math.max(v, 1e-30));
export const powerAt = (x: Float64Array, n: number) => x[2*n] ** 2 + x[2*n+1] ** 2;
export function energy(x: Float64Array, fs: number) {
  let sum = 0; for (let i=0;i<x.length;i++) sum += x[i]*x[i]; return sum/fs;
}
export function windowValues(n: number, type: string) {
  return Float64Array.from({length:n}, (_,i) => type === "rectangular" ? 1 :
    type === "hamming" ? .54 - .46*Math.cos(2*Math.PI*i/n) : .5-.5*Math.cos(2*Math.PI*i/n));
}
export function random(seed: number) {
  let state = seed >>> 0;
  const uniform = () => {
    state += 0x6D2B79F5; let t=state;
    t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
  return {uniform, normal: () => Math.sqrt(-2*Math.log(Math.max(1e-12,uniform()))) * Math.cos(2*Math.PI*uniform())};
}
// Odd Hamming-windowed-sinc length whose transition band (≈3.3 fs/N) is at most `transition`.
export function firTaps(fs: number, transition: number, min = 63, max = 4095) {
  const n=Math.ceil(3.3*fs/Math.max(transition,1)), odd=n%2 ? n : n+1;
  return Math.min(max,Math.max(min,odd));
}
// Symmetric FIR evaluated offline with group-delay compensation and zero extension.
// Linear convolution is computed by FFT so long filters remain inexpensive.
export function lowpass(x: Float64Array, fs: number, cutoff: number, taps = 63) {
  const n=x.length/2, m=(taps-1)/2, h=new Float64Array(taps);
  const ratio=Math.min(.49,cutoff/fs); let sum=0;
  for(let k=0;k<taps;k++) {
    const d=k-m;
    h[k]=(d===0 ? 2*ratio : Math.sin(2*Math.PI*ratio*d)/(Math.PI*d))*(.54-.46*Math.cos(2*Math.PI*k/(taps-1)));
    sum+=h[k];
  }
  const size=2**Math.ceil(Math.log2(n+taps-1)), a=new Float64Array(size*2), b=new Float64Array(size*2);
  a.set(x); for(let k=0;k<taps;k++) b[2*k]=h[k]/sum;
  const A=fft(a), B=fft(b);
  for(let k=0;k<size;k++) {const ar=A[2*k],ai=A[2*k+1];A[2*k]=ar*B[2*k]-ai*B[2*k+1];A[2*k+1]=ar*B[2*k+1]+ai*B[2*k];}
  const z=fft(A,true), y=new Float64Array(x.length);
  for(let i=0;i<n;i++) {y[2*i]=z[2*(i+m)]; y[2*i+1]=z[2*(i+m)+1];}
  return y;
}
export function resample(x: Float64Array, step: number) {
  const out=new Float64Array(x.length/step);
  for(let i=0;i<out.length/2;i++) {out[2*i]=x[2*i*step];out[2*i+1]=x[2*i*step+1];}
  return out;
}
export function halfPowerWidth(x: Float64Array, peak: number, fs: number) {
  const limit=powerAt(x,peak)/2, n=x.length/2;
  let l=peak,r=peak;
  while(l>0 && powerAt(x,l)>limit) l--;
  while(r<n-1 && powerAt(x,r)>limit) r++;
  const pl=powerAt(x,l), pr=powerAt(x,r);
  const lf=l+(limit-pl)/Math.max(1e-30,powerAt(x,Math.min(l+1,n-1))-pl);
  const rf=r-(limit-pr)/Math.max(1e-30,powerAt(x,Math.max(r-1,0))-pr);
  return Math.max(1/fs,(rf-lf)/fs);
}
export function spectrum(x: Float64Array, fs: number, type = "hann") {
  const n=x.length/2, w=windowValues(n,type), work=new Float64Array(x.length);
  let ww=0;
  for(let i=0;i<n;i++) {work[2*i]=x[2*i]*w[i];work[2*i+1]=x[2*i+1]*w[i];ww+=w[i]*w[i];}
  const f=fft(work), frequency=new Float64Array(n),psd=new Float64Array(n);
  for(let i=0;i<n;i++) {const k=(i+n/2)%n;frequency[i]=(i-n/2)*fs/n;psd[i]=powerAt(f,k)/(fs*ww);}
  return {frequency,psd};
}
