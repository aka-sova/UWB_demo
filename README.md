# UWB Signal Lab

Interactive undergraduate/graduate laboratory for ultra-wideband signals and digital receivers. Computation runs locally in a browser worker. React/TypeScript, fft.js, Recharts, Canvas, KaTeX and accessible shadcn controls provide the interface; Vinext/Vite builds the application.

## Run

Node.js 22.13 or newer is required. Install locked dependencies with `npm ci`, then use `npm run dev`. The portable preview uses http://127.0.0.1:5173/. If Windows blocks npm.ps1, use `npm.cmd` or `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` instead of `npm`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the laboratory |
| `npm run typecheck` | Check TypeScript |
| `npm test` | Scientific regression tests |
| `npm run validate:dsp` | Save 64 seeded records of validation measurements |
| `npm run build` | Build client assets and Cloudflare-compatible server |
| `npm start` | Serve the production build locally with Wrangler |

## Explore

**Tutorial** (next to Run and Step) gives a guided tour of every section, then a short hands-on experiment; leaving it early restores your workspace. Choose one of eleven presets, adjust controls, and select a receiver stage. The time cursor links waveforms, spectrogram, threshold inspector and reconstruction. Select a pulse-table row to highlight its support. Zoom/pan and **Focus cursor** reveal nanosecond structure. **Run** advances reproducible noise seeds; **Step** generates one record; reset restores the preset. Each physical record lasts 512 ns.

**Graduate detail** exposes CFAR neighborhoods, thresholds, energy detection, residuals and hardware controls. **Bandwidth explorer** demonstrates Fourier scaling and the long-chirp counterexample. **Applications** connects arrival times to ranging, radar, PPM, EW analysis and transient measurement. **Validation** runs sixteen seeded trials of the current configuration. Light/dark themes are supported, and the − / + buttons beside the theme toggle scale all text from 80% to 150%; both choices are saved locally.

## Pipeline

64 GS/s reference source → delayed paths, noise and interference → receiver FIR → gain/limiter/recovery → optional real RF → anti-alias filter → ADC → optional DDC → I/Q.

Three branches inspect the same samples:

1. Hann periodogram and complex STFT with selectable window, hop and FFT length.
2. Fixed threshold, CA-CFAR or OS-CFAR → binary mask → connected spots → temporal association/peak refinement → pulse descriptors and candidate trains.
3. Rolling energy and matched filtering, with known-clock PPM decisions.

Complex STFT coefficients support masked iSTFT; pulse-family fitting offers a separate reconstruction model. Source truth enters scoring, not detection.

## Documentation

- [Scientific conventions and limitations](docs/MODEL.md)
- [Instructor guide](docs/INSTRUCTOR_GUIDE.md)
- [Saved Monte Carlo measurements](docs/validation-results.json)
- [Implementation status](docs/STATUS.md)

All 26 numerical tests pass. In the reference ensemble, the baseline detects 80/80 events over 16 seeds with no unmatched estimates and 19.1 ps matched-event timing RMSE. This is a simulation result under recorded assumptions, not a receiver specification.

Browser automation was denied in the implementation environment. Production compilation, static checks and numerical behavior are verified; rendered layouts, keyboard interaction, browser compatibility and optional WebMCP registration still need a permitted browser review.

## Source map

`lib/dsp/engine.ts`: signal generation/acquisition; `numeric.ts`: FFT/filter primitives; `detection.ts`: detection, assembly/reconstruction; `validation.ts`: ensembles; `worker.ts`: worker protocol. `lib/scenarios.ts` defines presets/references. `components/lab` contains controls, plots and lessons.

Reuse the Site project in `.openai/hosting.json` when publishing. No application secrets or external API keys are required for numerical simulation.
