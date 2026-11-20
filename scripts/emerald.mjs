// EMERALD NOIR — build-time palette + type remap (runs after scripts/build.mjs).
//
// Walks dist/ and rewrites colour literals in CSS (files, <style> blocks, style="" and SVG
// paint attributes) onto the Emerald Noir palette, and swaps the font families.
// Markup, content and layout are never touched. `npm run build:original` skips this step.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// ---- colour maths --------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

// Exact pins for the brand colours so the key tones land precisely.
const PIN = {
  '3abdbc': [52, 165, 116],  // brand teal      -> emerald     #34A574
  '3badbc': [46, 148, 103],
  '10758b': [31, 107, 74],   // deep teal       -> deep jade   #1F6B4A
  '1f7f7e': [36, 115, 79],
  '134872': [15, 42, 31],    // navy            -> moss        #0F2A1F
  '151920': [7, 19, 14],     // ink             -> forest-noir #07130E
  '363943': [26, 42, 34],
  'e67a57': [212, 175, 95],  // coral accent    -> brass       #D4AF5F
  'e97845': [221, 185, 106],
  'bfefef': [220, 239, 226], // teal tint       -> pale jade
  'bfebef': [216, 236, 223],
  'daeff3': [233, 242, 236],
  '71c7d2': [143, 214, 176],
  'ffffff': [241, 238, 228], // white           -> bone        #F1EEE4
  '000000': [5, 13, 9],
};

function mapRGB(r, g, b, mode) {
  const key = hex([r, g, b]).slice(1);
  let [h, s, l] = rgb2hsl(r, g, b);
  if (mode === 'grad' && s >= .14 && h >= 150 && h <= 300) return hsl2rgb(155, .5, clamp(.06 + l * .28, .05, .28));
  if (PIN[key]) return PIN[key];
  if (s < .14 || (l < .22 && s < .4)) {
    // neutrals -> forest-black / bone ramp
    if (l > .96) return PIN.ffffff;
    if (l < .14) return hsl2rgb(152, .4, clamp(l * .85 + .015));
    return l > .8 ? hsl2rgb(45, .25, l) : hsl2rgb(150, .08, l);
  }
  if (h >= 150 && h <= 300) {        // cool hues -> moss / emerald / pale jade by lightness
    if (l < .3) return hsl2rgb(152, .45, l);
    if (l > .78) return hsl2rgb(145, .35, l);
    return hsl2rgb(152, clamp(s * .8, .4, .6), clamp(l, .38, .6));
  }
  if (h > 300 || h < 60) {           // warm hues -> brass
    return hsl2rgb(41, .55, clamp(l, .5, .68));
  }
  return hsl2rgb(150, .4, l);        // greens -> emerald family
}

const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const ENC = /%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
const RGB = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/gi;

function expand(h) { return h.length <= 4 ? h.split('').map(c => c + c).join('') : h; }
function recolorValue(v, mode) {
  return v
    .replace(HEX, (m, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return hex(mapRGB(...rgb, mode)) + (e.length === 8 ? e.slice(6) : '');
    })
    .replace(ENC, (m, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return '%23' + hex(mapRGB(...rgb, mode)).slice(1);
    })
    .replace(RGB, (m, r, g, b, a) => {
      const [R, G, B] = mapRGB(+r, +g, +b, mode);
      return a != null ? `rgba(${R}, ${G}, ${B}, ${a})` : `rgb(${R}, ${G}, ${B})`;
    });
}

const FONTS = v => v
  .replace(/(['"]?)Space Grotesk\1/gi, "'Syne'")
  .replace(/(['"]?)open sans\1/gi, "'Manrope'");

// CSS: only rewrite declaration values (text after ':' up to ';' or '}'); @font-face untouched.
function recolorCSS(css) {
  const faces = [];
  css = css.replace(/@font-face\s*\{[^}]*\}/gi, m => `\u0000${faces.push(m) - 1}\u0000`);
  // Large gradient fields (backgrounds) turn cool hues into steel; accents elsewhere go sodium.
  css = css.replace(/([\w-]*)(\s*):([^;{}]+)/g, (m, prop, sp, val) =>
    prop + sp + ':' + recolorValue(val, /^background/i.test(prop) && /gradient\(/i.test(val) ? 'grad' : undefined));
  css = css.replace(/(font-family|--f[db]|--e-global-typography-[\w-]*-font-family)\s*:\s*([^;}]+)/gi, (m, k, v) => k + ':' + FONTS(v));
  css = css.replace(/(font\s*:[^;}]*)/gi, m => FONTS(m));
  return css.replace(/\u0000(\d+)\u0000/g, (m, i) => faces[+i]);
}

function recolorHTML(html) {
  return html
    .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + recolorCSS(b) + c)
    .replace(/(<script(?![^>]*\bsrc=)(?![^>]*application\/(?:ld\+)?json)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + recolorJS(b) + c)
    .replace(/\sstyle="([^"]*)"/gi, (m, v) => ` style="${recolorCSS(FONTS(v))}"`)
    .replace(/\s(fill|stroke|stop-color|flood-color)="([^"]*)"/gi, (m, k, v) => ` ${k}="${recolorValue(v)}"`);
}

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

// JS (canvas / inline-style colours): only quoted hex strings and rgb(a)(r,g,b prefixes.
function recolorJS(js) {
  return js
    .replace(/(['"])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\1/g, (m, q, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return q + hex(mapRGB(...rgb)) + q;
    })
    .replace(/(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})/g, (m, a, r, s1, g, s2, b) => {
      const [R, G, B] = mapRGB(+r, +g, +b);
      return `${a}${R}${s1}${G}${s2}${B}`;
    });
}

let n = 0;
for await (const file of walk(DIST)) {
  const ext = path.extname(file).toLowerCase();
  if (!['.css', '.html', '.svg', '.js'].includes(ext)) continue;
  if (/emerald.(css|js)$/.test(file) || /dashicons|font-awesome|tabler|\.min\.js$|vendor/i.test(file)) continue;
  const src = await fs.readFile(file, 'utf8');
  const out = ext === '.css' ? recolorCSS(src) : ext === '.js' ? recolorJS(src) : recolorHTML(src);
  if (out !== src) { await fs.writeFile(file, out); n++; }
}
console.log(`Emerald Noir: recoloured ${n} files`);
