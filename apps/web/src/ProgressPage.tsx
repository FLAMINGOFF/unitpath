import { useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, Info } from "lucide-react";
import {
  checkProgress,
  courseAndComponents,
  type RuleProgress,
} from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { Note, PageHead } from "./ui";

function ruleName(id: string): string {
  return id
    .split(/[/:_-]+/)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function RuleLine({
  rule,
  openUnit,
}: {
  rule: RuleProgress;
  openUnit: (code: string) => void;
}) {
  const percent = Math.min(
    100,
    Math.round((rule.current / Math.max(rule.target, 1)) * 100),
  );
  const name = ruleName(rule.id);
  const statusText =
    rule.status === "met"
      ? "Met"
      : rule.status === "partial"
        ? "In progress"
        : "Not met";
  return (
    <li className={`rule ${rule.status}`}>
      <div className="rule-head">
        <span className={`rule-status ${rule.status}`}>
          {rule.status === "met" ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <CircleDashed size={14} aria-hidden="true" />
          )}
          {statusText}
        </span>
        <h3>{name}</h3>
        <span className="leader" aria-hidden="true" />
        <span className="rule-figure">
          {rule.current}
          <small>
            {" "}
            / {rule.target}
            {rule.missingUnits ? " units" : " cp"}
          </small>
        </span>
      </div>
      <div
        className="meter"
        role="progressbar"
        aria-valuenow={Math.min(rule.current, rule.target)}
        aria-valuemin={0}
        aria-valuemax={rule.target}
        aria-label={name}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="rule-message">{rule.message}</p>
      {rule.missingUnits && rule.missingUnits.length > 0 && (
        <div className="chips">
          <span className="mono-label">Still needed</span>
          {rule.missingUnits.map((code) => (
            <button
              type="button"
              className="chip"
              key={code}
              onClick={() => openUnit(code)}
            >
              {code}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function ProgressPage({
  openUnit,
}: {
  openUnit: (code: string) => void;
}) {
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const [projected, setProjected] = useState(false);
  const report = checkProgress(plan, catalog);
  const rules = projected ? report.projected : report.actual;
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  const totalRule = course?.rules.find((rule) => "totalCredits" in rule);
  const target =
    totalRule && "totalCredits" in totalRule ? totalRule.totalCredits : 0;
  const cells = target > 0 ? 24 : 0;
  const earned =
    target > 0
      ? Math.min(cells, Math.floor((report.actualCredits / target) * cells))
      : 0;
  const projectedCells =
    target > 0
      ? Math.min(cells, Math.floor((report.projectedCredits / target) * cells))
      : 0;
  const planned = projectedCells - earned;
  const { scopedRules } = courseAndComponents(plan, catalog);
  const selectedRules = scopedRules.map((entry) => entry.rule);
  const pathwayRules = scopedRules.flatMap(({ id, rule }) =>
    "oneOf" in rule ? [{ id, rule }] : [],
  );
  const hasLevelCaps = selectedRules.some(
    (rule) => "maxCreditsAtLevel" in rule,
  );

  return (
    <div className="page progress">
      <PageHead
        index="03"
        kicker="Progress"
        title={
          <>
            How far along <em>the path</em> you are.
          </>
        }
        lede="Every requirement from the course map, measured against the units you've recorded."
      />

      <section className="scoreboard" aria-label="Credit point summary">
        <div className="score">
          <span className="mono-label">Credit points counted</span>
          <p className="score-figure">
            <span>{report.actualCredits}</span>
            <small>/ {target}</small>
          </p>
          <p className="score-sub">
            {report.projectedCredits > report.actualCredits
              ? `${report.projectedCredits} once your planned units pass.`
              : "Add planned units on the planner to see a forecast."}
          </p>
        </div>
        <div className="cells-wrap">
          <div
            className="cells"
            role="img"
            aria-label={`${earned} of ${cells} unit-sized blocks earned, ${planned} planned`}
          >
            {Array.from({ length: cells }, (_, index) => (
              <span
                key={index}
                className={
                  index < earned
                    ? "cell earned"
                    : index < earned + planned
                      ? "cell planned"
                      : "cell"
                }
              />
            ))}
          </div>
          <div className="cells-legend">
            <span>
              <i className="cell earned" aria-hidden="true" /> Completed &
              enrolled
            </span>
            <span>
              <i className="cell planned" aria-hidden="true" /> Planned
            </span>
            <span>
              <i className="cell" aria-hidden="true" /> Remaining · each block
              represents an equal share of the target
            </span>
          </div>
        </div>
      </section>

      <div className="section-bar">
        <h2>Requirements</h2>
        <div className="segmented" role="group" aria-label="Progress view">
          <button
            type="button"
            aria-pressed={!projected}
            onClick={() => setProjected(false)}
          >
            Completed & enrolled
          </button>
          <button
            type="button"
            aria-pressed={projected}
            onClick={() => setProjected(true)}
          >
            Including planned
          </button>
        </div>
      </div>
      <ol className="rules">
        {rules.map((rule) => (
          <RuleLine key={rule.id} rule={rule} openUnit={openUnit} />
        ))}
      </ol>

      {pathwayRules.map(({ id, rule }) => (
        <section
          className="pathways"
          aria-labelledby={"pathway-" + id}
          key={id}
        >
          <div>
            <h2 id={"pathway-" + id}>{ruleName(id)} pathway</h2>
            <p>
              Guides progress and auto scheduling. Check the official course
              rules before making a selection.
            </p>
          </div>
          <div className="pathway-options">
            {rule.oneOf.map((branch) => {
              const checked =
                (plan.selectedPathways[id] ??
                  plan.selectedPathway ??
                  rule.oneOf[0]?.label) === branch.label;
              return (
                <label
                  key={branch.label}
                  className={checked ? "pathway on" : "pathway"}
                >
                  <input
                    type="radio"
                    name={"pathway-" + id}
                    checked={checked}
                    onChange={() =>
                      updatePlan((current) => ({
                        ...current,
                        selectedPathway: undefined,
                        selectedPathways: {
                          ...current.selectedPathways,
                          [id]: branch.label,
                        },
                      }))
                    }
                  />
                  <span className="pathway-text">
                    <strong>{branch.label}</strong>
                    <span className="mono-label">
                      {branch.requiredUnits.join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="notes">
        {hasLevelCaps && (
          <Note tone="warn" icon={<Info size={15} />}>
            Credit points above a level cap do not count toward the course
            total.
          </Note>
        )}
        <Note icon={<Info size={15} />}>
          Advanced standing counts at the level you recorded.
        </Note>
        {course && (
          <Note icon={<ExternalLink size={15} />}>
            Rules come from the{" "}
            <a href={course.source} target="_blank" rel="noreferrer">
              official {course.version} course map
            </a>
            . Check it, and each unit's Handbook page, before enrolling.
          </Note>
        )}
      </div>
    </div>
  );
}
