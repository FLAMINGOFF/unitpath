import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  GripVertical,
  Info,
  MoreHorizontal,
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
  offeredAt,
  periodFromOrdinal,
  periodOrdinal,
  validatePlan,
  type Issue,
  type Period,
  type Plan,
  type ScheduleResult,
} from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import {
  compareCodes,
  Flag,
  Note,
  PageHead,
  shortTerm,
  StatusMark,
  termLabel,
  type EntryStatus,
} from "./ui";

type Entry = Plan["entries"][number];

type CardActions = {
  move: (code: string, period: Period) => void;
  remove: (code: string) => void;
  changeStatus: (code: string, status: EntryStatus) => void;
  openUnit: (code: string) => void;
};

function UnitCard({
  entry,
  issues,
  periods,
  actions,
}: {
  entry: Entry;
  issues: Issue[];
  periods: Period[];
  actions: CardActions;
}) {
  const unit = catalog.units[entry.unit];
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entry.unit });
  const firstError = issues.find((issue) => issue.level === "error");
  const firstWarning = issues.find((issue) => issue.level === "warning");
  const tone = firstError ? " has-error" : firstWarning ? " has-warning" : "";
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`card ${entry.status}${tone}${isDragging ? " dragging" : ""}`}
    >
      <div className="card-top">
        <button
          className="grip"
          type="button"
          aria-label={`Drag ${entry.unit}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <button
          className="card-code"
          type="button"
          onClick={() => actions.openUnit(entry.unit)}
        >
          {entry.unit}
        </button>
        <span className="card-meta">{unit?.creditPoints ?? "?"}cp</span>
      </div>
      <button
        className="card-title"
        type="button"
        onClick={() => actions.openUnit(entry.unit)}
      >
        {unit?.title ?? "Unknown unit"}
      </button>
      <div className="card-foot">
        <StatusMark status={entry.status} />
        {firstError ? (
          <Flag tone="error">Error</Flag>
        ) : firstWarning ? (
          <Flag tone="warning">Warning</Flag>
        ) : null}
        <details className="card-menu">
          <summary aria-label={`Edit ${entry.unit}`}>
            <MoreHorizontal size={16} />
          </summary>
          <div className="card-menu-body">
            <label className="field compact">
              <span>Status</span>
              <select
                value={entry.status}
                onChange={(event) =>
                  actions.changeStatus(
                    entry.unit,
                    event.target.value as EntryStatus,
                  )
                }
              >
                <option value="planned">Planned</option>
                <option value="enrolled">Enrolled</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="field compact">
              <span>Move to</span>
              <select
                value={periodOrdinal(entry.period)}
                onChange={(event) =>
                  actions.move(
                    entry.unit,
                    periodFromOrdinal(Number(event.target.value)),
                  )
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
            <button
              type="button"
              className="button danger-ghost small"
              onClick={() => actions.remove(entry.unit)}
            >
              <Trash2 size={14} /> Remove {entry.unit}
            </button>
          </div>
        </details>
      </div>
      {(firstError ?? firstWarning) && (
        <p className={`card-issue ${firstError ? "error" : "warning"}`}>
          {(firstError ?? firstWarning)!.message}
        </p>
      )}
    </article>
  );
}

function TermColumn({
  period,
  position,
  entries,
  issues,
  periods,
  dimmed,
  selected,
  maxUnits,
  actions,
  addHere,
}: {
  period: Period;
  position: number;
  entries: Entry[];
  issues: Issue[];
  periods: Period[];
  dimmed: boolean;
  selected: boolean;
  maxUnits: number;
  actions: CardActions;
  addHere: (period: Period) => void;
}) {
  const ordinal = periodOrdinal(period);
  const { isOver, setNodeRef } = useDroppable({ id: `term-${ordinal}` });
  const termEntries = entries
    .filter((entry) => periodOrdinal(entry.period) === ordinal)
    .sort((a, b) => compareCodes(a.unit, b.unit));
  const points = termEntries.reduce(
    (sum, entry) => sum + (catalog.units[entry.unit]?.creditPoints ?? 0),
    0,
  );
  const overloaded = issues.some(
    (issue) =>
      issue.code === "TERM_OVERLOAD" &&
      issue.period &&
      periodOrdinal(issue.period) === ordinal,
  );
  const allDone =
    termEntries.length > 0 &&
    termEntries.every((entry) => entry.status === "completed");
  const year = Math.floor(position / 2) + 1;
  return (
    <section
      ref={setNodeRef}
      className={`term${isOver ? " over" : ""}${dimmed ? " dimmed" : ""}${selected ? " selected" : ""}`}
      aria-label={termLabel(period)}
    >
      <header className="term-head">
        <span
          className={`station${allDone ? " done" : termEntries.length ? " busy" : ""}`}
          aria-hidden="true"
        />
        <div className="term-name">
          <span className="term-year">
            Year {year} <em>· {period.term}</em>
          </span>
          <span className="mono-label">{shortTerm(period)}</span>
        </div>
        <div className="term-load">
          <span className={overloaded ? "over-limit" : ""}>
            {termEntries.length}/{maxUnits}
          </span>
          <span className="mono-label">{points} cp</span>
        </div>
      </header>
      <div className="term-body">
        {termEntries.map((entry) => (
          <UnitCard
            key={entry.unit}
            entry={entry}
            issues={issues.filter(
              (issue) =>
                issue.unit === entry.unit &&
                issue.period &&
                periodOrdinal(issue.period) === ordinal,
            )}
            periods={periods}
            actions={actions}
          />
        ))}
        {termEntries.length < maxUnits && (
          <button
            type="button"
            className="slot"
            onClick={() => addHere(period)}
            aria-label={`Add unit to ${termLabel(period)}`}
          >
            <Plus size={15} aria-hidden="true" />
            <span>{termEntries.length ? "Add unit" : "Empty term"}</span>
          </button>
        )}
      </div>
      {overloaded && (
        <p className="term-warning">
          <Flag tone="warning">Above your {maxUnits}-unit limit</Flag>
        </p>
      )}
    </section>
  );
}

function SchedulePreview({
  plan,
  preview,
  close,
  apply,
}: {
  plan: Plan;
  preview: ScheduleResult;
  close: () => void;
  apply: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [close]);
  const ordinals = [
    ...new Set(
      [...preview.entries, ...preview.placeholders].map((item) =>
        periodOrdinal(item.period),
      ),
    ),
  ].sort((a, b) => a - b);
  const kept = plan.entries.filter((entry) => entry.status !== "planned");
  const dropped = plan.entries.length - kept.length;
  return (
    <div className="scrim" onMouseDown={close}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Auto schedule preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <p className="kicker">
              <span>⟶</span>Auto schedule
            </p>
            <h2>Here’s a suggested route.</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </header>
        <dl className="dialog-stats">
          <div>
            <dt>Kept as is</dt>
            <dd>{kept.length}</dd>
          </div>
          <div>
            <dt>Replaced</dt>
            <dd>{dropped}</dd>
          </div>
          <div>
            <dt>New core units</dt>
            <dd>{preview.entries.length}</dd>
          </div>
          <div>
            <dt>Elective slots</dt>
            <dd>{preview.placeholders.length}</dd>
          </div>
          <div>
            <dt>Graduates</dt>
            <dd>
              {preview.expectedGraduation
                ? shortTerm(preview.expectedGraduation)
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="dialog-grid">
          <div>
            <h3>Suggested terms</h3>
            {preview.entries.length ? (
              <ol className="preview-terms">
                {ordinals.map((ordinal) => {
                  const period = periodFromOrdinal(ordinal);
                  const units = preview.entries.filter(
                    (entry) => periodOrdinal(entry.period) === ordinal,
                  );
                  const slots = preview.placeholders.filter(
                    (slot) => periodOrdinal(slot.period) === ordinal,
                  );
                  return (
                    <li key={ordinal}>
                      <span className="mono-label">{shortTerm(period)}</span>
                      <div className="chips">
                        {units.map((entry) => (
                          <span className="chip" key={entry.unit}>
                            {entry.unit}
                          </span>
                        ))}
                        {slots.map((slot, index) => (
                          <span className="chip elective" key={index}>
                            {slot.level === undefined
                              ? "Elective"
                              : `Elective L${slot.level}`}{" "}
                            · {slot.points} cp
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="muted">
                No core unit can be placed safely with the current data.
              </p>
            )}
          </div>
          <div>
            <h3>Needs attention</h3>
            {preview.unscheduled.length ? (
              <ul className="attention">
                {preview.unscheduled.map((item) => (
                  <li key={item.unit}>
                    <span className="code">{item.unit}</span>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Every required unit found a term.</p>
            )}
          </div>
        </div>
        <Note icon={<Info size={15} />}>
          This is a heuristic, not an optimal timetable. Unknown Handbook rules
          are never treated as met, and elective slots are reminders, not
          enrolments.
        </Note>
        <footer className="dialog-foot">
          <button className="button ghost" type="button" onClick={close}>
            Keep current plan
          </button>
          <button
            className="button primary"
            type="button"
            onClick={apply}
            disabled={!preview.entries.length}
          >
            Apply suggestion
          </button>
        </footer>
      </section>
    </div>
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
  const searchRef = useRef<HTMLInputElement>(null);
  const closePreview = useCallback(() => setPreview(null), []);
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
  const activeOrdinal =
    selectedOrdinal >= start && selectedOrdinal <= maxUsed
      ? selectedOrdinal
      : start;
  const selectedPeriod = periodFromOrdinal(activeOrdinal);
  const units = useMemo(
    () =>
      Object.values(catalog.units).sort((a, b) => compareCodes(a.code, b.code)),
    [],
  );
  const onPlan = new Set(plan.entries.map((entry) => entry.unit));
  const visibleUnits = units.filter((unit) => {
    if (
      !`${unit.code} ${unit.title}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (!onlyAvailable) return true;
    return (
      offeredAt(unit, selectedPeriod, plan.campus) === true &&
      evaluateRequisites(unit, selectedPeriod, plan, catalog).ok
    );
  });
  const add = (code: string, period: Period) => {
    if (onPlan.has(code)) {
      notify(`${code} is already on the plan.`);
      return;
    }
    updatePlan((current) => ({
      ...current,
      entries: [...current.entries, { unit: code, period, status: "planned" }],
    }));
  };
  const actions: CardActions = {
    openUnit,
    move: (code, period) =>
      updatePlan((current) => ({
        ...current,
        entries: current.entries.map((entry) =>
          entry.unit === code ? { ...entry, period } : entry,
        ),
      })),
    remove: (code) =>
      updatePlan((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.unit !== code),
      })),
    changeStatus: (code, status) =>
      updatePlan((current) => ({
        ...current,
        entries: current.entries.map((entry) =>
          entry.unit === code ? { ...entry, status } : entry,
        ),
      })),
  };
  const onDragStart = (event: DragStartEvent) =>
    setDragged(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    if (event.over && String(event.over.id).startsWith("term-"))
      actions.move(
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
    notify("Suggestion applied. Use Undo to go back one step.");
  };
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  const selectedCourse = catalog.courses.find(
    (course) =>
      course.code === plan.course.code &&
      course.version === plan.course.version,
  );
  const totalRule = selectedCourse?.rules.find(
    (rule) => "totalCredits" in rule,
  );
  const targetCredits =
    totalRule && "totalCredits" in totalRule ? totalRule.totalCredits : null;
  const plannedPoints = plan.entries.reduce(
    (sum, entry) => sum + (catalog.units[entry.unit]?.creditPoints ?? 0),
    0,
  );
  const draggedUnit = dragged ? catalog.units[dragged] : undefined;

  return (
    <div className="page planner">
      <PageHead
        index="02"
        kicker="Planner"
        title={
          <>
            Your route, <em>term by term.</em>
          </>
        }
        lede="Drag units between terms, or open a card's menu to move it. Problems show up on the card straight away."
        actions={
          <>
            <button
              className="button ghost"
              type="button"
              onClick={undo}
              disabled={!previousPlan}
            >
              <RotateCcw size={15} /> Undo
            </button>
            <button className="button primary" type="button" onClick={suggest}>
              <Sparkles size={15} /> Auto schedule
            </button>
          </>
        }
      />

      <dl className="ledger-strip">
        <div>
          <dt>On plan</dt>
          <dd>
            {plan.entries.length}
            <small> units</small>
          </dd>
        </div>
        <div>
          <dt>Credit points</dt>
          <dd>
            {plannedPoints}
            <small> / {targetCredits ?? "—"}</small>
          </dd>
        </div>
        <div className={errors ? "bad" : ""}>
          <dt>Errors</dt>
          <dd>{errors}</dd>
        </div>
        <div className={warnings ? "warn" : ""}>
          <dt>Warnings</dt>
          <dd>{warnings}</dd>
        </div>
        <div>
          <dt>Term limit</dt>
          <dd>
            {plan.maxUnitsPerTerm}
            <small> units</small>
          </dd>
        </div>
      </dl>

      <div className="planner-layout">
        <div className="board-wrap">
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragged(null)}
          >
            <div
              className="board"
              style={{ ["--terms" as string]: periods.length }}
            >
              {periods.map((period, position) => (
                <TermColumn
                  key={periodOrdinal(period)}
                  period={period}
                  position={position}
                  entries={plan.entries}
                  issues={issues}
                  periods={periods}
                  maxUnits={plan.maxUnitsPerTerm}
                  selected={periodOrdinal(period) === activeOrdinal}
                  dimmed={
                    !!draggedUnit &&
                    offeredAt(draggedUnit, period, plan.campus) === false
                  }
                  actions={actions}
                  addHere={(value) => {
                    setSelectedOrdinal(periodOrdinal(value));
                    searchRef.current?.focus();
                    document.getElementById("catalogue")?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  }}
                />
              ))}
            </div>
          </DndContext>
          <div className="legend" aria-label="Legend">
            <StatusMark status="completed" />
            <StatusMark status="enrolled" />
            <StatusMark status="planned" />
            <Flag tone="error">Rule broken</Flag>
            <Flag tone="warning">Check this</Flag>
          </div>
        </div>

        <aside id="catalogue" className="catalogue" aria-label="Unit catalogue">
          <header>
            <p className="kicker">
              <span>§</span>Catalogue
            </p>
            <h2>Add a unit</h2>
          </header>
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search code or title"
              aria-label="Search units"
            />
          </label>
          <div className="catalogue-controls">
            <label className="field compact">
              <span>Add to</span>
              <select
                value={activeOrdinal}
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
            <label className="toggle">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
              />
              <span>Only units I can take then</span>
            </label>
          </div>
          <ul className="catalogue-list">
            {visibleUnits.map((unit) => (
              <li
                key={unit.code}
                className={onPlan.has(unit.code) ? "taken" : ""}
              >
                <button
                  type="button"
                  className="catalogue-unit"
                  onClick={() => openUnit(unit.code)}
                >
                  <span className="code">{unit.code}</span>
                  <span>{unit.title}</span>
                </button>
                {onPlan.has(unit.code) ? (
                  <span className="mono-label">On plan</span>
                ) : (
                  <button
                    type="button"
                    className="icon-button add"
                    onClick={() => add(unit.code, selectedPeriod)}
                    aria-label={`Add ${unit.code} to ${termLabel(selectedPeriod)}`}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </li>
            ))}
            {visibleUnits.length === 0 && (
              <li className="empty">
                {onlyAvailable
                  ? "Nothing is confirmed available yet — offerings and requisites are still unverified."
                  : "No unit matches that search."}
              </li>
            )}
          </ul>
          <p className="catalogue-foot mono-label">
            {units.length} units · elective list coming
          </p>
        </aside>
      </div>

      {preview && (
        <SchedulePreview
          plan={plan}
          preview={preview}
          close={closePreview}
          apply={applySuggestion}
        />
      )}
    </div>
  );
}
