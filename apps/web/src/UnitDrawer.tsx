import { useEffect, useRef } from "react";
import { ExternalLink, HelpCircle, X } from "lucide-react";
import { evaluateRequisites, unitLevel, type EvalNode } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { Flag, Note, shortTerm, StatusMark } from "./ui";

function ConditionTree({ node }: { node: EvalNode }) {
  const state = node.unknown ? "unknown" : node.ok ? "met" : "unmet";
  const label = node.unknown ? "Unknown" : node.ok ? "Met" : "Not met";
  return (
    <li className={`cond ${state}`}>
      <span className="cond-mark" aria-label={label} role="img">
        {node.unknown ? "?" : node.ok ? "✓" : "✕"}
      </span>
      <span className="cond-text">{node.message}</span>
      {node.children && (
        <ul>
          {node.children.map((child, index) => (
            <ConditionTree key={index} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function UnitDrawer({
  code,
  close,
}: {
  code: string;
  close: () => void;
}) {
  const plan = usePlanStore((state) => state.plan);
  const closeRef = useRef<HTMLButtonElement>(null);
  const unit = catalog.units[code];
  const entry = plan.entries.find((item) => item.unit === code);
  const period = entry?.period ?? plan.startPeriod;
  const report = unit ? evaluateRequisites(unit, period, plan, catalog) : null;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus?.();
    };
  }, [close, code]);
  if (!unit || !report) return null;
  const sections = [
    ["Prerequisites", report.prerequisite, "Completed in an earlier term"],
    ["Corequisites", report.corequisite, "Earlier or in the same term"],
    ["Prohibitions", report.prohibition, "Cannot appear anywhere on the plan"],
  ] as const;
  return (
    <div className="scrim side" onMouseDown={close}>
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${unit.code} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <span className="sheet-code">{unit.code}</span>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </header>
        <h2 className="sheet-title">{unit.title}</h2>
        <dl className="facts compact">
          <div>
            <dt>Credit</dt>
            <dd>{unit.creditPoints} cp</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{unitLevel(unit)}</dd>
          </div>
          <div>
            <dt>Offered</dt>
            <dd>
              {unit.offerings === "TODO"
                ? "Unverified"
                : unit.offerings
                    .map((offering) => `${offering.term} · ${offering.campus}`)
                    .join(" / ")}
            </dd>
          </div>
          <div>
            <dt>On plan</dt>
            <dd>
              {entry ? (
                <>
                  {shortTerm(entry.period)} <StatusMark status={entry.status} />
                </>
              ) : (
                "Not yet"
              )}
            </dd>
          </div>
        </dl>
        {!unit.verified && (
          <Note tone="warn" icon={<HelpCircle size={15} />}>
            These rules have not been checked against the Handbook yet. Treat
            every “unknown” as “find out”, not “fine”.
          </Note>
        )}
        <section className="sheet-section">
          <h3>
            Can you take it in {shortTerm(period)}?{" "}
            {report.ok ? (
              <Flag tone="ok">Yes</Flag>
            ) : report.prerequisite.unknown ||
              report.corequisite.unknown ||
              report.prohibition.unknown ? (
              <Flag tone="unknown">Unknown</Flag>
            ) : (
              <Flag tone="error">Not yet</Flag>
            )}
          </h3>
          <p className="muted">
            Planned and enrolled units are assumed to pass before later terms.
          </p>
          {sections.map(([title, node, hint]) => (
            <div className="cond-group" key={title}>
              <h4>
                {title} <span className="mono-label">{hint}</span>
              </h4>
              <ul className="cond-tree">
                <ConditionTree node={node} />
              </ul>
            </div>
          ))}
        </section>
        <section className="sheet-section">
          <h3>Replacement</h3>
          <p>
            {unit.replacedBy === "TODO"
              ? "Not verified yet."
              : unit.replacedBy
                ? `Replaced by ${unit.replacedBy}. Either one satisfies this requirement.`
                : "No replacement recorded."}
          </p>
        </section>
        <a
          className="button primary wide"
          href={unit.source}
          target="_blank"
          rel="noreferrer"
        >
          Open the Handbook page <ExternalLink size={15} />
        </a>
      </aside>
    </div>
  );
}
