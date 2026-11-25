import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { unitLevel, type Plan } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";

export function SetupPage({ openUnit }: { openUnit: (code: string) => void }) {
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const navigate = useNavigate();
  const [label, setLabel] = useState("Advanced standing");
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [points, setPoints] = useState(6);
  const units = Object.values(catalog.units).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  const complete = new Set(
    plan.entries
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.unit),
  );
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
  const addBlock = () => {
    if (!label.trim() || points <= 0 || points % 6 !== 0) return;
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
    <div className="page setup-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GET STARTED</span>
          <h1>Make your degree plan yours.</h1>
          <p>
            Choose your starting term, add completed units, and see what
            remains.
          </p>
        </div>
        <div className="heading-illustration">
          <BookOpen size={42} strokeWidth={1.4} />
        </div>
      </div>
      <div className="step-row">
        <span className="step active">
          <span>1</span> Course
        </span>
        <span className="step active">
          <span>2</span> Starting term
        </span>
        <span className="step active">
          <span>3</span> Prior study
        </span>
      </div>
      <section className="panel setup-section">
        <div className="section-header">
          <div>
            <span className="section-kicker">01 / COURSE</span>
            <h2>Your course</h2>
          </div>
          <CheckCircle2 size={20} className="success-icon" />
        </div>
        <div className="course-card">
          <div className="course-avatar">IT</div>
          <div>
            <strong>Bachelor of Information Technology</strong>
            <p>C2000 · 2026 Handbook · Applied cybersecurity major</p>
          </div>
          <span className="tag">Available now</span>
        </div>
        <p className="inline-note">
          <Info size={16} />
          Only the 2026 Applied cybersecurity version is in the current catalog.
        </p>
      </section>
      <section className="panel setup-section">
        <div className="section-header">
          <div>
            <span className="section-kicker">02 / TIMELINE</span>
            <h2>When did you start?</h2>
          </div>
        </div>
        <div className="form-row">
          <label>
            Entry year
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
          <label>
            First teaching period
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
      </section>
      <section className="panel setup-section">
        <div className="section-header">
          <div>
            <span className="section-kicker">03 / PRIOR STUDY</span>
            <h2>Mark units you've completed</h2>
            <p>
              Select any already completed core units. You can adjust their term
              and status on the planner.
            </p>
          </div>
          <span className="count-tag">{complete.size} selected</span>
        </div>
        {[1, 2, 3].map((year) => (
          <div className="unit-group" key={year}>
            <h3>Level {year}</h3>
            <div className="setup-unit-grid">
              {units
                .filter((unit) => unitLevel(unit.code) === year)
                .map((unit) => (
                  <div
                    className={`setup-unit${complete.has(unit.code) ? " checked" : ""}`}
                    key={unit.code}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={complete.has(unit.code)}
                        onChange={() => toggle(unit.code)}
                      />
                      <span className="check-square" aria-hidden="true">
                        ✓
                      </span>
                      <span>
                        <strong>{unit.code}</strong>
                        <small>{unit.title}</small>
                      </span>
                    </label>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openUnit(unit.code)}
                      aria-label={`View ${unit.code} details`}
                    >
                      Details
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>
      <section className="panel setup-section">
        <div className="section-header">
          <div>
            <span className="section-kicker">04 / ADVANCED STANDING</span>
            <h2>Credit without a unit code</h2>
            <p>
              Add credit granted by the university that does not map to a listed
              unit.
            </p>
          </div>
        </div>
        {plan.creditBlocks.length > 0 && (
          <div className="credit-list">
            {plan.creditBlocks.map((block, index) => (
              <div key={`${block.label}-${index}`}>
                <span>
                  {block.label} · Level {block.level} · {block.points} points
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
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="form-row credit-form">
          <label>
            Label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label>
            Level
            <select
              value={level}
              onChange={(event) =>
                setLevel(Number(event.target.value) as 1 | 2 | 3)
              }
            >
              <option value={1}>Level 1</option>
              <option value={2}>Level 2</option>
              <option value={3}>Level 3</option>
            </select>
          </label>
          <label>
            Points
            <input
              type="number"
              min="6"
              step="6"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
            />
          </label>
          <button className="button secondary" type="button" onClick={addBlock}>
            <Plus size={16} /> Add credit
          </button>
        </div>
      </section>
      <div className="page-actions">
        <span>Saved locally in this browser</span>
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
