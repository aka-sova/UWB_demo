export type Family = "gaussian" | "monocycle" | "doublet" | "chirp";
export interface Config {
  family: Family; sigma: number; carrier: number; amplitude: number; normalization: "peak" | "energy";
  pri: number; count: number; jitter: number; chirpBandwidth: number;
  snr: number; echoDelay: number; echoGain: number; interference: number; interferenceOffset: number;
  secondary: boolean; secondaryOffset: number; secondaryDelay: number;
  sampleRate: number; rxBandwidth: number; gainDb: number; fullScale: number; bits: number;
  limiter: number; recovery: number; antiAlias: boolean; realRF: boolean;
  windowSize: number; fftSize: number; hop: number; window: "hann" | "hamming" | "rectangular";
  detector: "fixed" | "ca" | "os"; thresholdDb: number; pfa: number; training: number; guard: number;
  freqGuard: number; freqTraining: number;
  minCells: number; mergeGap: number; seed: number; ppm: boolean; slot: number; rejectTones:boolean; searchBack: number;
}
export interface TruthEvent { id: string; time: number; source: string; kind: "direct" | "echo"; bit?: number }
export interface TimeFrequency {
  times: Float64Array; frequencies: Float64Array; power: Float64Array; complex: Float64Array;
  bins: number; frames: number; fullBins: number; indices: Int32Array; maxPower: number;
  window: Float64Array; enbw: number; windowDuration: number; binSpacing: number;
}
export interface Spot {
  id: number; cells: number[]; start: number; end: number; low: number; high: number;
  centroid: number; energy: number; peak: number;
}
export interface Pulse {
  id: number; time: number; width: number; amplitude: number; energy: number;
  frequency: number; bandwidth: number; snr: number; spotIds: number[]; start: number; end: number;
  clipped: boolean; train: number; match?: string; error?: number; firstPath?: boolean;
}
export interface Detection {
  mask: Uint8Array; thresholds: Float64Array; noise: Float64Array; spots: Spot[]; pulses: Pulse[];
  recovered: Float64Array; fitted: Float64Array; matched: Float64Array; energyTrace: Float64Array;
  energyThreshold: number; energyEvents: number[];
  matchedCount: number; missed: number; falseEvents: number; timingRmse: number;
  reconstructionError: number; unmaskedError: number; pri: number; priJitter: number;
  ppm: { expected: number[]; decoded: number[]; errors: number; early: number[]; late: number[] };
}
export interface Result {
  config: Config; time: Float64Array; source: Float64Array; channel: Float64Array;
  front: Float64Array; adc: Float64Array; iq: Float64Array; truth: TruthEvent[];
  spectrum: { frequency: Float64Array; psd: Float64Array };
  tf: TimeFrequency; clipped: number; sourceBandwidth: number; sourceWidth: number;
  sourceEnergy: number; sourcePeak: number; noisePower: number; elapsed: number;
  detection?: Detection;
}
export const DURATION = 512e-9;
export const REFERENCE_RATE = 64e9;
export const defaults: Config = {
  family: "gaussian", sigma: .6e-9, carrier: 4e9, amplitude: .8, normalization: "peak",
  pri: 96e-9, count: 5, jitter: 0, chirpBandwidth: 1.2e9,
  snr: 12, echoDelay: 10e-9, echoGain: 0, interference: 0, interferenceOffset: 1.4e9,
  secondary: false, secondaryOffset: .8e9, secondaryDelay: 18e-9,
  sampleRate: 16e9, rxBandwidth: 6e9, gainDb: 0, fullScale: 1.5, bits: 12,
  limiter: 10, recovery: 0, antiAlias: true, realRF: false,
  windowSize: 128, fftSize: 256, hop: 32, window: "hann",
  detector: "ca", thresholdDb: 12, pfa: .001, training: 6, guard: 2, freqGuard: 500e6, freqTraining: 200e6,
  minCells: 10, mergeGap: 3e-9, seed: 42, ppm: false, slot: 8e-9, rejectTones:true, searchBack: 0,
};
