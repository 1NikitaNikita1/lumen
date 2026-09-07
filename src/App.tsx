import { useState } from "react";
import CameraStage from "./components/CameraStage";
import TelegramStage from "./components/TelegramStage";
import TabBar, { type TabId } from "./components/TabBar";

export default function App() {
  const [tab, setTab] = useState<TabId>("camera");

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__heading">
          <span className="app__title">Lumen</span>
          <span className="app__subtitle">
            {tab === "camera" ? "paint a melody over your camera" : "play a melody from a chat"}
          </span>
        </div>
        <TabBar active={tab} onChange={setTab} />
      </header>

      {tab === "camera" ? <CameraStage /> : <TelegramStage />}
    </div>
  );
}
