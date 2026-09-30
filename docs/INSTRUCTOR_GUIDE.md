# Instructor guide

Begin with the default Gaussian. Focus the cursor, halve σ, and ask students to predict bandwidth. Compare fixed peak and fixed energy. Walk through the seven stages, change window length, switch power → detections → spots, and select an assembled pulse. End with reconstruction: removing spectral cells changes the waveform even if event timing is correct.

| Preset | Exercise | Observation |
| --- | --- | --- |
| Bandwidth and pulse width | Compare σ = 0.3, 0.6, 1.2 ns | Compression expands spectrum; normalization changes peak/energy |
| Two nearby reflectors | Sweep delay, σ and receiver bandwidth | Returns merge as resolution degrades; compare c/(2B10) |
| Indoor multipath | Increase echo/direct ratio; enable first-arrival search-back | Strongest arrival may be late; CFAR masks the direct path; look back for the first arrival |
| Narrowband interference | Move tone; compare CA/OS and tone rejection | Training contamination and persistent bins affect masks; OS is slower |
| Weak pulses in noise | Compare the envelope, rolling energy and correlation; vary σ and receiver bandwidth | ≈ +2 dB per sample hides pulses below noise peaks; the matched filter gains ≈ σ√π·B |
| Overlapping pulse trains | Vary second-source delay/frequency | Components merge; train labels are hypotheses |
| FFT/STFT tradeoffs | Increase FFT at fixed window, then increase window | Padding changes spacing, observation duration governs resolving power |
| Sampling and quantization | Reduce real-RF sample rate; toggle anti-aliasing | Bandwidth loss, aliasing and quantization differ |
| High-amplitude transient | Vary gain, ADC scale, limiter and recovery | ADC overload differs from front-end memory; energy is not damage |
| Wideband long chirp | Compare envelope and correlation width | Wideband signals can be long; matched filtering compresses response |
| PPM communication | Reduce slot spacing/SNR; inspect decisions | Known synchronization is assumed; a short record cannot establish BER |

## Graduate exercises

1. Derive the Gaussian pair. Explain the difference between B10/FWHM, two-FWHM and RMS time-bandwidth products.
2. Derive the independent-noise CA-CFAR multiplier, then measure achieved rates as window/hop change. Separate cell false alarms from false pulse events.
3. Identify a false split/merge in masks, components and pulse descriptors. Explain the failed association assumption.
4. Verify iSTFT overlap normalization. Compare waveform error against noisy input with event timing error.
5. Treat peak/noise and train labels as estimates. Propose a first-arrival/association improvement and test its failure cases.
6. Separate monostatic echo resolution, one-way ranging error and correlation timing precision; quantify stronger delayed-path bias.

## Recorded ensemble

Sixteen seeds per scenario (42 + 7919j): baseline 80/80 events matched, zero unmatched estimates, 19.1 ps RMSE; two reflectors 32/32 matched with 1 unmatched estimate; weak pulses (buried per sample) 72/80 matched with 8 unmatched estimates and 868 ps STFT-branch RMSE; PPM 96/96 matched with no unmatched estimates. The single-seed PPM regression also checks zero bit errors; ensemble event accounting is not an ensemble BER measurement.

Report configuration, gate, false-event count and sample size alongside these measurements. `validation-results.json` retains exact parameters and timings. Interactive Validation produces new measurements; old results are marked when controls change.

## Browser review

Browser automation was denied during implementation. In a permitted session, review all presets, both themes, keyboard focus, linked selections, zoom/pan and narrow layouts. Verify deployed worker loading and optional WebMCP where supported. Numerical tests/build success do not establish visual or cross-browser correctness.
