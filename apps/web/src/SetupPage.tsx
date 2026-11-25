import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Info, Plus, X } from "lucide-react";
import { unitLevel, type Plan } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { compareCodes, Note, PageHead } from "./ui";

export function SetupPage({ openUnit }: { openUnit: (code: string) => void }) {
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const navigate = useNavigate();
  const [label, setLabel] = useState("Advanced standing");
  const [level, setLevel] = useState<number>(1);
  const [points, setPoints] = useState(6);
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  const major = course?.majors.find((item) => item.id === plan.course.majorId);
  const units = Object.values(catalog.units).sort((a, b) =>
    compareCodes(a.code, b.code),
  );
  const unitLevels = [...new Set(units.map((unit) => unitLevel(unit)))].sort(
    (a, b) => a - b,
  );
  const creditLevels = [
    ...new Set([
      level,
      ...unitLevels,
      ...plan.creditBlocks.map((block) => block.level),
    ]),
  ].sort((a, b) => a - b);
  const complete = new Set(
    plan.entries
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.unit),
  );
  const completedPoints = units
    .filter((unit) => complete.has(unit.code))
    .reduce((sum, unit) => sum + unit.creditPoints, 0);
  const toggle = (code: string) =>
    updatePlan((current) => ({
      ...current,
      entries: complete.has(code)
        ? current.entries.filter((entry) => entry.unit !== code)
        : [
            ...current.entries.filter((entry) => entry.unit !== code),
            { unit: code, period: current.startPeriod, status: "completed" },
          ],
    }));
  const changeStart = (field: "year" | "term", value: number | "S1" | "S2") =>
    updatePlan(
      (current) =>
        ({
          ...current,
          startPeriod: { ...current.startPeriod, [field]: value },
        }) as Plan,
    );
  const validBlock = label.trim() !== "" && points > 0 && points % 6 === 0;
  const addBlock = () => {
    if (!validBlock) return;
    updatePlan((current) => ({
      ...current,
      creditBlocks: [
        ...current.creditBlocks,
        { label: label.trim(), level, points },
      ],
    }));
    setLabel("Advanced standing");
    setPoints(6);
  };

  return (
    <div className="page setup">
      <PageHead
        index="01"
        kicker="Setup"
        title={
          <>
            Tell us where you <em>are</em>, we’ll show what’s left.
          </>
        }
        lede="Four quick answers. Everything is saved in this browser as you go."
      />

      <ol className="questions">
        <li className="question">
          <div className="question-label">
            <span className="q-num">01</span>
            <h2>Which course?</h2>
          </div>
          <div className="question-body">
            <div className="course-ticket">
              <div>
                <span className="mono-label">
                  {plan.course.code} · {plan.course.version} Handbook
                </span>
                <strong>{course?.title}</strong>
                <span>{major?.title} major</span>
              </div>
              <span className="flag ok">
                <Check size={13} aria-hidden="true" /> Selected
              </span>
            </div>
            <p className="hint">
              <Info size={14} aria-hidden="true" /> This is the only course
              version in the catalogue so far.
            </p>
          </div>
        </li>

        <li className="question">
          <div className="question-label">
            <span className="q-num">02</span>
            <h2>When did you start?</h2>
          </div>
          <div className="question-body field-row">
            <label className="field">
              <span>Entry year</span>
              <select
                value={plan.startPeriod.year}
                onChange={(event) =>
                  changeStart("year", Number(event.target.value))
                }
              >
                {[2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>First teaching period</span>
              <select
                value={plan.startPeriod.term}
                onChange={(event) =>
                  changeStart("term", event.target.value as "S1" | "S2")
                }
              >
                <option value="S1">Semester 1</option>
                <option value="S2">Semester 2</option>
              </select>
            </label>
          </div>
        </li>

        <li className="question">
          <div className="question-label">
            <span className="q-num">03</span>
            <h2>What have you already passed?</h2>
            <p>
              Tick each unit you've completed. You can change its term and
              status later on the planner.
            </p>
            <p className="tally">
              <strong>{complete.size}</strong> units ·{" "}
              <strong>{completedPoints}</strong> credit points
            </p>
          </div>
          <div className="question-body">
            {unitLevels.map((year) => (
              <fieldset className="unit-picker" key={year}>
                <legend>Level {year}</legend>
                <div className="tile-grid">
                  {units
                    .filter((unit) => unitLevel(unit) === year)
                    .map((unit) => (
                      <div
                        className={`tile${complete.has(unit.code) ? " on" : ""}`}
                        key={unit.code}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={complete.has(unit.code)}
                            onChange={() => toggle(unit.code)}
                          />
                          <span className="tile-text">
                            <span className="code">{unit.code}</span>{" "}
                            <span className="tile-title">{unit.title}</span>
                          </span>
                        </label>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => openUnit(unit.code)}
                          aria-label={`View ${unit.code} details`}
                        >
                          Details
                        </button>
                      </div>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
        </li>

        <li className="question">
          <div className="question-label">
            <span className="q-num">04</span>
            <h2>Any credit without a unit code?</h2>
            <p>Advanced standing or transfer credit granted by Monash.</p>
          </div>
          <div className="question-body">
            {plan.creditBlocks.length > 0 && (
              <ul className="credit-list">
                {plan.creditBlocks.map((block, index) => (
                  <li key={`${block.label}-${index}`}>
                    <span>
                      <strong>{block.label}</strong>
                      <span className="mono-label">
                        Level {block.level} · {block.points} cp
                      </span>
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${block.label}`}
                      onClick={() =>
                        updatePlan((current) => ({
                          ...current,
                          creditBlocks: current.creditBlocks.filter(
                            (_, i) => i !== index,
                          ),
                        }))
                      }
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="field-row credit-form">
              <label className="field grow">
                <span>Label</span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Level</span>
                <select
                  value={level}
                  onChange={(event) => setLevel(Number(event.target.value))}
                >
                  {creditLevels.map((value) => (
                    <option key={value} value={value}>
                      Level {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field narrow">
                <span>Points</span>
                <input
                  type="number"
                  min="6"
                  step="6"
                  value={points}
                  onChange={(event) => setPoints(Number(event.target.value))}
                />
              </label>
              <button
                className="button ghost"
                type="button"
                onClick={addBlock}
                disabled={!validBlock}
              >
                <Plus size={15} /> Add credit
              </button>
            </div>
          </div>
        </li>
      </ol>

      <div className="setup-cta">
        <Note icon={<Info size={15} />}>
          Saved automatically in this browser. Nothing is sent anywhere.
        </Note>
        <button
          className="button primary large"
          type="button"
          onClick={() => navigate("/plan")}
        >
          Open my planner <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
