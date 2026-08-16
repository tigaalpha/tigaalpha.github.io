import { useState, useRef, useEffect } from "react";
import { loadHandLandmarker, HAND_BONES, handRoundness } from "./hand-pose";
import { L } from "./i18n";
import { fetchChatCompletion } from "./ai-backend";
import { logActivity } from "./shared-infra";
import { API_MODEL } from "./App";
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
   convention every Phase 2 overlay component already uses. ── */
export function useCameraCoach({ lang, premium, setPricingOpen }) {
  const lc = L[lang];

  const [camOpen, setCamOpen] = useState(false);
  const [camStatus, setCamStatus] = useState("idle");        // idle|loading|running|error
  const [camMsg, setCamMsg] = useState("");
  const [camCoach, setCamCoach] = useState(null);            // {loading} | {text} AI hand-posture feedback
  const [camTry, setCamTry] = useState(0);                    // bump to retry

  // camera runtime refs
  const camVideoRef = useRef(null);
  const camCanvasRef = useRef(null);
  const camStreamRef = useRef(null);
  const camRafRef = useRef(0);
  const camRunRef = useRef(false);
  const camMsgRef = useRef("");
  const handRoundFramesRef = useRef({ good: 0, total: 0 }); // Technique skill: hand-shape frames this session — see exitCamera()

  // ════ HAND-POSTURE COACH (camera) ════
  function openCamera() { handRoundFramesRef.current = { good: 0, total: 0 }; setCamOpen(true); }
  function exitCamera() {
    setCamOpen(false); setCamCoach(null);
    // Technique skill: normalize to a fixed 10-point contribution regardless of
    // session length, so one long camera session can't dominate the
    // recency-weighted skill score the way a raw frame count would.
    const { good, total } = handRoundFramesRef.current;
    if (total >= 30) {
      const ok = Math.round((good / total) * 10);
      logActivity("drill", "hand_coach", ok, 10 - ok, 0, "technique");
    }
  }

  // snapshot the camera and ask the AI teacher to critique hand posture/technique
  async function analyzeHands() {
    if (!premium) { setPricingOpen(true); return; }
    const v = camVideoRef.current;
    if (!v || !v.videoWidth || (camCoach && camCoach.loading)) return;
    setCamCoach({ loading: true });
    try {
      const cv = document.createElement("canvas");
      const w = 640, scale = w / v.videoWidth;
      cv.width = w; cv.height = Math.round(v.videoHeight * scale);
      cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL("image/jpeg", 0.7);
      const sys = lang === "th"
        ? "คุณคือครูเปียโนผู้เชี่ยวชาญ ดูรูปมือ/ท่านั่งของผู้เรียนที่กำลังเล่นเปียโน แล้วให้คำแนะนำสั้นๆ อบอุ่น 2-4 ข้อ เรื่องท่ามือ การวางนิ้ว ข้อมือ ท่านั่ง ชมสิ่งที่ดีก่อนแล้วบอกจุดที่ควรปรับ ตอบเป็นภาษาไทย ห้ามใช้มาร์กดาวน์"
        : lang === "zh"
        ? "你是专业钢琴老师。看学员弹琴的手型/坐姿照片，给出2-4条简短温暖的建议：手型、指法、手腕、坐姿。先表扬再指出可改进处。用中文回答，不要markdown"
        : "You are an expert piano teacher. Look at this photo of the learner's hands/posture at the piano and give 2-4 short, warm tips on hand shape, finger placement, wrist and posture. Praise first, then what to adjust. Reply in plain text, no markdown.";
      const body = { model: API_MODEL, max_tokens: 500, system: sys, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
        { type: "text", text: lang === "th" ? "ดูมือผมแล้วแนะนำหน่อยครับ" : lang === "zh" ? "看看我的手，给点建议" : "Check my hands and give feedback." }
      ] }] };
      const reply = (await fetchChatCompletion(body)).trim();
      setCamCoach({ text: reply || lc.err });
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
            let round = 0;
            for (const pts of hands) {
              ctx.strokeStyle = "rgba(217,119,87,0.85)"; ctx.lineWidth = 4;
              for (const [a, b] of HAND_BONES) {
                ctx.beginPath(); ctx.moveTo(pts[a].x * W, pts[a].y * H); ctx.lineTo(pts[b].x * W, pts[b].y * H); ctx.stroke();
              }
              ctx.fillStyle = "#ff5252";
              for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2); ctx.fill(); }
              round += handRoundness(pts);
            }
            const msg = !hands.length ? L[lang].camNoHands
              : (round / hands.length) >= 0.6 ? L[lang].camTipGood : L[lang].camTipFlat;
            if (msg !== camMsgRef.current) { camMsgRef.current = msg; setCamMsg(msg); }
            // Technique skill: reuse this exact same 0.6 "good shape" threshold the
            // live tip already uses, accumulated across the session instead of
            // discarded every frame — see exitCamera().
            if (hands.length) {
              handRoundFramesRef.current.total++;
              if (round / hands.length >= 0.6) handRoundFramesRef.current.good++;
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
  return { camOpen, setCamOpen, camStatus, setCamStatus, camMsg, setCamMsg, camCoach, setCamCoach, camTry, setCamTry, camVideoRef, camCanvasRef, camStreamRef, camRafRef, camRunRef, camMsgRef, handRoundFramesRef, openCamera, exitCamera, analyzeHands, retryCamera };
}
