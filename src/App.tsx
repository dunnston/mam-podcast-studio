import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { NewEpisode } from "./pages/NewEpisode";
import { Library } from "./pages/Library";
import { Settings } from "./pages/Settings";
import { useUIStore } from "./stores/uiStore";

export default function App() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-full w-full overflow-hidden bg-charcoal">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          marginLeft: sidebarCollapsed ? "64px" : "240px",
          transition: "margin-left 200ms ease",
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-episode" element={<NewEpisode />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
