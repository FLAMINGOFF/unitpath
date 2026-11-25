import type { Catalog, Expr, Period, Plan } from "./schema";
import {
  courseAndComponents,
  checkProgress,
  evaluateRequisites,
  offeredAt,
  periodFromOrdinal,
  periodOrdinal,
  satisfiesUnit,
  unitLevel,
  validatePlan,
  type Issue,
} from "./engine";

export type ElectiveSlot = {
  unit: "ELECTIVE";
  period: Period;
  level?: number;
  points: number;
};
export type ScheduleResult = {
  entries: Plan["entries"];
  placeholders: ElectiveSlot[];
  expectedGraduation: Period | null;
  unscheduled: Array<{ unit: string; reason: string }>;
  issues: Issue[];
};
export type ScheduleOptions = {
  currentPeriod: Period;
};

function referencedUnits(expr: Expr | null | "TODO"): string[] {
  if (!expr || expr === "TODO") return [];
  if ("unit" in expr) return [expr.unit];
  if ("all" in expr) return expr.all.flatMap(referencedUnits);
  if ("any" in expr) return expr.any.flatMap(referencedUnits);
  if ("atLeast" in expr) return expr.atLeast.of.flatMap(referencedUnits);
  return [];
}

function priority(
  required: string[],
  catalog: Catalog,
  sequence: Record<string, string[]>,
): (a: string, b: string) => number {
  const pending = new Set(required);
  const dependents = new Map<string, string[]>();
  for (const code of required) {
    const unit = catalog.units[code];
    if (!unit) continue;
    for (const dependency of referencedUnits(unit.requisites.prerequisite)) {
      if (!pending.has(dependency)) continue;
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), code]);
    }
  }
  const memo = new Map<string, number>();
  function chain(code: string, active: Set<string>): number {
    if (memo.has(code)) return memo.get(code)!;
    if (active.has(code)) return 0;
    active.add(code);
    const length =
      1 +
      Math.max(
        0,
        ...(dependents.get(code) ?? []).map((next) => chain(next, active)),
      );
    active.delete(code);
    memo.set(code, length);
    return length;
  }
  const sequencePosition = new Map<string, number>();
  Object.entries(sequence)
    .sort(([a], [b]) => {
      const parse = (key: string) =>
        Number(key.match(/^Y(\d+)S/)?.[1] ?? 0) * 2 + Number(key.slice(-1));
      return parse(a) - parse(b);
    })
    .flatMap(([, codes]) => codes)
    .forEach((code, index) => sequencePosition.set(code, index));
  return (a, b) =>
    chain(b, new Set()) - chain(a, new Set()) ||
    (sequencePosition.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (sequencePosition.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    a.localeCompare(b);
}

function reasonFor(
  code: string,
  period: Period,
  plan: Plan,
  catalog: Catalog,
): string {
  const unit = catalog.units[code];
  if (!unit) return "Unit is missing from the catalog.";
  if (unit.offerings === "TODO")
    return "Teaching periods have not been verified.";
  if (!plan.campus) return "Select a campus before scheduling this unit.";
  const report = evaluateRequisites(unit, period, plan, catalog);
  return (
    [report.prerequisite, report.corequisite, report.prohibition]
      .filter((node) => !node.ok)
      .map((node) => node.message)
      .join(" ") || "No feasible term was found within 16 semesters."
  );
}

export function autoSchedule(
  plan: Plan,
  catalog: Catalog,
  options: ScheduleOptions,
): ScheduleResult {
  const { course, components, scopedRules } = courseAndComponents(
    plan,
    catalog,
  );
  const allRules = scopedRules.map((entry) => entry.rule);
  const totalRule = course.rules.find((rule) => "totalCredits" in rule);
  const targetCredits =
    totalRule && "totalCredits" in totalRule ? totalRule.totalCredits : 0;
  const levelMinimums = new Map<number, number>();
  for (const rule of allRules) {
    if ("minCreditsAtLevel" in rule) {
      const { level, points } = rule.minCreditsAtLevel;
      levelMinimums.set(level, Math.max(levelMinimums.get(level) ?? 0, points));
    }
  }
  const required = scopedRules.flatMap(({ id, rule }) => {
    if ("requiredUnits" in rule) return rule.requiredUnits;
    if ("oneOf" in rule)
      return (
        (
          rule.oneOf.find((item) => item.label === plan.selectedPathways[id]) ??
          rule.oneOf[0]
        )?.requiredUnits ?? []
      );
    return [];
  });
  const fixed = plan.entries.filter((entry) => entry.status !== "planned");
  const needed = [...new Set(required)].filter(
    (code) => !fixed.some((entry) => satisfiesUnit(code, entry.unit, catalog)),
  );
  const sequence: Record<string, string[]> = {};
  for (const component of components) {
    for (const [period, codes] of Object.entries(component.suggestedSequence)) {
      sequence[period] = [...new Set([...(sequence[period] ?? []), ...codes])];
    }
  }
  const order = priority(needed, catalog, sequence);
  const remaining = new Set(needed);
  const newEntries: Plan["entries"] = [];
  const placeholders: ElectiveSlot[] = [];
  const fixedCredit = fixed.reduce(
    (sum, entry) => sum + (catalog.units[entry.unit]?.creditPoints ?? 0),
    0,
  );
  const blockCredit = plan.creditBlocks.reduce(
    (sum, block) => sum + block.points,
    0,
  );
  const neededCredit = needed.reduce(
    (sum, code) => sum + (catalog.units[code]?.creditPoints ?? 0),
    0,
  );
  let electivePointsRemaining = Math.max(
    0,
    targetCredits - fixedCredit - blockCredit - neededCredit,
  );
  const knownPoints = [...new Set(required)]
    .map((code) => catalog.units[code]?.creditPoints)
    .filter((points): points is number => points !== undefined)
    .sort((a, b) => a - b);
  const nominalPoints = knownPoints.length
    ? knownPoints[Math.floor((knownPoints.length - 1) / 2)]!
    : 0;
  const levelCredits = new Map<number, number>();
  for (const code of [...fixed.map((entry) => entry.unit), ...needed]) {
    const unit = catalog.units[code];
    if (!unit) continue;
    const level = unitLevel(unit);
    levelCredits.set(level, (levelCredits.get(level) ?? 0) + unit.creditPoints);
  }
  for (const block of plan.creditBlocks) {
    levelCredits.set(
      block.level,
      (levelCredits.get(block.level) ?? 0) + block.points,
    );
  }
  const levelDeficits = new Map(
    [...levelMinimums].map(([level, points]) => [
      level,
      Math.max(0, points - (levelCredits.get(level) ?? 0)),
    ]),
  );
  const start = Math.max(
    periodOrdinal(plan.startPeriod),
    periodOrdinal(options.currentPeriod) + 1,
  );
  let noCoreProgress = 0;
  let lastOrdinal = start;

  for (
    let offset = 0;
    offset < 16 && (remaining.size > 0 || electivePointsRemaining > 0);
    offset++
  ) {
    const ordinal = start + offset;
    const period = periodFromOrdinal(ordinal);
    const current = [...fixed, ...newEntries];
    const occupied = current.filter(
      (entry) => periodOrdinal(entry.period) === ordinal,
    ).length;
    let slots = Math.max(0, plan.maxUnitsPerTerm - occupied);
    let corePlaced = 0;
    const candidates = [...remaining].sort(order);
    for (const code of candidates) {
      if (!remaining.has(code) || slots <= 0) continue;
      const unit = catalog.units[code];
      if (!unit || offeredAt(unit, period, plan.campus) !== true) continue;
      const basePlan = { ...plan, entries: current };
      const prereq = evaluateRequisites(
        unit,
        period,
        basePlan,
        catalog,
      ).prerequisite;
      if (!prereq.ok) continue;
      const coreqRefs = referencedUnits(unit.requisites.corequisite)
        .filter((ref) => remaining.has(ref) && ref !== code)
        .sort(order);
      const bundle = [code, ...coreqRefs];
      if (bundle.length > slots) continue;
      if (
        bundle.some((item) => {
          const candidate = catalog.units[item];
          return (
            !candidate || offeredAt(candidate, period, plan.campus) !== true
          );
        })
      )
        continue;
      const hypothetical: Plan = {
        ...plan,
        entries: [
          ...fixed,
          ...newEntries,
          ...bundle.map((item) => ({
            unit: item,
            period,
            status: "planned" as const,
          })),
        ],
      };
      if (
        bundle.some(
          (item) =>
            !evaluateRequisites(
              catalog.units[item]!,
              period,
              hypothetical,
              catalog,
            ).ok,
        )
      )
        continue;
      for (const item of bundle) {
        newEntries.push({ unit: item, period, status: "planned" });
        remaining.delete(item);
      }
      corePlaced += bundle.length;
      slots -= bundle.length;
    }
    if (corePlaced === 0 && remaining.size > 0) noCoreProgress++;
    else noCoreProgress = 0;
    while (slots > 0 && electivePointsRemaining > 0 && nominalPoints > 0) {
      const availableLevel = [...levelDeficits].find(
        ([level, deficit]) =>
          deficit > 0 &&
          ordinal - periodOrdinal(plan.startPeriod) >=
            Math.max(0, level * 2 - 3),
      )?.[0];
      const requiredLevelPoints = [...levelDeficits.values()].reduce(
        (sum, value) => sum + value,
        0,
      );
      if (
        availableLevel === undefined &&
        electivePointsRemaining <= requiredLevelPoints
      )
        break;
      const points = Math.min(
        nominalPoints,
        electivePointsRemaining,
        availableLevel === undefined
          ? Number.POSITIVE_INFINITY
          : levelDeficits.get(availableLevel)!,
      );
      placeholders.push({
        unit: "ELECTIVE",
        period,
        level: availableLevel,
        points,
      });
      electivePointsRemaining -= points;
      if (availableLevel !== undefined)
        levelDeficits.set(
          availableLevel,
          levelDeficits.get(availableLevel)! - points,
        );
      slots--;
    }
    lastOrdinal = ordinal;
    if (noCoreProgress >= 2 && remaining.size > 0) break;
  }
  const resultPlan: Plan = { ...plan, entries: [...fixed, ...newEntries] };
  const unscheduled = [...remaining].sort(order).map((code) => ({
    unit: code,
    reason: reasonFor(
      code,
      periodFromOrdinal(lastOrdinal + 1),
      resultPlan,
      catalog,
    ),
  }));
  const projectedRules = checkProgress(resultPlan, catalog).projected;
  for (const { id, rule } of scopedRules) {
    if ("creditsFromList" in rule) {
      const current =
        projectedRules.find((item) => item.id === id)?.current ?? 0;
      const gap = Math.max(0, rule.creditsFromList.points - current);
      if (gap > 0)
        unscheduled.push({
          unit: id,
          reason:
            gap +
            " credit points still needed from the eligible unit list; choose units manually.",
        });
    }
  }
  if (electivePointsRemaining > 0)
    unscheduled.push({
      unit: "ELECTIVE",
      reason:
        nominalPoints === 0
          ? "No required unit credit points are available to estimate elective slots."
          : `${electivePointsRemaining} elective credit points could not fit within 16 semesters.`,
    });
  const allScheduled = unscheduled.length === 0;
  return {
    entries: newEntries,
    placeholders,
    expectedGraduation: allScheduled ? periodFromOrdinal(lastOrdinal) : null,
    unscheduled,
    issues: validatePlan(resultPlan, catalog),
  };
}
