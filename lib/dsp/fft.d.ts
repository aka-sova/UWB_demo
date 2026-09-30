declare module "fft.js" {
  export default class FFT {
    constructor(size: number);
    transform(out: Float64Array, input: Float64Array): void;
    inverseTransform(out: Float64Array, input: Float64Array): void;
  }
}
