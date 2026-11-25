import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  GripVertical,
  Info,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  autoSchedule,
  evaluateRequisites,
  periodFromOrdinal,
  periodOrdinal,
  validatePlan,
  type Issue,
  type Period,
  type Plan,
  type ScheduleResult,
  type Unit,
} from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";

const termLabel = (period: Period) =>
  `${period.year} · Semester ${period.term === "S1" ? "1" : "2"}`;

function UnitCard({
  entry,
  issues,
  periods,
  move,
  remove,
  changeStatus,
  openUnit,
}: {
  entry: Plan["entries"][number];
  issues: Issue[];
  periods: Period[];
  move: (code: string, period: Period) => void;
  remove: (code: string) => void;
  changeStatus: (
    code: string,
    status: Plan["entries"][number]["status"],
  ) => void;
  openUnit: (code: string) => void;
}) {
  const unit = catalog.units[entry.unit];
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entry.unit });
  const error = issues.some((issue) => issue.level === "error");
  const warning = issues.some((issue) => issue.level === "warning");
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.55 : 1,
      }}
      className={`unit-card ${entry.status}${error ? " error" : warning ? " warning" : ""}`}
    >
      <div className="unit-card-top">
        <button
          className="drag-handle"
          type="button"
          aria-label={`Drag ${entry.unit}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
        <button
          className="unit-code-button"
          type="button"
          onClick={() => openUnit(entry.unit)}
        >
          {entry.unit}
        </button>
        <span className={`status-dot ${entry.status}`} aria-hidden="true" />
      </div>
      <button
        className="unit-title-button"
        type="button"
        onClick={() => openUnit(entry.unit)}
      >
        {unit?.title ?? "Unknown unit"}
      </button>
      <div className="unit-card-meta">
        <span>{unit?.creditPoints ?? "?"} points</span>
        {error ? (
          <span className="issue-tag error">✕ Error</span>
        ) : warning ? (
          <span className="issue-tag warning">! Warning</span>
        ) : !unit?.verified ? (
          <span className="issue-tag unknown">? Unverified</span>
        ) : (
          <span className="issue-tag okay">✓ Listed</span>
        )}
      </div>
      <div className="unit-card-controls">
        <label className="sr-only" htmlFor={`status-${entry.unit}`}>
          Status for {entry.unit}
        </label>
        <select
          id={`status-${entry.unit}`}
          value={entry.status}
          onChange={(event) =>
            changeStatus(
              entry.unit,
              event.target.value as Plan["entries"][number]["status"],
            )
          }
        >
          <option value="planned">Planned</option>
          <option value="enrolled">Enrolled</option>
          <option value="completed">Completed</option>
        </select>
        <label className="sr-only" htmlFor={`move-${entry.unit}`}>
          Move {entry.unit} to term
        </label>
        <select
          id={`move-${entry.unit}`}
          value={periodOrdinal(entry.period)}
          onChange={(event) =>
            move(entry.unit, periodFromOrdinal(Number(event.target.value)))
          }
        >
          {periods.map((period) => (
            <option key={periodOrdinal(period)} value={periodOrdinal(period)}>
              {period.year} {period.term}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button subtle"
          onClick={() => remove(entry.unit)}
          aria-label={`Remove ${entry.unit}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {issues
        .filter((issue) => issue.level === "error")
        .slice(0, 1)
        .map((issue) => (
          <p className="card-issue" key={issue.code}>
            {issue.message}
          </p>
        ))}
    </article>
  );
}

function TermColumn({
  period,
  entries,
  issues,
  periods,
  dimmed,
  move,
  remove,
  changeStatus,
  openUnit,
  addHere,
}: {
  period: Period;
  entries: Plan["entries"];
  issues: Issue[];
  periods: Period[];
  dimmed: boolean;
  move: (code: string, period: Period) => void;
  remove: (code: string) => void;
  changeStatus: (
    code: string,
    status: Plan["entries"][number]["status"],
  ) => void;
  openUnit: (code: string) => void;
  addHere: (period: Period) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `term-${periodOrdinal(period)}`,
  });
  const termEntries = entries.filter(
    (entry) => periodOrdinal(entry.period) === periodOrdinal(period),
  );
  const points = termEntries.reduce(
    (sum, entry) => sum + (catalog.units[entry.unit]?.creditPoints ?? 0),
    0,
  );
  return (
    <section
      ref={setNodeRef}
      className={`term-column${isOver ? " drag-over" : ""}${dimmed ? " dimmed" : ""}`}
      aria-label={termLabel(period)}
    >
      <div className="term-top">
        <span className="term-marker">
          {period.term === "S1" ? "01" : "02"}
        </span>
        <div>
          <h3>
            {period.year} <span>{period.term}</span>
          </h3>
          <p>
            {termEntries.length} unit{termEntries.length === 1 ? "" : "s"} ·{" "}
            {points} points
          </p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => addHere(period)}
          aria-label={`Add unit to ${termLabel(period)}`}
        >
          <Plus size={17} />
        </button>
      </div>
      <div className="term-cards">
        {termEntries.map((entry) => (
          <UnitCard
            key={entry.unit}
            entry={entry}
            issues={issues.filter(
              (issue) =>
                issue.unit === entry.unit &&
                issue.period &&
                periodOrdinal(issue.period) === periodOrdinal(entry.period),
            )}
            periods={periods}
            move={move}
            remove={remove}
            changeStatus={changeStatus}
            openUnit={openUnit}
          />
        ))}
        {termEntries.length === 0 && (
          <div className="empty-term">
            <Plus size={19} />
            <span>
              Drop a unit here
              <br />
              or add from the library
            </span>
          </div>
        )}
      </div>
      {issues.some(
        (issue) =>
          issue.code === "TERM_OVERLOAD" &&
          issue.period &&
          periodOrdinal(issue.period) === periodOrdinal(period),
      ) && <p className="term-warning">! Above your term limit</p>}
    </section>
  );
}

