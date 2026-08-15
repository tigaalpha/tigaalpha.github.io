/* ── hand-pose.ts ──
   MediaPipe hand-tracking wrapper (lazy-loaded from CDN) + finger-curl
   geometry for the Hand-Posture Coach. Extracted from App.tsx verbatim —
   no logic changes — as part of the App.tsx modularization. ── */


/* ════════════════════════════════════════════════════════════
   HAND-POSTURE COACH — lazy-load MediaPipe Tasks Vision (hand
   landmarks) from CDN in the learner's browser, draw a live skeleton
   and give simple posture feedback. Not key-detection — a mirror/coach.
════════════════════════════════════════════════════════════ */
export const MP_VER = "0.10.14";
export let _handLm = null, _mpLoading = null;
export async function loadHandLandmarker() {
  if (_handLm) return _handLm;
  if (_mpLoading) return _mpLoading;
  _mpLoading = (async () => {
    const url = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
    const vision = await import(/* @vite-ignore */ url);
    const fileset = await vision.FilesetResolver.forVisionTasks(url + "/wasm");
    _handLm = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
      numHands: 2,
      runningMode: "VIDEO",
    });
    return _handLm;
  })();
  return _mpLoading;
}
// bone connections for the 21-point MediaPipe hand
export const HAND_BONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];
export const FINGER_TIPS = [8,12,16,20];   // index..pinky tips (skip thumb)
export const FINGER_PIPS = [6,10,14,18];   // matching pip joints
// rough "are the fingers nicely curved" estimate from one hand's landmarks
export function handRoundness(lm) {
  const wrist = lm[0];
  const span = Math.hypot(lm[12].x - wrist.x, lm[12].y - wrist.y) || 1;
  let curled = 0;
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const tip = lm[FINGER_TIPS[i]], pip = lm[FINGER_PIPS[i]];
    const tipD = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipD = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    // curved finger → tip not much farther from the wrist than its pip joint
    if (tipD < pipD + span * 0.18) curled++;
  }
  return curled / FINGER_TIPS.length; // 0 = flat, 1 = nicely curved
}
