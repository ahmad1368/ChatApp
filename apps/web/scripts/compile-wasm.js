// Compiles wasm/posterize.wat (real, hand-written WebAssembly text format
// source — see that file's doc comment for #287's honest scoping) into
// public/wasm/posterize.wasm, the binary actually served to the browser.
// Run with `node scripts/compile-wasm.js` whenever the .wat source changes.
const fs = require("fs");
const path = require("path");
const wabt = require("wabt");

async function main() {
  const wabtModule = await wabt();
  const watPath = path.join(__dirname, "..", "wasm", "posterize.wat");
  const wasmPath = path.join(__dirname, "..", "public", "wasm", "posterize.wasm");
  const watSource = fs.readFileSync(watPath, "utf8");
  const wasmModule = wabtModule.parseWat(watPath, watSource);
  const { buffer } = wasmModule.toBinary({});
  fs.mkdirSync(path.dirname(wasmPath), { recursive: true });
  fs.writeFileSync(wasmPath, Buffer.from(buffer));
  console.log(`Compiled ${watPath} -> ${wasmPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
