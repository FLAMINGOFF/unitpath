import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  GitBranch,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { decompressFromEncodedURIComponent } from "lz-string";
import { parsePlanJson, validatePlan } from "@unitpath/engine";
import { catalog } from "./catalog";
import { SetupPage } from "./SetupPage";
import { PlanPage } from "./PlanPage";
import { ProgressPage } from "./ProgressPage";
import { SettingsPage } from "./SettingsPage";
import { UnitDrawer } from "./UnitDrawer";
import { usePlanStore, validateImportedPlan } from "./store";

const GraphPage = lazy(() =>
  import("./GraphPage").then((module) => ({ default: module.GraphPage })),
);

export const disclaimer =
  "UnitPath is an unofficial, student-built planning aid and is not affiliated with or endorsed by Monash University. Course rules and unit data may be incomplete or out of date. Always confirm your enrolment against the official Monash Handbook and with your faculty's course advisers.";

const links = [
  { to: "/setup", label: "Start & setup", icon: BookOpen },
  { to: "/plan", label: "Term planner", icon: CalendarDays },
  { to: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { to: "/graph", label: "Prerequisite graph", icon: GitBranch },
  { to: "/settings", label: "Settings & data", icon: Settings2 },
];

export function App() {
  const plan = usePlanStore((state) => state.plan);
  const setPlan = usePlanStore((state) => state.setPlan);
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const processedShare = useRef(false);
  const issues = validatePlan(plan, catalog);
  const errors = issues.filter((issue) => issue.level === "error").length;

  useEffect(() => {
    if (processedShare.current || !window.location.hash.startsWith("#share="))
      return;
    processedShare.current = true;
    const compressed = window.location.hash.slice("#share=".length);
    try {
      if (compressed.length > 1_000_000)
        throw new Error("Share link is too large.");
      const json = decompressFromEncodedURIComponent(compressed);
      if (!json) throw new Error("Share link could not be decoded.");
      setPlan(validateImportedPlan(parsePlanJson(json)));
      setNotice(
        "Shared plan imported. Review it against the official Handbook.",
      );
      navigate("/plan", { replace: true });
    } catch (error) {
      setNotice(
        `Share link rejected: ${error instanceof Error ? error.message : "invalid data"}`,
      );
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [navigate, setPlan]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-icon">
            U<span>.</span>
          </span>
          <div>
            <strong>UnitPath</strong>
            <small>Degree planning, clearer.</small>
          </div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="data-alert">
            <ShieldAlert size={18} />
            <div>
              <strong>Data review in progress</strong>
              <p>All 17 unit records need Handbook verification.</p>
            </div>
          </div>
          <div className="sidebar-foot">
            C2000 · 2026 · Applied cybersecurity
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            C2000 <span>/</span> 2026 <span>/</span> Applied cybersecurity
          </div>
          <div className="topbar-right">
            <span className="version-pill">LOCAL PLAN</span>
            <span className={`health-pill${errors ? " has-errors" : ""}`}>
              {errors
                ? `${errors} plan error${errors === 1 ? "" : "s"}`
                : "No confirmed errors"}
            </span>
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            <Route
              path="/setup"
              element={<SetupPage openUnit={setSelectedUnit} />}
            />
            <Route
              path="/plan"
              element={
                <PlanPage openUnit={setSelectedUnit} notify={setNotice} />
              }
            />
            <Route
              path="/progress"
              element={<ProgressPage openUnit={setSelectedUnit} />}
            />
            <Route
              path="/graph"
              element={
                <Suspense fallback={<div className="page">Loading graph…</div>}>
                  <GraphPage openUnit={setSelectedUnit} />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={<SettingsPage notify={setNotice} />}
            />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </Routes>
        </main>
        <footer className="footer">{disclaimer}</footer>
      </div>
      {selectedUnit && (
        <UnitDrawer code={selectedUnit} close={() => setSelectedUnit(null)} />
      )}
    </div>
  );
}
