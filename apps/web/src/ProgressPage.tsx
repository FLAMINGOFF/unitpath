import { useState } from "react";
import {
  BookOpenCheck,
  CircleHelp,
  GraduationCap,
  ShieldAlert,
} from "lucide-react";
import { checkProgress, type RuleProgress } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";

const names: Record<string, string> = {
  total: "Degree credit points",
  "level1-cap": "Level 1 credit cap",
  "level3-min": "Level 3 minimum",
  core: "Core units",
  "studio-or-ibl": "Industry pathway",
};

function RuleRow({
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
  const cap = rule.id === "level1-cap";
  return (
    <div className="rule-row">
      <div className="rule-row-top">
        <div>
          <span className={`rule-status ${rule.status}`}>
            {rule.status === "met"
              ? "✓ Met"
              : rule.status === "partial"
                ? "◐ In progress"
                : "○ Not met"}
          </span>
          <h3>{names[rule.id] ?? rule.id}</h3>
        </div>
        <strong>
          {rule.current}{" "}
          <span>
            / {rule.target}
            {rule.id === "core" || rule.id === "studio-or-ibl"
              ? " units"
              : " pts"}
          </span>
        </strong>
      </div>
      <div
        className={`progress-track ${rule.status}`}
        role="progressbar"
        aria-valuenow={Math.min(rule.current, rule.target)}
        aria-valuemin={0}
        aria-valuemax={rule.target}
        aria-label={names[rule.id] ?? rule.id}
      >
        <div style={{ width: `${cap ? Math.min(100, percent) : percent}%` }} />
      </div>
      <p>{rule.message}</p>
      {rule.missingUnits && rule.missingUnits.length > 0 && (
        <div className="missing-units">
          {rule.missingUnits.map((code) => (
            <button type="button" key={code} onClick={() => openUnit(code)}>
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const credits = projected ? report.projectedCredits : report.actualCredits;
  const pathwayRule = catalog.courses[0]?.majors[0]?.rules.find(
    (rule) => "oneOf" in rule,
  );
  return (
    <div className="page progress-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DEGREE PROGRESS</span>
          <h1>See the whole picture.</h1>
          <p>Track your course requirements and the units still ahead.</p>
        </div>
        <div className="heading-illustration">
          <GraduationCap size={43} strokeWidth={1.4} />
        </div>
      </div>
      <div className="progress-summary">
        <div className="summary-icon">
          <BookOpenCheck size={27} />
        </div>
        <div>
          <span>Credit points counted</span>
          <strong>
            {credits} <small>/ 144</small>
          </strong>
          <p>
            {Math.round((credits / 144) * 100)}% of the degree credit target
          </p>
        </div>
        <div
          className="summary-chart"
          style={{
            background: `conic-gradient(#398e82 ${Math.min(100, (credits / 144) * 100)}%, #e5eae9 0)`,
          }}
        >
          <div>{Math.round((credits / 144) * 100)}%</div>
        </div>
      </div>
      <div className="content-toolbar">
        <div>
          <h2>Requirements</h2>
          <p>Each rule comes from the C2000 2026 course map.</p>
        </div>
        <div className="segmented" role="group" aria-label="Progress view">
          <button
            type="button"
            className={!projected ? "selected" : ""}
            onClick={() => setProjected(false)}
          >
            Completed & enrolled
          </button>
          <button
            type="button"
            className={projected ? "selected" : ""}
            onClick={() => setProjected(true)}
          >
            Including planned
          </button>
        </div>
      </div>
      <div className="rules-list">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} openUnit={openUnit} />
        ))}
      </div>
      {pathwayRule && "oneOf" in pathwayRule && (
        <section className="panel pathway-panel">
          <div>
            <span className="section-kicker">PATHWAY PREFERENCE</span>
            <h2>Choose your industry pathway</h2>
            <p>
              This guides progress detail and auto scheduling. The IBL program
              requires separate university acceptance.
            </p>
          </div>
          <div className="pathway-options">
            {pathwayRule.oneOf.map((branch) => (
              <label
                key={branch.label}
                className={
                  plan.selectedPathway === branch.label ? "selected" : ""
                }
              >
                <input
                  type="radio"
                  name="pathway"
                  checked={
                    (plan.selectedPathway ?? pathwayRule.oneOf[0]?.label) ===
                    branch.label
                  }
                  onChange={() =>
                    updatePlan((current) => ({
                      ...current,
                      selectedPathway: branch.label,
                    }))
                  }
                />
                <span>
                  <strong>{branch.label}</strong>
                  <small>{branch.requiredUnits.join(" · ")}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}
      <div className="warning-box">
        <ShieldAlert size={19} />
        <span>
          Progress uses the course map, but the 17 unit records are unverified.{" "}
          <a href={catalog.courses[0]?.source} target="_blank" rel="noreferrer">
            Check the official course map
          </a>{" "}
          and each unit's Handbook page before enrolling.
        </span>
      </div>
      <div className="inline-note">
        <CircleHelp size={17} />
        Level 1 points above 60 are excluded from the counted total. Advanced
        standing is included at its recorded level.
      </div>
    </div>
  );
}
