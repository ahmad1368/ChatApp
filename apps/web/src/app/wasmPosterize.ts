// Tinder's real "WebAssembly technology support for the browser version"
// (#287) — loads and runs the real, hand-written WASM module compiled
// from wasm/posterize.wat (see that file's doc comment). Instantiated
// once and cached, since re-fetching/re-compiling the module on every
// filter application would be wasteful.
let cachedInstance: WebAssembly.Instance | null = null;

export function isWasmSupported(): boolean {
  return typeof WebAssembly !== "undefined" && typeof WebAssembly.instantiateStreaming === "function";
}

async function getInstance(): Promise<WebAssembly.Instance> {
  if (cachedInstance) return cachedInstance;
  const { instance } = await WebAssembly.instantiateStreaming(fetch("/wasm/posterize.wasm"), {});
  cachedInstance = instance;
  return instance;
}

/** Posterizes `imageData` in place using the real WASM module — quantizes each color channel (not alpha) to `levels` discrete steps. */
export async function posterizeImageData(imageData: ImageData, levels: number): Promise<void> {
  const instance = await getInstance();
  const memory = instance.exports.memory as WebAssembly.Memory;
  const posterize = instance.exports.posterize as (ptr: number, len: number, levels: number) => void;

  const len = imageData.data.length;
  const pagesNeeded = Math.ceil(len / 65536);
  if (memory.buffer.byteLength < pagesNeeded * 65536) {
    memory.grow(pagesNeeded - memory.buffer.byteLength / 65536);
  }

  const wasmBytes = new Uint8Array(memory.buffer, 0, len);
  wasmBytes.set(imageData.data);
  posterize(0, len, levels);
  imageData.data.set(wasmBytes);
}
