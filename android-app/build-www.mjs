// Packs the BlueNav web app into www/ so the APK runs from bundled files:
// BlueNav, AuraOS XR and Véspera, with three.js, MediaPipe and the hand model vendored.
// Gemini still goes through the published site's proxy (the key never ships in the APK).
// Needs `npm ci` at the repo root (three) and `npm install` here (@mediapipe/tasks-vision).
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname, root = path.resolve(here, '..'), www = path.join(here, 'www');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(www);
// Android WebView always takes the WebP versions of these Véspera atlases, so their PNG fallbacks stay out.
const webpOnly = new Set(['class-portraits.png', 'bosses-v2.png', 'mystics-v2.png'].map(f => path.join(root, 'vespera-rpg2/assets', f)));
const keep = src => !webpOnly.has(src) && !/\.map$/i.test(src) && (!/\.(md|txt)$/i.test(src) || /LICENSE/i.test(src));
for (const item of ['index.html', 'auraos-xr.html', 'style.css', 'config.js', 'src', 'assets', 'vespera-rpg2']) {
  fs.cpSync(path.join(root, item), path.join(www, item), { recursive: true, filter: keep });
}

const three = path.join(root, 'node_modules/three');
fs.mkdirSync(path.join(www, 'vendor/three/build'), { recursive: true });
fs.copyFileSync(path.join(three, 'build/three.module.min.js'), path.join(www, 'vendor/three/build/three.module.min.js'));
// Only the addon folders the pages import (plus the shaders the post-processing passes need).
for (const dir of ['environments', 'geometries', 'postprocessing', 'shaders', 'utils']) fs.cpSync(path.join(three, 'examples/jsm', dir), path.join(www, 'vendor/three/examples/jsm', dir), { recursive: true });
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(www, 'vendor/three/LICENSE'));

const mp = path.join(here, 'node_modules/@mediapipe/tasks-vision');
fs.mkdirSync(path.join(www, 'vendor/mediapipe/tasks-vision'), { recursive: true });
// The hand worker loads the .cjs build; the main-thread fallback imports the .mjs one.
for (const file of ['vision_bundle.mjs', 'vision_bundle.cjs']) fs.copyFileSync(path.join(mp, file), path.join(www, 'vendor/mediapipe/tasks-vision', file));
fs.cpSync(path.join(mp, 'wasm'), path.join(www, 'vendor/mediapipe/tasks-vision/wasm'), { recursive: true });
const model = await fetch(MODEL_URL);
if (!model.ok) throw new Error('hand model download failed: HTTP ' + model.status);
fs.writeFileSync(path.join(www, 'vendor/mediapipe/hand_landmarker.task'), Buffer.from(await model.arrayBuffer()));

// Point the import maps at the vendored three.js.
let pages = 0;
for (const page of ['index.html', 'auraos-xr.html']) {
  const file = path.join(www, page), html = fs.readFileSync(file, 'utf8');
  const out = html.replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/', '/vendor/three/');
  if (out === html) throw new Error(page + ' has no three.js CDN reference to replace');
  fs.writeFileSync(file, out); pages++;
}

const size = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`www pronto: ${(size(www) / 1048576).toFixed(1)} MB, ${pages} páginas apontam para three local, MediaPipe e modelo das mãos incluídos.`);
