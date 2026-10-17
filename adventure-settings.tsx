/* One gear button for every Adventure run (owner, 2026-10-12): it opens a pop-up with Resume, the graphics quality, sound and "back to the map". Opening it pauses
   the run (in an online room only this player's own game stops: the others keep playing). Shared by the ground runs and the ship maps. */
const T = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);

export function GearButton({ onClick }: { onClick: () => void }) {
  return <button className="adv-btn adv-gear" onClick={onClick} aria-label="settings">⚙</button>;
}

export function SettingsPopup({ lang, high, onGfx, musicOn, onMusic, online, onResume, onExit }: any) {
  const t = (a: string, b: string, c: string) => T(lang, a, b, c);
  return (
    <div className="adv-pause" role="dialog" aria-label="paused" data-pause="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="adv-pause-card">
        <span className="adv-pause-ic" aria-hidden="true">⏸</span>
        <b>{t("พักเกม", "PAUSED", "已暂停")}</b>
        <p>{online ? t("ในห้องออนไลน์ เพื่อนยังเล่นต่อ — เฉพาะเกมของคุณที่หยุด", "In an online room your friends keep playing — only your game stops.", "在线房间中好友会继续——只有你的游戏暂停。") : t("เกมหยุดอยู่ กลับมาเล่นต่อเมื่อพร้อม", "The game is paused. Come back when you are ready.", "游戏已暂停，准备好再继续。")}</p>
        <button className="adv-btn go" data-resume="1" onClick={onResume}>▶ {t("เล่นต่อ", "RESUME", "继续游戏")}</button>
        <div className="adv-pause-row" role="radiogroup" aria-label="Graphics">
          <span>{t("คุณภาพกราฟิก", "Graphics", "画质")}</span>
          <button role="radio" aria-checked={!high} className={!high ? "on" : ""} data-gfx="standard" onClick={() => high && onGfx()}>{t("ประหยัด (Lite)", "Lite", "轻量 (Lite)")}</button>
          <button role="radio" aria-checked={high} className={high ? "on" : ""} data-gfx="high" onClick={() => !high && onGfx()}>{t("สูง (HD)", "High (HD)", "高清 (HD)")}</button>
        </div>
        {onMusic && <div className="adv-pause-row"><span>{t("เสียง", "Sound", "声音")}</span>
          <button className={musicOn ? "on" : ""} aria-label="music" aria-pressed={musicOn} onClick={onMusic}>{musicOn ? "♪ " + t("เปิด", "On", "开") : "♪̸ " + t("ปิด", "Off", "关")}</button></div>}
        <button className="adv-btn" data-exit="1" onClick={onExit}>← {t("กลับแผนที่", "Back to the map", "返回地图")}</button>
      </div>
    </div>
  );
}

/* A crash inside a map must not look like the whole app dying (owner, 2026-10-12: "map 3 of the Harvester act errors and cannot be entered"; it could not
   be reproduced in the lab). This guard catches an error thrown while a film, a ship map, the farm or a ground run draws, says so on screen WITH the
   error text (so a screenshot tells us what it was), writes it to usage_events as adv "err:<map>:<message>", and offers Retry and Back to the map. */
import { Component } from "react";
import { logUsage } from "./shared-infra";
export class AdvGuard extends Component<any, any> {
  state: any = { err: null, n: 0 };
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any, info: any) { try { logUsage("adv", ("err:" + this.props.mapId + ":" + String((err && err.message) || err).replace(/\s+/g, " ")).slice(0, 180)); } catch (e) {} }
  render() {
    const { lang, onBack } = this.props; const t = (a: string, b: string, c: string) => T(lang, a, b, c);
    if (!this.state.err) return <div key={this.state.n} style={{ display: "contents" }}>{this.props.children}</div>;
    const msg = String((this.state.err && this.state.err.message) || this.state.err).slice(0, 220);
    return (
      <div className="adv-pause" role="alert" data-adv-err="1">
        <div className="adv-pause-card">
          <b>{t("แผนที่นี้ขัดข้อง", "This map ran into a problem", "此地图出了问题")}</b>
          <small style={{ wordBreak: "break-word", opacity: 0.8 }}>{msg}</small>
          <button className="adv-btn go" onClick={() => this.setState({ err: null, n: this.state.n + 1 })}>↻ {t("ลองใหม่", "Try again", "重试")}</button>
          <button className="adv-btn" onClick={() => { if (onBack) onBack(); }}>{t("กลับไปเมนูแผนที่", "Back to the map menu", "返回地图菜单")}</button>
        </div>
      </div>
    );
  }
}
