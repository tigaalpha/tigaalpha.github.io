import { useState, useRef, useEffect } from "react";
import { loadHandLandmarker, HAND_BONES, handRoundness, wristDroop, thumbTucked } from "./hand-pose";
import { getAC } from "./music-engine";
import { L } from "./i18n";
import { fetchChatCompletion } from "./ai-backend";
import { logActivity } from "./shared-infra";
import { API_MODEL } from "./App";
import { speakCloud, speakDeviceOrNative, stopSpeaking, stopCloudTTS } from "./speech";
/* ── use-camera-coach.ts ──
   Owns the hand-posture camera coach: live MediaPipe hand-landmark
   tracking + shape feedback while the camera runs, and an on-demand AI
   snapshot critique (analyzeHands, Max-only). CameraCoachOverlay.tsx
   (Phase 2) is this hook's only external consumer beyond PianoApp; every
   prop it already receives keeps its exact original name.

   handleCoachNavigate()/goToRecommendation() - two broader PianoApp
   navigation dispatchers that happen to call this hook's openCamera()
   among many other destinations (sight-reading, play-along, ear
   training, pathway) - sit textually between openCamera/exitCamera and
   analyzeHands/retryCamera in the original source, but are NOT
   camera-coach concerns and stay in PianoApp untouched, unchanged,
   still referencing openCamera/openSight/etc. by their same bare names
   (now hook-returned consts in PianoApp's scope).

   API_MODEL is exported in place from App.tsx (not moved) - same
   convention as use-practice-mode.ts's logPractice/scoreDynamics: it's
   also used directly by AdminPayments, a separate top-level component,
   so it can't be prop-threaded from PianoApp alone. premium/
   setPricingOpen (use-payment.ts) and lang are threaded as ordinary
   params; `lc` is derived from `lang` inside the hook, the same
   convention every Phase 2 overlay component already uses.

   Fun/value pass (feature audit item #4): the live tip is now graded
   across three signals (roundness/wrist droop/thumb tuck), not just
   good/flat — each debounced over ~20 recent frames so single-frame
   camera noise doesn't flip the message every few tenths of a second.
   analyzeHands()'s reply is now spoken aloud automatically through the
   app's existing TTS pipeline (same speakCloud/speakDeviceOrNative
   fallback chat-ui.tsx's SpeakBtn already uses), since the whole point
   of this feature is keeping your eyes on your hands, not the screen.
   exitCamera() now shows a brief session recap (this session's "good
   shape" % vs a small rolling history in localStorage) before actually
   closing, instead of silently discarding the number it already
   computes. ── */
const CAM_HISTORY_KEY = "tg_camhistory";
function readCamHistory() { try { return JSON.parse(localStorage.getItem(CAM_HISTORY_KEY) || "[]"); } catch (e) { return []; } }
function writeCamHistory(h) { try { localStorage.setItem(CAM_HISTORY_KEY, JSON.stringify(h.slice(-10))); } catch (e) {} }

