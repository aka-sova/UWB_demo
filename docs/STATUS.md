# Implementation checkpoint — 2026-09-30

Implemented: acquisition pipeline, FFT/STFT, fixed/CA/OS detection, spot/pulse assembly, reconstruction, energy/correlation branches, PPM, bandwidth/application lessons, eleven presets, themes and seeded validation.

Verified: 26/26 numerical tests, TypeScript, lint on application modules and production compilation. KaTeX font resolution corrected. Saved ensemble: 64 records over four scenarios. Common presets take ~0.1–0.2 s; OS-CFAR ~1.5 s on this host. The production build warns about a large client chunk; compilation succeeds.

Final production build and TypeScript pass. The built worker passes a Node-based check of numerical execution, transferable buffers and invalid-parameter rejection. This check does not emulate a browser. Private publication is the remaining handoff step. Browser automation was denied, leaving visual, keyboard, interaction and cross-browser QA unverified. Do not bypass that denial via another automation route. Optional WebMCP is unverified.

Worker URL correction (2026-09-30): both browser worker constructors now use Vite's explicit `?worker` import. The previous `new URL(..., import.meta.url)` form was transformed by Vinext to a `file://` base and failed under the HTTP origin. The production bundle now emits an origin-relative `/_next/static/worker-*.js` URL and contains no file-scheme worker reference.

Resume in C:/uwb/uwb-signal-lab. Outer log: C:/uwb/PROGRESS.md. Registered Site: appgprj_6abd0ce3ac94819198e64b53a1d32d3a, also in .openai/hosting.json; do not duplicate. Preview: http://127.0.0.1:5173/. Credentials are not stored in source.

Model limitations are documented in MODEL.md. Optional FFT channelizer and intermediate acquisition-stage caching were not added; the STFT and worker pipeline cover the core demonstration.

Review fixes (2026-09-30): DDC 2fc image rejection, bandwidth-scaled receiver FIR (FFT convolution), anti-alias stopband below Nyquist, non-folding limiter recovery, echo carrier phase, clipped-plateau and template-correlation timing, noise-significant deblending, size-ordered trains, PPM symbol accounting, first-arrival search-back, retuned weak-pulse preset, band-limited RF trace and half-pixel spectrogram alignment. A desktop-viewport pass in the Claude desktop browser checked the default, multipath, weak and sampling presets, spectrogram/overlay alignment and the RF trace without console errors; full cross-browser, keyboard and narrow-layout QA remains open.
