import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export function nativeSTTAvailable() {
  return Capacitor.isNativePlatform();
}

/*
 * Browser-SpeechRecognition-shaped adapter over @capacitor-community/speech-recognition,
 * so vmSpawnEar() (App.tsx) can do `new SR()` and use it exactly like the Web Speech API
 * object it already knows, with zero changes to its own turn-taking/watchdog/echo-filter
 * logic. Two real platform differences this class papers over:
 *
 * 1. The native plugin has no per-result isFinal flag (unlike the Web Speech API) — every
 *    partialResults event is reported here as INTERIM text only. vmSpawnEar()'s own
 *    silence timer already finalizes pure-interim text after a pause (its `consume(true)`
 *    path), so turn-taking still works correctly without a "final" signal from the plugin.
 * 2. The native engine does not run indefinitely (Android's SpeechRecognizer in particular
 *    stops after a pause). When it stops, onend fires the same way a periodic
 *    browser-engine restart already does — vmSpawnEar()'s existing reArm() picks it back
 *    up, so the "always-open ear" behavior is preserved, just via more frequent restarts.
 */
export class NativeSpeechRecognition {
  lang = "en-US";
  continuous = true;
  interimResults = true;
  maxAlternatives = 1;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;

  private _listening = false;
  private _handles: any[] = [];

  async start() {
    if (this._listening) return;
    this._listening = true;

    try {
      let perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== "granted") {
        perm = await SpeechRecognition.requestPermissions();
      }
      if (perm.speechRecognition !== "granted") {
        this._listening = false;
        this.onerror && this.onerror({ error: "not-allowed" });
        return;
      }
    } catch (e) {
      this._listening = false;
      this.onerror && this.onerror({ error: "not-allowed" });
      return;
    }

    const partialHandle = await SpeechRecognition.addListener("partialResults", (data) => {
      const text = (data && data.matches && data.matches[0]) || "";
      this.onresult &&
        this.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript: text }, isFinal: false, length: 1 }],
          length: 1,
        });
    });
    const stateHandle = await SpeechRecognition.addListener("listeningState", (data) => {
      if (data && data.status === "stopped") {
        this._listening = false;
        this._teardown();
        this.onend && this.onend();
      }
    });
    this._handles = [partialHandle, stateHandle];

    try {
      await SpeechRecognition.start({ language: this.lang, partialResults: true, popup: false });
    } catch (e) {
      this._listening = false;
      this._teardown();
      this.onerror && this.onerror({ error: "audio-capture" });
      this.onend && this.onend();
    }
  }

  async abort() {
    const wasListening = this._listening;
    this._listening = false;
    this._teardown();
    if (wasListening) {
      try {
        await SpeechRecognition.stop();
      } catch (e) {}
    }
  }

  private _teardown() {
    this._handles.forEach((h) => {
      try {
        h.remove();
      } catch (e) {}
    });
    this._handles = [];
  }
}
