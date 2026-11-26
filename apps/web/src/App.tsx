import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { decompressFromEncodedURIComponent } from "lz-string";
import {
  courseDataMetrics,
  parsePlanJson,
  validatePlan,
} from "@unitpath/engine";
import { catalog } from "./catalog";
import { SetupPage } from "./SetupPage";
import { PlanPage } from "./PlanPage";
import { ProgressPage } from "./ProgressPage";
import { SettingsPage } from "./SettingsPage";
import { UnitDrawer } from "./UnitDrawer";
import { usePlanStore, validateImportedPlan } from "./store";
import { disclaimer } from "./ui";
import { buildTourSteps, readTourRecord, Tour } from "./Tour";

const GraphPage = lazy(() =>
  import("./GraphPage").then((module) => ({ default: module.GraphPage })),
);

const links = [
  { to: "/setup", label: "Setup", index: "01" },
  { to: "/plan", label: "Planner", index: "02" },
  { to: "/progress", label: "Progress", index: "03" },
  { to: "/graph", label: "Graph", index: "04" },
  { to: "/settings", label: "Data", index: "05" },
];

export function App() {
  const currentYear = new Date().getFullYear();
  const plan = usePlanStore((state) => state.plan);
  const setPlan = usePlanStore((state) => state.setPlan);
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const processedShare = useRef(false);
  const guideButton = useRef<HTMLButtonElement>(null);
  const [tourStart, setTourStart] = useState<number | null>(() => {
    if (window.location.hash.startsWith("#share=")) return null;
    return readTourRecord() ? null : 0;
  });
  const openTour = () => {
    const record = readTourRecord();
    setTourStart(record && !record.completed ? record.step : 0);
  };
  const closeTour = useCallback(() => {
    setTourStart(null);
    window.requestAnimationFrame(() => guideButton.current?.focus());
  }, []);
  const closeUnit = useCallback(() => setSelectedUnit(null), []);
  const issues = validatePlan(plan, catalog);
  const errors = issues.filter((issue) => issue.level === "error").length;
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  const metrics = course ? courseDataMetrics(course, catalog) : null;
  const unverified = metrics
    ? metrics.referencedUnits - metrics.verifiedUnits
    : 0;
  const selectedComponents = course
    ? [
        ...course.majors.filter((item) =>
          plan.course.majorIds.includes(item.id),
        ),
        ...course.minors.filter((item) =>
          plan.course.minorIds.includes(item.id),
        ),
        ...course.specialisations.filter((item) =>
          plan.course.specialisationIds.includes(item.id),
        ),
      ]
    : [];

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
      setPlan(validateImportedPlan(parsePlanJson(json, catalog)));
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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tourOpen = tourStart !== null;

  return (
    <>
      <div className="shell" inert={tourOpen}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="masthead">
          <NavLink to="/setup" className="wordmark" aria-label="UnitPath home">
            Unit<em>Path</em>
          </NavLink>
          <nav className="tabs" aria-label="Main navigation">
            {links.map(({ to, label, index }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `tab${isActive ? " active" : ""}`}
              >
                <span className="tab-index" aria-hidden="true">
                  {index}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="masthead-meta">
            <button
              ref={guideButton}
              type="button"
              className="guide-button"
              data-tour="guide"
              onClick={openTour}
              aria-haspopup="dialog"
            >
              <HelpCircle size={15} aria-hidden="true" />
              <span>Guide</span>
            </button>
            <span className="ticket" title={course?.title}>
              {plan.course.code} · {plan.course.version}
              {selectedComponents.length
                ? " · " +
                  selectedComponents.map((item) => item.title).join(" · ")
                : ""}
            </span>
            <span
              className={`health${errors ? " bad" : ""}`}
              aria-label={
                errors
                  ? `${errors} plan error${errors === 1 ? "" : "s"}`
                  : "No confirmed errors"
              }
            >
              <span className="health-dot" aria-hidden="true" />
              {errors
                ? `${errors} error${errors === 1 ? "" : "s"}`
                : "No confirmed errors"}
            </span>
          </div>
        </header>
        {unverified > 0 && (
          <div className="data-banner" data-tour="data-banner">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>Unofficial, unverified data.</strong> Unit rules were read
              from the Monash Handbook, but {unverified} of{" "}
              {metrics?.referencedUnits ?? 0} records have not been checked by a
              person yet.{" "}
              <span className="more">
                Confirm every unit on its Handbook page before you enrol.
              </span>
            </span>
          </div>
        )}
        <main id="main" className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            <Route
              path="/setup"
              element={
                <SetupPage
                  openUnit={setSelectedUnit}
                  currentYear={currentYear}
                />
              }
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
        <footer className="colophon">
          <p>{disclaimer}</p>
          <p className="colophon-meta">
            Plans live only in this browser · No accounts, no tracking
          </p>
        </footer>
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {selectedUnit && <UnitDrawer code={selectedUnit} close={closeUnit} />}
      </div>
      {tourOpen && (
        <Tour
          steps={buildTourSteps({ showDataBanner: unverified > 0 })}
          initialStep={tourStart}
          onClose={closeTour}
        />
      )}
    </>
  );
}
