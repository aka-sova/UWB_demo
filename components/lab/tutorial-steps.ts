import type {Config} from "../../lib/dsp/types";

export type MaskMode="power"|"mask"|"spots";
// The slice of Lab state the tour reads to detect a user's action.
export interface TourState {
  view:string;stage:number;maskMode:MaskMode;advanced:boolean;controlsOpen:boolean;
  sigma:number;selected?:number;firstPulse?:number;zoomed:boolean;
}
// Lab setters the tour may call, either before a step or as a "Do it for me" fallback.
export interface TourActions {
  setView(view:string):void;setStage(stage:number):void;setMaskMode(mode:MaskMode):void;
  setAdvanced(on:boolean):void;setControlsOpen(open:boolean):void;
  change(key:keyof Config,value:Config[keyof Config]):void;
  selectFirstPulse():void;clearSelection():void;focusCursor():void;resetView():void;
}
export interface TourStep {
  id:string;
  /** `data-tour` key of the highlighted element; omitted for a centered card. */
  target?:string;
  title:string;
  /** Paragraphs separated by blank lines. */
  body:string;
  before?(actions:TourActions):void;
  waitFor?:{hint:string;done(state:TourState):boolean;doIt(actions:TourActions):void};
}

export const tourSteps:TourStep[]=[
  {id:"welcome",title:"Welcome to UWB Signal Lab",
    body:"This tour walks through the laboratory: the controls, the receiver pipeline, each plot and the lessons.\n\nSome steps ask you to click something yourself. The tour moves on when it sees the result, or you can press “Do it for me”.\n\nThe tour starts from Experiment 01. Leaving early with Skip or Esc restores what you had open."},
  {id:"scenario",target:"scenario",title:"Choose an experiment",
    body:"Eleven predefined experiments each set up a question: bandwidth versus duration, nearby reflectors, multipath, interference, weak pulses, overlapping trains, STFT trade-offs, sampling, transients, chirps and pulse-position communication.\n\nPicking one loads its parameters; the reset button next to “Experiment controls” restores them.",
    before:a=>a.setControlsOpen(true)},
  {id:"controls",target:"controls",title:"Experiment controls",
    body:"Controls follow the signal chain: 01 waveform, 02 channel (noise, echo, interference, a second emitter), 03 front end and ADC, 04 time-frequency analysis and 05 detection.\n\nEvery change recomputes the whole record in a background worker; the status line above shows the computation time."},
  {id:"experiment",target:"experiment",title:"The experiment and its transport",
    body:"The heading states what the current experiment demonstrates.\n\nRun keeps drawing new noise realizations with the same settings, so you can see which features are stable and which are noise. Step draws exactly one new realization. The Tutorial button restarts this tour."},
  {id:"tabs",target:"tabs",title:"Four views",
    body:"Receiver laboratory is the full signal chain. Bandwidth explorer isolates one pulse to show the time-bandwidth relation. Applications connects arrival timing to ranging, communication and EW. Validation runs repeated seeded trials of the current settings."},
  {id:"pipeline",target:"pipeline",title:"The receiver pipeline",
    body:"The seven stages go from the transmitted source to constructed pulse events. Selecting a stage changes which signal the time-domain plot shows and what the stage inspector explains.",
    before:a=>{a.setView("receiver");a.setStage(4);},
    waitFor:{hint:"Click stage 06 · Spot detector.",done:s=>s.stage===5,doIt:a=>{a.setStage(5);a.setMaskMode("mask");}}},
  {id:"readouts",target:"readouts",title:"Key readouts",
    body:"The −10 dB source bandwidth and main-lobe width describe the transmitted pulse. Detected / truth events and the matched-event timing RMSE score the receiver against the simulation's ground truth.\n\nTruth is used only for scoring, never for detection."},
  {id:"time",target:"time-domain",title:"Time domain",
    body:"The envelope of the selected stage (solid) is drawn over the transmitted envelope (dashed). The Trace menu switches to I and Q components, or to RF synthesized from I/Q.\n\nMoving over any time plot sets the linked cursor, shared by every plot and the spectrogram."},
  {id:"zoom",target:"plot-toolbar",title:"Zoom and pan",
    body:"The record lasts 512 ns but a pulse lasts about a nanosecond. The arrows pan, the magnifiers zoom, and Focus cursor jumps to a 20 ns window around the cursor.",
    before:a=>a.resetView(),
    waitFor:{hint:"Click Focus cursor.",done:s=>s.zoomed,doIt:a=>a.focusCursor()}},
  {id:"spectrum",target:"spectrum",title:"Receiver spectrum",
    body:"A Hann-windowed periodogram of the whole acquired I/Q record, in V²/Hz, with frequency relative to the carrier. The pulse train appears as the envelope spectrum of one pulse; the receiver filter bounds the noise floor."},
  {id:"spectrogram",target:"spectrogram",title:"Time-frequency plane",
    body:"The STFT localizes energy in both time and frequency; short pulses are vertical stripes and a persistent tone would be a horizontal line.\n\nPower shows the spectrogram, Detections the raw threshold crossings, and Spots the connected components kept as pulse fragments.",
    before:a=>a.setMaskMode("power"),
    waitFor:{hint:"Click Spots above the spectrogram.",done:s=>s.maskMode==="spots",doIt:a=>a.setMaskMode("spots")}},
  {id:"inspector",target:"inspector",title:"Stage inspector",
    body:"Explains the selected stage with its governing equation and live metrics. With Graduate detail on, it adds the modeling assumptions and limitations of that stage."},
  {id:"pulses",target:"pulses",title:"Constructed pulses",
    before:a=>a.clearSelection(),
    body:"Each row is one estimated pulse event: arrival time, width, peak, centre frequency, bandwidth, candidate train and its match to the ground truth.\n\nSelecting a row moves the cursor to the pulse and outlines its support on the spectrogram.",
    waitFor:{hint:"Click any row in the pulse table.",done:s=>s.selected!==undefined,doIt:a=>a.selectFirstPulse()}},
  {id:"branches",target:"branches",title:"Matched filter and reconstruction",
    body:"The matched filter correlates the record with the known pulse shape; it is the optimal detector in white noise and does not use arrival times.\n\nReconstruction rebuilds the waveform from the kept spectrogram cells (masked inverse STFT) and from a fitted pulse template."},
  {id:"graduate",target:"graduate",title:"Graduate detail",
    body:"Turning this on reveals the CFAR threshold inspector, timing jitter, receiver gain and limiter controls, the energy-detector branch and the reconstruction residual, plus a graduate note in every stage.",
    before:a=>a.setAdvanced(false),
    waitFor:{hint:"Switch Graduate detail on.",done:s=>s.advanced,doIt:a=>a.setAdvanced(true)}},
  {id:"sigma",target:"sigma",title:"Try it: compress the pulse",
    body:"σ sets the Gaussian envelope scale. Halving it halves the duration, and by the Fourier scaling theorem it doubles the bandwidth.\n\nThe tour set σ to 0.60 ns. Drag the slider down, or focus it and press ←.",
    before:a=>{a.setControlsOpen(true);a.change("sigma",.6e-9);},
    waitFor:{hint:"Reduce σ to 0.30 ns or less.",done:s=>s.sigma<=.3e-9+1e-15,doIt:a=>a.change("sigma",.3e-9)}},
  {id:"result",target:"readouts",title:"Bandwidth doubled",
    body:"At σ = 0.30 ns the −10 dB bandwidth is about 1.61 GHz, twice the 0.805 GHz it was at 0.60 ns, while the main-lobe width fell from 1.0 ns to about 0.5 ns. Their product, the time-bandwidth product, stays at 0.80 for a Gaussian."},
  {id:"bandwidth",target:"tabs",title:"Bandwidth explorer",
    body:"This view isolates a single pulse and compares it with a σ = 0.60 ns reference, in time and in frequency.",
    before:a=>a.setView("receiver"),
    waitFor:{hint:"Open the Bandwidth explorer tab.",done:s=>s.view==="bandwidth",doIt:a=>a.setView("bandwidth")}},
  {id:"applications",target:"applications",title:"Applications",
    body:"The tour opened Applications for you. It converts bandwidth into a range-resolution scale c/(2B) and links to experiments for indoor ranging, pulse-position communication, EW receiver education and high-power transients.",
    before:a=>a.setView("applications")},
  {id:"validation",target:"tabs",title:"Validation",
    body:"One noise realization can mislead. Validation repeats the current settings over sixteen seeded records.",
    before:a=>a.setView("applications"),
    waitFor:{hint:"Open the Validation tab.",done:s=>s.view==="validation",doIt:a=>a.setView("validation")}},
  {id:"validation-run",target:"validation-run",title:"Measure the receiver",
    body:"Run 16-trial experiment reports detection probability, unmatched events per record, the achieved noise-cell false-alarm rate against the requested CFAR Pfa, and timing RMSE. Results are marked stale when you change a control."},
  {id:"finish",target:"theme",title:"You're ready",
    body:"This button switches between light and dark themes.\n\nNext, pick an experiment from the list and follow its question at the bottom of the receiver view. The Tutorial button replays this tour at any time."},
];
