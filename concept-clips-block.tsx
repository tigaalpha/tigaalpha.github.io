/* The narrated concept clips of the Video Lessons page, as ONE lazy chunk (Step 2.4, owner 2026-11-26): CLIPS (the slide data), ConceptClipFeed and CLIP_CSS were about 64 kB of the main bundle that every
   first visit paid for although only the English / Chinese tabs of Video Lessons draw them. App.tsx loads this file with lazy() and renders it inside <Suspense>; nothing else imports concept-clips. */
import { CLIPS, ConceptClipFeed, CLIP_CSS } from "./concept-clips";
export default function ConceptClipsBlock({ vtab, onClose }: { vtab: "en" | "zh"; onClose: () => void }) {
  return (
    <>
      <style>{CLIP_CSS}</style>
      <ConceptClipFeed key={vtab} inline clips={CLIPS[vtab]} start={0} lang={vtab} onClose={onClose} />
    </>
  );
}
