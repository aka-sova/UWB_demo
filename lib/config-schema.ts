import {z} from "zod";
export const configSchema=z.object({
 family:z.enum(["gaussian","monocycle","doublet","chirp"]),sigma:z.number().min(.15e-9).max(12e-9),
 carrier:z.number().min(2e9).max(10e9),amplitude:z.number().min(.1).max(6),normalization:z.enum(["peak","energy"]),
 pri:z.number().min(32e-9).max(160e-9),count:z.number().int().min(1).max(8),jitter:z.number().min(0).max(3e-9),
 chirpBandwidth:z.number().min(.2e9).max(3e9),snr:z.number().min(-25).max(40),echoDelay:z.number().min(.25e-9).max(35e-9),
 echoGain:z.number().min(0).max(2),interference:z.number().min(0).max(2),interferenceOffset:z.number().min(-2.5e9).max(2.5e9),
 secondary:z.boolean(),secondaryOffset:z.number().min(-.5e9).max(2.5e9),secondaryDelay:z.number().min(0).max(50e-9),
 sampleRate:z.union([z.literal(4e9),z.literal(8e9),z.literal(16e9),z.literal(32e9)]),rxBandwidth:z.number().min(.5e9).max(10e9),
 gainDb:z.number().min(-12).max(24),fullScale:z.number().min(.2).max(6),bits:z.number().int().min(3).max(16),
 limiter:z.number().min(.2).max(10),recovery:z.number().min(0).max(30e-9),antiAlias:z.boolean(),realRF:z.boolean(),
 windowSize:z.union([z.literal(32),z.literal(64),z.literal(128),z.literal(256),z.literal(512)]),
 fftSize:z.union([z.literal(64),z.literal(128),z.literal(256),z.literal(512),z.literal(1024)]),
 hop:z.union([z.literal(8),z.literal(16),z.literal(32),z.literal(64),z.literal(128)]),window:z.enum(["hann","hamming","rectangular"]),
 detector:z.enum(["fixed","ca","os"]),thresholdDb:z.number().min(3).max(30),pfa:z.number().min(.00001).max(.1),
 training:z.number().int().min(2).max(12),guard:z.number().int().min(1).max(12),
 freqGuard:z.number().min(0).max(3e9),freqTraining:z.number().min(31.25e6).max(1.5e9),minCells:z.number().int().min(1).max(40),
 mergeGap:z.number().min(0).max(12e-9),seed:z.number().int().min(0).max(4294967295),ppm:z.boolean(),slot:z.number().min(.5e-9).max(16e-9),rejectTones:z.boolean(),
 searchBack:z.number().min(0).max(30e-9)
}).strict();
