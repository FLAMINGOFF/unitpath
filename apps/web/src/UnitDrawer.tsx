import { useEffect } from "react";
import { ExternalLink, ShieldAlert, X } from "lucide-react";
import { evaluateRequisites, type EvalNode } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";

function ConditionTree({ node }: { node: EvalNode }) {
  return (
    <li
      className={
        node.unknown
          ? "condition unknown"
          : node.ok
            ? "condition met"
            : "condition unmet"
      }
    >
      <span aria-hidden="true">{node.unknown ? "?" : node.ok ? "✓" : "✕"}</span>
      <span>{node.message}</span>
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
  const unit = catalog.units[code];
  const entry = plan.entries.find((item) => item.unit === code);
  const period = entry?.period ?? plan.startPeriod;
  const report = unit ? evaluateRequisites(unit, period, plan, catalog) : null;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [close]);
  if (!unit || !report) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${unit.code} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-top">
          <span className="eyebrow">UNIT DETAILS</span>
          <button
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>
        <div className="unit-heading">
          <span className="unit-code-large">{unit.code}</span>
          <h2>{unit.title}</h2>
          <p>
            {unit.creditPoints} credit points ·{" "}
            {unit.offerings === "TODO"
              ? "Offering periods unverified"
              : unit.offerings.join(" / ")}
          </p>
        </div>
        {!unit.verified && (
          <div className="warning-box">
            <ShieldAlert size={19} />
            <span>
              This unit's requirements are not verified. Confirm every enrolment
              decision in the official Handbook.
            </span>
          </div>
        )}
        <div className="drawer-section">
          <h3>
            Eligibility for {period.year} {period.term}
          </h3>
          <p className="muted">
            Planned and enrolled units are assumed to pass in later terms.
          </p>
          <h4>Prerequisites</h4>
          <ul className="condition-tree">
            <ConditionTree node={report.prerequisite} />
          </ul>
          <h4>Corequisites</h4>
          <ul className="condition-tree">
            <ConditionTree node={report.corequisite} />
          </ul>
          <h4>Prohibitions</h4>
          <ul className="condition-tree">
            <ConditionTree node={report.prohibition} />
          </ul>
        </div>
        <div className="drawer-section">
          <h3>Replacement</h3>
          <p>
            {unit.replacedBy === "TODO"
              ? "Not yet verified"
              : (unit.replacedBy ?? "No replacement recorded")}
          </p>
        </div>
        <a
          className="button primary full-width"
          href={unit.source}
          target="_blank"
          rel="noreferrer"
        >
          Open official Handbook page <ExternalLink size={16} />
        </a>
      </aside>
    </div>
  );
}