export function PlanPage({
  openUnit,
  notify,
}: {
  openUnit: (code: string) => void;
  notify: (message: string) => void;
}) {
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const undo = usePlanStore((state) => state.undo);
  const previousPlan = usePlanStore((state) => state.previousPlan);
  const [search, setSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedOrdinal, setSelectedOrdinal] = useState(
    periodOrdinal(plan.startPeriod),
  );
  const [dragged, setDragged] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScheduleResult | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const issues = validatePlan(plan, catalog);
  const start = periodOrdinal(plan.startPeriod);
  const maxUsed = Math.max(
    start + 5,
    ...plan.entries.map((entry) => periodOrdinal(entry.period)),
  );
  const periods = Array.from(
    { length: Math.min(16, maxUsed - start + 1) },
    (_, index) => periodFromOrdinal(start + index),
  );
  const selectedPeriod = periodFromOrdinal(
    selectedOrdinal >= start && selectedOrdinal <= maxUsed
      ? selectedOrdinal
      : start,
  );
  const units = useMemo(
    () =>
      Object.values(catalog.units).sort((a, b) => a.code.localeCompare(b.code)),
    [],
  );
  const visibleUnits = units.filter((unit) => {
    if (
      !`${unit.code} ${unit.title}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (!onlyAvailable) return true;
    return (
      unit.offerings !== "TODO" &&
      unit.offerings.includes(selectedPeriod.term) &&
      evaluateRequisites(unit, selectedPeriod, plan, catalog).ok
    );
  });
  const add = (code: string, period: Period) => {
    if (plan.entries.some((entry) => entry.unit === code)) {
      notify(`${code} is already on the plan.`);
      return;
    }
    updatePlan((current) => ({
      ...current,
      entries: [...current.entries, { unit: code, period, status: "planned" }],
    }));
  };
  const move = (code: string, period: Period) =>
    updatePlan((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.unit === code ? { ...entry, period } : entry,
      ),
    }));
  const remove = (code: string) =>
    updatePlan((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.unit !== code),
    }));
  const changeStatus = (
    code: string,
    status: Plan["entries"][number]["status"],
  ) =>
    updatePlan((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.unit === code ? { ...entry, status } : entry,
      ),
    }));
  const onDragStart = (event: DragStartEvent) =>
    setDragged(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    if (event.over && String(event.over.id).startsWith("term-"))
      move(
        String(event.active.id),
        periodFromOrdinal(Number(String(event.over.id).slice(5))),
      );
  };
  const suggest = () => {
    const today = new Date();
    const currentPeriod: Period = {
      year: today.getFullYear(),
      term: today.getMonth() < 6 ? "S1" : "S2",
    };
    setPreview(autoSchedule(plan, catalog, { currentPeriod }));
  };
  const applySuggestion = () => {
    if (!preview) return;
    updatePlan((current) => ({
      ...current,
      entries: [
        ...current.entries.filter((entry) => entry.status !== "planned"),
        ...preview.entries,
      ],
    }));
    setPreview(null);
    notify("Scheduling suggestion applied. You can undo once.");
  };
  const confirmedErrors = issues.filter(
    (issue) => issue.level === "error",
  ).length;
  const unverified = issues.filter((issue) => issue.level === "info").length;
  return (
    <div className="page plan-page">
      <div className="page-heading plan-heading">
        <div>
          <span className="eyebrow">YOUR DEGREE, AT A GLANCE</span>
          <h1>Term planner</h1>
          <p>
            Build a path across semesters. Move any unit freely; confirmed
            problems appear on its card.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            type="button"
            onClick={undo}
            disabled={!previousPlan}
          >
            <RotateCcw size={16} /> Undo
          </button>
          <button className="button primary" type="button" onClick={suggest}>
            <Sparkles size={17} /> Auto schedule
          </button>
        </div>
      </div>
      <div className="metrics-strip">
        <div>
          <strong>{plan.entries.length}</strong>
          <span>Units on plan</span>
        </div>
        <div>
          <strong>{confirmedErrors}</strong>
          <span>Confirmed errors</span>
        </div>
        <div>
          <strong>{unverified}</strong>
          <span>Data notices</span>
        </div>
        <div>
          <strong>{plan.maxUnitsPerTerm}</strong>
          <span>Units per term limit</span>
        </div>
      </div>
      <div className="plan-layout">
        <div className="board-region">
          <div className="board-intro">
            <div>
              <h2>Semester board</h2>
              <p>
                Drag cards between terms, or use each card's “Move to” menu.
              </p>
            </div>
            <span className="legend">
              <span className="legend-dot completed" /> Completed{" "}
              <span className="legend-dot enrolled" /> Enrolled{" "}
              <span className="legend-dot planned" /> Planned
            </span>
          </div>
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragged(null)}
          >
            <div className="term-board">
              {periods.map((period) => (
                <TermColumn
                  key={periodOrdinal(period)}
                  period={period}
                  entries={plan.entries}
                  issues={issues}
                  periods={periods}
                  dimmed={
                    !!dragged &&
                    catalog.units[dragged]?.offerings !== "TODO" &&
                    !catalog.units[dragged]?.offerings.includes(period.term)
                  }
                  move={move}
                  remove={remove}
                  changeStatus={changeStatus}
                  openUnit={openUnit}
                  addHere={(value) => {
                    setSelectedOrdinal(periodOrdinal(value));
                    document
                      .getElementById("unit-library")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              ))}
            </div>
          </DndContext>
          <div className="board-note">
            <Info size={17} />
            <span>
              Offering periods and requisites remain unverified. A lack of red
              errors does not confirm enrolment eligibility.
            </span>
          </div>
        </div>
        <aside id="unit-library" className="library panel">
          <div className="library-heading">
            <span className="section-kicker">UNIT LIBRARY</span>
            <h2>Find a unit</h2>
            <p>Add one to the selected semester.</p>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code or title"
              aria-label="Search units"
            />
          </label>
          <label className="library-filter">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
            />{" "}
            Available this term
          </label>
          <label className="library-term">
            Add to
            <select
              value={
                selectedOrdinal >= start && selectedOrdinal <= maxUsed
                  ? selectedOrdinal
                  : start
              }
              onChange={(event) =>
                setSelectedOrdinal(Number(event.target.value))
              }
            >
              {periods.map((period) => (
                <option
                  key={periodOrdinal(period)}
                  value={periodOrdinal(period)}
                >
                  {termLabel(period)}
                </option>
              ))}
            </select>
          </label>
          <div className="library-list">
            {visibleUnits.length ? (
              visibleUnits.map((unit: Unit) => (
                <div className="library-unit" key={unit.code}>
                  <button type="button" onClick={() => openUnit(unit.code)}>
                    <strong>{unit.code}</strong>
                    <span>{unit.title}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => add(unit.code, selectedPeriod)}
                    aria-label={`Add ${unit.code} to ${termLabel(selectedPeriod)}`}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-library">
                No verified available units match this filter. Try showing all
                units.
              </p>
            )}
          </div>
          <p className="library-bottom">
            {units.length} units in the catalog · elective list pending
          </p>
        </aside>
      </div>
      {preview && (
        <div className="modal-backdrop" onMouseDown={() => setPreview(null)}>
          <section
            className="modal schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Auto schedule preview"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">AUTO SCHEDULE</span>
                <h2>Review the suggestion</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Current plan: {plan.entries.length} unit
              {plan.entries.length === 1 ? "" : "s"}. Suggested:{" "}
              {preview.entries.length} planned units and{" "}
              {preview.placeholders.length} unselected elective slots.
            </p>
            <div className="preview-grid">
              <div>
                <h3>Suggested core units</h3>
                {preview.entries.length ? (
                  preview.entries.map((entry) => (
                    <p key={entry.unit}>
                      {entry.unit} <span>{termLabel(entry.period)}</span>
                    </p>
                  ))
                ) : (
                  <p className="muted">
                    None can be safely placed with the current data.
                  </p>
                )}
              </div>
              <div>
                <h3>Needs attention</h3>
                {preview.unscheduled.length ? (
                  preview.unscheduled.map((item) => (
                    <p key={item.unit}>
                      <strong>{item.unit}</strong> — {item.reason}
                    </p>
                  ))
                ) : (
                  <p>All required units were placed.</p>
                )}
              </div>
            </div>
            <div className="warning-box">
              <CalendarClock size={18} />
              <span>
                Suggestions are heuristic. Unknown Handbook rules are never
                treated as satisfied; elective placeholders are not unit
                enrolments.
              </span>
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setPreview(null)}
              >
                Keep current plan
              </button>
              <button
                className="button primary"
                type="button"
                onClick={applySuggestion}
                disabled={!preview.entries.length}
              >
                Apply suggestion
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
