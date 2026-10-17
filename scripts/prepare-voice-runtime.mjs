import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { mkdir, copyFile, stat, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const transformers = require.resolve("@huggingface/transformers");
const runtime = dirname(
  require.resolve("onnxruntime-web", { paths: [dirname(transformers)] }),
);
const target = resolve("public/voice-runtime");
const { version } = require(resolve(runtime, "../package.json"));
const versionedTarget = resolve(target, version);
const files = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];
await mkdir(versionedTarget, { recursive: true });
let bytes = 92361116 + 4 * 522240;
for (const file of files) {
  await copyFile(resolve(runtime, file), resolve(versionedTarget, file));
  bytes += (await stat(resolve(versionedTarget, file))).size;
}
await writeFile(
  resolve(target, "manifest.json"),
  JSON.stringify({
    version,
    files: files.map((file) => `${version}/${file}`),
    bytes,
  }),
);
console.log(
  `Prepared optional voice runtime (${Math.ceil(bytes / 1000000)} MB total pack).`,
);
