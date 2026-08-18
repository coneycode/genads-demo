import { useEffect } from "react";
import Header from "./components/Header";
import ChatPanel from "./components/ChatPanel";
import EnginePanel from "./components/EnginePanel";
import MetricsPanel from "./components/MetricsPanel";
import TourOverlay from "./components/TourOverlay";
import { useStore } from "./store/useStore";

export default function App() {
  const { currentTurn, metrics, cumulativeTrustCost, revenueSeries, tourSeen, startTour } = useStore();

  // 首次打开自动出现引导浮层
  useEffect(() => {
    if (!tourSeen) startTour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        <div className="col-span-4 min-h-0">
          <ChatPanel />
        </div>
        <div className="col-span-5 min-h-0">
          <EnginePanel turn={currentTurn} />
        </div>
        <div className="col-span-3 min-h-0">
          <MetricsPanel metrics={metrics} cumTrust={cumulativeTrustCost} revenueSeries={revenueSeries} />
        </div>
      </main>
      <TourOverlay />
    </div>
  );
}