export function useCameraCoach({ lang, premium, setPricingOpen }) {
  const lc = L[lang];

  const [camOpen, setCamOpen] = useState(false);
  const [camStatus, setCamStatus] = useState("idle");        // idle|loading|running|error
  const [camMsg, setCamMsg] = useState("");
  const [camCoach, setCamCoach] = useState(null);            // {loading} | {text} AI hand-posture feedback
  const [camTry, setCamTry] = useState(0);                    // bump to retry
  const [camRecap, setCamRecap] = useState(null);             // {pct, trend:"up"|"same"|"first"} | null — shown on exit before actually closing
  const [camSpeaking, setCamSpeaking] = useState(false);

  // camera runtime refs
  const camVideoRef = useRef(null);
  const camCanvasRef = useRef(null);
  const camStreamRef = useRef(null);
  const camRafRef = useRef(0);
  const camRunRef = useRef(false);
  const camMsgRef = useRef("");
  const handRoundFramesRef = useRef({ good: 0, total: 0 }); // Technique skill: hand-shape frames this session — see exitCamera()
  const camLastRoundRef = useRef({ hands: 0, avgRoundness: null, wristDroop: null, thumbTuck: false }); // latest live geometry reading — fed to analyzeHands() so the AI critique is grounded in real numbers, not re-derived from the photo alone
  const camSignalWindowRef = useRef([]); // last ~20 frames' {round,wrist,thumb} for the debounced live tip

  // ════ HAND-POSTURE COACH (camera) ════
  function openCamera() { handRoundFramesRef.current = { good: 0, total: 0 }; camSignalWindowRef.current = []; setCamOpen(true); setCamRecap(null); }
  function exitCamera() {
    stopSpeaking(); stopCloudTTS(); setCamSpeaking(false);
    setCamCoach(null);
    // Technique skill: normalize to a fixed 10-point contribution regardless of
    // session length, so one long camera session can't dominate the
    // recency-weighted skill score the way a raw frame count would.
    const { good, total } = handRoundFramesRef.current;
    if (total >= 30) {
      const ok = Math.round((good / total) * 10);
      logActivity("drill", "hand_coach", ok, 10 - ok, 0, "technique");
      const pct = Math.round((good / total) * 100);
      const hist = readCamHistory();
      const prev = hist.length ? hist[hist.length - 1].pct : null;
      writeCamHistory([...hist, { pct, t: Date.now() }]);
      setCamRecap({ pct, trend: prev == null ? "first" : pct > prev + 3 ? "up" : pct < prev - 3 ? "down" : "same" });
      return; // recap card shown; closeCameraForReal() is what actually hides the overlay
    }
    setCamOpen(false);
  }
  function closeCameraAfterRecap() { setCamRecap(null); setCamOpen(false); }

  // snapshot the camera and ask the AI teacher to critique hand posture/technique
  async function analyzeHands() {
    if (!premium) { setPricingOpen(true); return; }
    const v = camVideoRef.current;
    if (!v || !v.videoWidth || (camCoach && camCoach.loading)) return;
    getAC(); // unlock audio inside this tap gesture (iOS Safari) — the TTS call itself happens later, after the reply arrives
    setCamCoach({ loading: true });
    try {
      const cv = document.createElement("canvas");
      const w = 640, scale = w / v.videoWidth;
      cv.width = w; cv.height = Math.round(v.videoHeight * scale);
      cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL("image/jpeg", 0.7);
      const sys = lang === "th"
        ? "คุณคือครูเปียโนผู้เชี่ยวชาญ ดูรูปมือ/ท่านั่งของผู้เรียนที่กำลังเล่นเปียโน แล้วให้คำแนะนำสั้นๆ อบอุ่น 2-4 ข้อ เรื่องท่ามือ การวางนิ้ว ข้อมือ ท่านั่ง ชมสิ่งที่ดีก่อนแล้วบอกจุดที่ควรปรับ นอกจากภาพแล้วคุณจะได้ตัวเลขความโค้งของนิ้ว ระดับข้อมือ และนิ้วโป้งที่วัดจากกล้องแบบเรียลไทม์ด้วย ใช้ประกอบกับสิ่งที่เห็นในภาพ ตอบเป็นภาษาไทย ห้ามใช้มาร์กดาวน์"
        : lang === "zh"
        ? "你是专业钢琴老师。看学员弹琴的手型/坐姿照片，给出2-4条简短温暖的建议：手型、指法、手腕、坐姿。先表扬再指出可改进处。除了照片，你还会收到摄像头实时测得的手指弯曲度、手腕水平度和拇指位置数据，请结合两者判断。用中文回答，不要markdown"
        : "You are an expert piano teacher. Look at this photo of the learner's hands/posture at the piano and give 2-4 short, warm tips on hand shape, finger placement, wrist and posture. Praise first, then what to adjust. Alongside the photo you'll also get real-time finger-curl, wrist-level, and thumb-position measurements from the camera — use them together with what you see in the image. Reply in plain text, no markdown.";
      const { hands: handCount, avgRoundness, wristDroop: wd, thumbTuck } = camLastRoundRef.current;
      const geomTxt = !handCount
        ? (lang === "th" ? "ข้อมูลกล้องเรียลไทม์: ไม่พบมือในเฟรมล่าสุด" : lang === "zh" ? "实时摄像头数据：最近一帧未检测到手" : "Real-time camera data: no hand detected in the latest frame")
        : (lang === "th" ? `ข้อมูลกล้องเรียลไทม์: พบ ${handCount} มือ, คะแนนความโค้งนิ้วเฉลี่ย ${avgRoundness.toFixed(2)}/1.00 (0=นิ้วเหยียดแบน, 1=โค้งดี), ข้อมือ${wd > 0.15 ? "ตกลงเล็กน้อย" : "อยู่ในระดับดี"}, นิ้วโป้ง${thumbTuck ? "หุบเข้าไปหน่อย" : "ผ่อนคลายดี"}`
          : lang === "zh" ? `实时摄像头数据：检测到${handCount}只手，平均手指弯曲度 ${avgRoundness.toFixed(2)}/1.00（0=手指伸直平放，1=弯曲良好），手腕${wd > 0.15 ? "略微下垂" : "水平良好"}，拇指${thumbTuck ? "收得有点紧" : "放松良好"}`
          : `Real-time camera data: ${handCount} hand(s) detected, average finger-curl score ${avgRoundness.toFixed(2)}/1.00 (0 = flat, 1 = well-curved), wrist ${wd > 0.15 ? "drooping slightly" : "at a good level"}, thumb ${thumbTuck ? "tucked in a bit" : "relaxed"}`);
      const body = { model: API_MODEL, max_tokens: 500, system: sys, feature: "camera", messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
        { type: "text", text: geomTxt + "\n\n" + (lang === "th" ? "ดูมือผมแล้วแนะนำหน่อยครับ" : lang === "zh" ? "看看我的手，给点建议" : "Check my hands and give feedback.") }
      ] }] };
      const reply = (await fetchChatCompletion(body)).trim();
      const text = reply || lc.err;
      setCamCoach({ text });
      if (reply) {
        setCamSpeaking(true);
        speakCloud(text, lang, null, () => setCamSpeaking(false),
          () => { speakDeviceOrNative(text, lang, () => setCamSpeaking(false), () => setCamSpeaking(false)).catch(() => setCamSpeaking(false)); });
      }
    } catch (e) { setCamCoach({ text: lc.camCoachErr }); }
  }
  function retryCamera() { setCamTry(t => t + 1); }
  useEffect(() => {
    if (!camOpen) return;
    let cancelled = false;
    setCamStatus("loading"); setCamMsg(""); camMsgRef.current = "";
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        camStreamRef.current = stream;
        const v = camVideoRef.current;
        if (!v) throw new Error("no video element");
        v.srcObject = stream;
        await v.play();
        const lm = await loadHandLandmarker();
        if (cancelled) return;
        camRunRef.current = true;
        setCamStatus("running");
        const loop = () => {
          if (!camRunRef.current) return;
          const video = camVideoRef.current, cv = camCanvasRef.current;
          if (video && cv && video.videoWidth) {
            const W = cv.width = video.videoWidth, H = cv.height = video.videoHeight;
            const ctx = cv.getContext("2d");
            ctx.clearRect(0, 0, W, H);
            let res = null;
            try { res = lm.detectForVideo(video, performance.now()); } catch (e) {}
            const hands = (res && res.landmarks) || [];
            let round = 0, wrist = 0, thumbIn = 0;
            for (const pts of hands) {
              ctx.strokeStyle = "rgba(217,119,87,0.85)"; ctx.lineWidth = 4;
              for (const [a, b] of HAND_BONES) {
                ctx.beginPath(); ctx.moveTo(pts[a].x * W, pts[a].y * H); ctx.lineTo(pts[b].x * W, pts[b].y * H); ctx.stroke();
              }
              ctx.fillStyle = "#ff5252";
              for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2); ctx.fill(); }
              round += handRoundness(pts);
              wrist += wristDroop(pts);
              if (thumbTucked(pts)) thumbIn++;
            }
            const avgRound = hands.length ? round / hands.length : 0;
            const avgWrist = hands.length ? wrist / hands.length : 0;
            const thumbBad = hands.length > 0 && thumbIn / hands.length >= 0.5;
            camLastRoundRef.current = { hands: hands.length, avgRoundness: hands.length ? avgRound : null, wristDroop: avgWrist, thumbTuck: thumbBad };
            if (hands.length) {
              handRoundFramesRef.current.total++;
              if (avgRound >= 0.6) handRoundFramesRef.current.good++;
              // Debounced, graded live tip: average the last ~20 frames of each signal
              // instead of reacting to any single noisy frame. Roundness still leads
              // (it's the best-proven signal); wrist/thumb only surface when they're
              // consistently off AND roundness itself isn't already the bigger problem.
              const win = camSignalWindowRef.current;
              win.push({ round: avgRound, wrist: avgWrist, thumb: thumbBad ? 1 : 0 });
              if (win.length > 20) win.shift();
              const n = win.length;
              const mRound = win.reduce((s, w) => s + w.round, 0) / n;
              const mWrist = win.reduce((s, w) => s + w.wrist, 0) / n;
              const mThumb = win.reduce((s, w) => s + w.thumb, 0) / n;
              let msg;
              if (mRound < 0.6) msg = L[lang].camTipFlat;
              else if (mWrist > 0.15) msg = L[lang].camTipWrist;
              else if (mThumb > 0.5) msg = L[lang].camTipThumb;
              else msg = L[lang].camTipGood;
              if (msg !== camMsgRef.current) { camMsgRef.current = msg; setCamMsg(msg); }
            } else {
              camSignalWindowRef.current = [];
              if (L[lang].camNoHands !== camMsgRef.current) { camMsgRef.current = L[lang].camNoHands; setCamMsg(L[lang].camNoHands); }
            }
          }
          camRafRef.current = requestAnimationFrame(loop);
        };
        camRafRef.current = requestAnimationFrame(loop);
      } catch (e) { if (!cancelled) setCamStatus("error"); }
    })();
    return () => {
      cancelled = true;
      camRunRef.current = false;
      cancelAnimationFrame(camRafRef.current);
      if (camStreamRef.current) { try { camStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {} camStreamRef.current = null; }
      const v = camVideoRef.current; if (v) v.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen, camTry]);
  return { camOpen, setCamOpen, camStatus, setCamStatus, camMsg, setCamMsg, camCoach, setCamCoach, camTry, setCamTry, camRecap, camSpeaking, camVideoRef, camCanvasRef, camStreamRef, camRafRef, camRunRef, camMsgRef, handRoundFramesRef, openCamera, exitCamera, closeCameraAfterRecap, analyzeHands, retryCamera };
}
