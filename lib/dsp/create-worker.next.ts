// Next.js build (e.g. Vercel). Vinext rewrites this URL form to a file:// base,
// so the Vite build uses create-worker.ts instead.
export function createDspWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {type: "module"});
}
