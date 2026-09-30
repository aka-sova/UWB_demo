# Scientific conventions and limitations

## Signal and units

Internal values use seconds, hertz and volts. I/Q denotes complex voltage envelope u(t), with real RF Re{u(t)exp(j2πfct)}. The Gaussian is A exp(−t²/(2σ²)); normalized first/second derivatives and a Gaussian-windowed chirp are also available. Pulses truncate at ±7σ. The source reference uses 64 GS/s over 512 ns; receiver rates are 4, 8, 16 or 32 GS/s. Events outside the record are omitted.

Source bandwidth is the full span above −10 dB of the isolated pulse power spectrum. Time width is power FWHM around the largest lobe, including for derivative pulses. An unchirped Gaussian has T = 2√ln(2)σ and B10 = √ln(10)/(πσ), giving TB10 ≈ 0.804, distinct from 0.441 using power FWHM on both axes. Broad bandwidth permits a short pulse but does not force short duration: chirp phase broadens a long envelope's spectrum.

Fixed-energy comparison multiplies amplitude by √(0.6 ns/σ), preserving energy as width changes for the **same shape**. Different derivative families do not share identical reference energy. Energy is ∫|u|²dt in V²·ns; joules require impedance and a voltage convention. Carrier frequency differs from bandwidth. The modeled UWB criterion assumes an idealized antenna; it is not a radiated-emission certification.

Record SNR is primary train mean complex power over 512 ns divided by input noise power. Echo/interference power does not enter this numerator. Noise is independent Gaussian I/Q on the reference grid; receiver filtering changes its output power. Record SNR is not peak SNR, Eb/N0 or a noise-density specification.

## Acquisition

The channel sums direct/echo/secondary waveforms, white noise and a sinusoid. The secondary train uses 0.7 primary amplitude and 1.08 primary PRI. Echo gain is a voltage ratio. Antennas/propagation are idealized; there is no material or hardware-damage model.

Symmetric windowed-sinc FIRs use 63 taps for receiver/DDC and 95 for anti-alias filtering. Centered convolution compensates group delay and zero-extends boundaries: an offline, noncausal approximation, not hardware latency. Anti-alias cutoff is 0.44fs with a finite transition band. An undersampled real carrier can be attenuated by this filter; disabling it exposes aliasing.

Gain and radial limiting act before real-RF conversion. An overload-driven gain state recovers exponentially; this illustrates front-end memory, not a calibrated limiter or damage response. ADC components round to signed b-bit codes at Δ = 2VFS/2^b and saturate to [−2^(b−1), 2^(b−1)−1]. The clipping counter records samples beyond analog ±VFS limits. Real RF is mixed by 2exp(−j2πfct) and low-pass filtered.

Source/channel/front-end plots use the receiver time grid; source width/bandwidth use the high-rate isolated reference. RF reconstructed for display from I/Q cannot restore lost sampling bandwidth.

## FFT and STFT

Two-sided periodogram: |FFT(xw)|²/(fsΣw²), in V²/Hz. ENBW = fsΣw²/(Σw)². Bin spacing fs/NFFT differs from resolving power, which depends on window duration/shape. Zero padding adds frequency samples, not information. Hann/Hamming windows are periodic.

STFT windows center on frame timestamps and zero-pad record boundaries. Effective FFT = max(configured FFT, window); hop = min(configured hop, half-window) for stable reconstruction. Applied values are shown. Displayed span is min(0.9fs, max(receiver bandwidth, 3 GHz)); full complex coefficients remain available internally.

Power colors span −55 to 0 dB relative to the record's peak. Detections are binary; spot boxes are retained components. CFAR rectangles identify the cell, excluded guard region and training boundary. Raster caching and extrema-preserving line decimation do not change DSP samples.

## Detection

Fixed thresholds use median cell power / ln(2) as an exponential-noise mean estimate. CA-CFAR averages the training rectangle excluding guards, then applies α = N(Pfa^(−1/N)−1). Time guard half-width is G frames; frequency guard is 4G bins. Outer extents add the selected time training width and three frequency bins. Edges truncate neighborhoods.

OS-CFAR uses rank ceil(0.75N); its multiplier solves the independent exponential order-statistic equation. STFT cells are correlated and receiver noise may be nonuniform: nominal Pfa is not an achieved guarantee. Validation uses separate white-noise STFT records, excluding receiver filtering, interference and nonlinearities; this is not full receiver false-alarm calibration.

Optional tone rejection excludes bins detected in >60% of frames before eight-connected labeling. Small components are removed; temporally overlapping components are grouped with the selected gap. Original I/Q refines peak times using parabolic interpolation and measures main-lobe width, local Hann spectrum, voltage and energy. Gaussian groups may split at peaks separated by a valley below half the weaker peak. Noise can create false splits; other families retain the strongest group peak.

Local peak/noise uses a median outside ±3 estimated widths, falling back to a record median. Neighboring pulses/interference bias it. Pulse clipping flags use local I/Q proximity to ADC scale and are approximate after DDC; the global ADC count is authoritative. Candidate trains use spectral proximity, with median PRI and RMS interval deviation for train 1. These labels are not emitter identification.

Rolling energy averages |I/Q|² over approximately σ. A median-relative threshold yields one candidate per contiguous excursion; candidate timing compensates nominal averaging delay. No Pfa is asserted. Frequency-integrated STFT energy is Σ PSD Δf over displayed bins. Matched filtering uses configured shape/scale and complex correlation, without arrivals. PPM assumes a known clock, comparing early/late correlation peaks; transmitted bits are used only for scoring.

## Reconstruction and evaluation

Masked iSTFT retains complex coefficients in surviving components and normalizes overlap by Σw². Unmasked round trips reproduce samples to floating-point precision. Magnitude-only spots cannot recover phase. Template fitting adds shape assumptions and fits complex amplitude from received samples; derivative-lobe timing or overlaps can yield poor fits. Reconstruction error is relative L2 error against **received noisy I/Q**, so removing noise contributes to it.

Truth matching is one-to-one, greedy by smallest timing error within ±2 ns. Matched RMSE, missed truth and unmatched estimates are separate. This gate is not a confidence interval and can conceal close-event ambiguity. Derivative peaks need not coincide with nominal source centers. The implementation is an inspectable baseline receiver, not a production deinterleaver.

The reference grid has 32,768 complex samples; acquired records contain 2,048–16,384. FFT plans cache; worker results transfer buffers. A 130 ms debounce and request IDs suppress stale renders. Acquisition recomputes for changed controls rather than caching intermediate stages. OS-CFAR is explicit and slower (~1.5 s for its preset versus ~0.1–0.2 s for common presets on this host); extreme FFT/hop/training settings may take longer. Fidelity is never silently reduced.

Range scale c/(2B) approximates separation of comparable monostatic echoes, depending on waveform/processing. Here B is explicitly B10. It differs from single-target accuracy and one-way delay conversion cτ. Bandwidth alone does not guarantee penetration, range, detectability or accuracy.

## Primary references

- [FCC UWB definition](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15/subpart-F/section-15.503)
- [NIST Ultra-Wideband Location](https://www.nist.gov/ctl/wireless-networks-division/ultra-wideband-location)
- [MathWorks spectrogram](https://www.mathworks.com/help/signal/ref/spectrogram.html)
- [MathWorks 2-D CFAR](https://www.mathworks.com/help/phased/ref/phased.cfardetector2d-system-object.html)
- [MathWorks pulse compression](https://www.mathworks.com/help/signal/ug/radar-pulse-compression.html)
