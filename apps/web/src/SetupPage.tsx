import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Info, Plus, Search, X } from "lucide-react";
import {
  campusSchema,
  courseDataMetrics,
  unitLevel,
  type Campus,
  type Plan,
} from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore } from "./store";
import { compareCodes, Note, PageHead } from "./ui";

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : value + "%";
}

export function SetupPage({ openUnit }: { openUnit: (code: string) => void }) {
  const plan = usePlanStore((state) => state.plan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const navigate = useNavigate();
  const [courseQuery, setCourseQuery] = useState("");
  const [label, setLabel] = useState("Advanced standing");
  const [level, setLevel] = useState<number>(1);
  const [points, setPoints] = useState(1);
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  const metrics = course ? courseDataMetrics(course, catalog) : null;
  const selectedComponents = [
    ...(course?.majors ?? []).filter((item) =>
      (plan.course.majorIds ?? [plan.course.majorId]).includes(item.id),
    ),
    ...(course?.minors ?? []).filter((item) =>
      (plan.course.minorIds ?? []).includes(item.id),
    ),
    ...(course?.specialisations ?? []).filter((item) =>
      (plan.course.specialisationIds ?? []).includes(item.id),
    ),
  ];
  const courseOptions = [
    ...new Map(
      [...catalog.courses]
        .sort((a, b) => a.version - b.version)
        .map((item) => [item.code, item]),
    ).values(),
  ].sort((a, b) => a.code.localeCompare(b.code));
  const matches = courseOptions.filter((item) =>
    (item.code + " " + item.title)
      .toLowerCase()
      .includes(courseQuery.toLowerCase()),
  );
  const versionOptions = catalog.courses
    .filter((item) => item.code === plan.course.code)
    .sort((a, b) => b.version - a.version);
  const componentGroups = [
    { key: "majorIds" as const, label: "Majors", items: course?.majors ?? [] },
    { key: "minorIds" as const, label: "Minors", items: course?.minors ?? [] },
    {
      key: "specialisationIds" as const,
      label: "Specialisations",
      items: course?.specialisations ?? [],
    },
  ];
  const chooseCourse = (code: string, version?: number) => {
    const next = catalog.courses.find(
      (item) =>
        item.code === code &&
        item.version ===
          (version ??
            Math.max(
              ...catalog.courses
                .filter((item) => item.code === code)
                .map((item) => item.version),
            )),
    );
    if (!next) return;
    const defaultMajor = next.majors[0];
    updatePlan((current) => ({
      ...current,
      course: {
        code: next.code,
        version: next.version,
        majorId: defaultMajor?.id ?? "",
        majorIds: defaultMajor ? [defaultMajor.id] : [],
        minorIds: [],
        specialisationIds: [],
      },
      startPeriod: { ...current.startPeriod, year: next.version },
      selectedPathway: undefined,
    }));
    setCourseQuery("");
  };
  const chooseVersion = (version: number) => {
    const next = catalog.courses.find(
      (item) => item.code === plan.course.code && item.version === version,
    );
    if (!next) return;
    updatePlan((current) => {
      const majors = (
        current.course.majorIds ?? [current.course.majorId]
      ).filter((id) => next.majors.some((item) => item.id === id));
      const majorIds = majors.length
        ? majors
        : next.majors[0]
          ? [next.majors[0].id]
          : [];
      return {
        ...current,
        course: {
          ...current.course,
          version,
          majorId: majorIds[0] ?? "",
          majorIds,
          minorIds: (current.course.minorIds ?? []).filter((id) =>
            next.minors.some((item) => item.id === id),
          ),
          specialisationIds: (current.course.specialisationIds ?? []).filter(
            (id) => next.specialisations.some((item) => item.id === id),
          ),
        },
        startPeriod: { ...current.startPeriod, year: version },
      };
    });
  };
  const toggleComponent = (
    key: "majorIds" | "minorIds" | "specialisationIds",
    id: string,
  ) =>
    updatePlan((current) => {
      const previous = current.course[key] ?? [];
      const ids = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];
      return {
        ...current,
        course: {
          ...current.course,
          [key]: ids,
          majorId: key === "majorIds" ? (ids[0] ?? "") : current.course.majorId,
        },
      };
    });
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
  const validBlock =
    label.trim() !== "" && Number.isInteger(points) && points > 0;
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
    setPoints(1);
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
                <strong>{course?.title ?? "Course unavailable"}</strong>
                <span>
                  {selectedComponents.map((item) => item.title).join(" · ") ||
                    "Choose a component below"}
                </span>
                <span className="mono-label">
                  Coverage {formatPercent(metrics?.coveragePercent)} · Verified{" "}
                  {formatPercent(metrics?.verificationPercent)}
                </span>
              </div>
              <span className="flag ok">
                <Check size={13} aria-hidden="true" /> Selected
              </span>
            </div>
            <label className="search">
              <Search size={15} aria-hidden="true" />
              <input
                value={courseQuery}
                onChange={(event) => setCourseQuery(event.target.value)}
                placeholder="Search course code or title"
                aria-label="Search courses"
              />
            </label>
            {(courseQuery.trim() || courseOptions.length > 1) && (
              <div className="course-results">
                {matches.length ? (
                  matches.map((item) => (
                    <button
                      className="course-ticket"
                      type="button"
                      key={item.code}
                      onClick={() => chooseCourse(item.code)}
                    >
                      <span className="mono-label">{item.code}</span>
                      <strong>{item.title}</strong>
                      <span className="mono-label">
                        Coverage{" "}
                        {formatPercent(
                          courseDataMetrics(item, catalog).coveragePercent,
                        )}{" "}
                        · Verified{" "}
                        {formatPercent(
                          courseDataMetrics(item, catalog).verificationPercent,
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="hint">
                    暂无数据，欢迎贡献。
                    <a
                      href="https://github.com/FLAMINGOFF/unitpath/issues/new/choose"
                      target="_blank"
                      rel="noreferrer"
                    >
                      提交课程数据建议
                    </a>
                  </p>
                )}
              </div>
            )}
            <label className="field">
              <span>Handbook version · entry year</span>
              <select
                value={plan.course.version}
                onChange={(event) => chooseVersion(Number(event.target.value))}
              >
                {versionOptions.map((item) => (
                  <option key={item.version} value={item.version}>
                    {item.version}
                  </option>
                ))}
              </select>
            </label>
            {componentGroups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <fieldset className="unit-picker" key={group.key}>
                  <legend>{group.label}</legend>
                  <div className="pathway-options">
                    {group.items.map((item) => {
                      const checked = (plan.course[group.key] ?? []).includes(
                        item.id,
                      );
                      return (
                        <label
                          className={checked ? "pathway on" : "pathway"}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleComponent(group.key, item.id)}
                          />
                          <span className="pathway-text">
                            <strong>{item.title}</strong>
                            <span className="mono-label">{item.id}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
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
                onChange={(event) => chooseVersion(Number(event.target.value))}
              >
                {versionOptions.map((item) => (
                  <option key={item.version} value={item.version}>
                    {item.version}
                  </option>
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
            <label className="field">
              <span>Campus</span>
              <select
                value={plan.campus ?? ""}
                onChange={(event) =>
                  updatePlan((current) => ({
                    ...current,
                    campus: event.target.value
                      ? (event.target.value as Campus)
                      : undefined,
                  }))
                }
              >
                <option value="">Select campus</option>
                {campusSchema.options.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
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
                  min="1"
                  step="1"
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
