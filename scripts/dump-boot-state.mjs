/* Boot-state dump for the real bundle — what does the page actually show?
   Distinguishes "stuck at landing gate" (normal, needs a tap) from "boot
   error / blank" (broken). */
import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const html = readFileSync("index.html", "utf8");
const dom = new JSDOM(html, { url: "https://tigaalpha.github.io/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "HTMLElement", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "AudioContext", "fetch"]) { try { if (window[k] !== undefined) globalThis[k] = window[k]; } catch {} }
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = globalThis.MutationObserver || class { observe() {} disconnect() {} };
globalThis.open = () => {}; globalThis.alert = () => {}; globalThis.confirm = () => true;
class FakeAudio { constructor(){ this.currentTime=0; this.destination={}; } createGain(){ return { connect(){}, gain:{ value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} } }; } createOscillator(){ return { connect(){}, start(){}, stop(){}, frequency:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type:"" }; } createBuffer(){ return { getChannelData(){ return new Float32Array(2048); } }; } createBufferSource(){ return { connect(){}, start(){}, stop(){} }; } createBiquadFilter(){ return { connect(){}, frequency:{ value:0 } }; } createDynamicsCompressor(){ return { connect(){} }; } createAnalyser(){ return { connect(){}, fftSize:0, getByteFrequencyData(){} }; } createMediaStreamSource(){ return { connect(){} }; } resume(){ return Promise.resolve(); } }
globalThis.AudioContext = globalThis.AudioContext || FakeAudio;
try { window.AudioContext = window.AudioContext || FakeAudio; window.webkitAudioContext = window.webkitAudioContext || FakeAudio; } catch(e) {}
window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
navigator.mediaDevices = navigator.mediaDevices || {};
navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no-mic-in-test"));

const bundleJs = (html.match(/src="\.\/(bundle\/[^"]+\.js)"/) || [])[1];
try { await import(pathToFileURL(bundleJs).href); } catch (e) { console.log("IMPORT-THROW:", e.message); process.exit(1); }

for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 250));
const body = (window.document.body.textContent || "").replace(/\s+/g, " ").trim();
console.log("BODY[0..600]:", body.slice(0, 600));
console.log("----");
console.log("has landing:", body.includes("ทางคอร์ด") || body.includes("TIGA"));
console.log("has error-boundary text:", body.includes("เกิดข้อผิดพลาด") || body.includes("Something went wrong"));
console.log("body length:", body.length);
