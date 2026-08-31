import { createRoot } from "react-dom/client";
import { MonsterArt } from "./starsong";
import { CSS } from "./app-styles";
const IDS = ["terra", "ferros", "glacius", "emberfall", "starsong"];
function App() {
  return (
    <>
      <style>{CSS}</style>
      <div className="ig2">
        {IDS.map(w => <div className="cell" key={w}><MonsterArt world={w} /><i>{w}</i></div>)}
        {IDS.map(w => <div className="cell" key={w + "b"}><MonsterArt world={w} boss /><i>{w} BOSS</i></div>)}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
