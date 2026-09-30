// Vite/vinext build. Next.js aliases this module to create-worker.next.ts
// (see next.config.ts), since Next cannot resolve `?worker` imports.
import DspWorker from "./worker?worker";

export function createDspWorker(): Worker {
  return new DspWorker();
}
