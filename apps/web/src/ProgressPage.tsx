import { useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, Info } from "lucide-react";
import { checkProgress, type RuleProgress } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { Note, PageHead } from "./ui";

const names: Record<string, string> = {
  total: "Degree credit points",
  "level1-cap": "Level 1 credit cap",
  "level3-min": "Level 3 minimum",
  core: "Core units",
  "studio-or-ibl": "Studio or IBL pathway",
};

const unitRules = new Set(["core", "studio-or-ibl"]);

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
  const name = names[rule.id] ?? rule.id;
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
            {unitRules.has(rule.id) ? " units" : " cp"}
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
    totalRule && "totalCredits" in totalRule ? totalRule.totalCredits : 144;
  const cells = Math.ceil(target / 6);
  const earned = Math.min(cells, Math.floor(report.actualCredits / 6));
  const planned = Math.min(
    cells - earned,
    Math.floor((report.projectedCredits - report.actualCredits) / 6),
  );
  const major = course?.majors.find((item) => item.id === plan.course.majorId);
  const pathwayRule = major?.rules.find((rule) => "oneOf" in rule);

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
              <i className="cell" aria-hidden="true" /> Remaining · one block =
              6 cp
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

      {pathwayRule && "oneOf" in pathwayRule && (
        <section className="pathways" aria-labelledby="pathway-heading">
          <div>
            <h2 id="pathway-heading">Which final-year pathway?</h2>
            <p>
              Guides the progress detail above and auto scheduling. Industry
              Based Learning needs separate acceptance by the faculty.
            </p>
          </div>
          <div className="pathway-options">
            {pathwayRule.oneOf.map((branch) => {
              const checked =
                (plan.selectedPathway ?? pathwayRule.oneOf[0]?.label) ===
                branch.label;
              return (
                <label
                  key={branch.label}
                  className={`pathway${checked ? " on" : ""}`}
                >
                  <input
                    type="radio"
                    name="pathway"
                    checked={checked}
                    onChange={() =>
                      updatePlan((current) => ({
                        ...current,
                        selectedPathway: branch.label,
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
      )}

      <div className="notes">
        <Note tone="warn" icon={<Info size={15} />}>
          Level 1 points above the cap are left out of the counted total.
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
