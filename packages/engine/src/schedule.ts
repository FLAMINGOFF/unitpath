import type { Catalog, Expr, Period, Plan } from "./schema";
import {
  courseAndMajor,
  evaluateRequisites,
  periodFromOrdinal,
  periodOrdinal,
  satisfiesUnit,
  unitLevel,
  validatePlan,
  type Issue,
} from "./engine";

export type ElectiveSlot = {
  unit: "ELECTIVE" | "ELECTIVE_L3";
  period: Period;
  points: 6;
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
  selectedPathway?: string;
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
  const { course, major } = courseAndMajor(plan, catalog);
  const selectedPathway = options.selectedPathway ?? plan.selectedPathway;
  const totalRule = course.rules.find((rule) => "totalCredits" in rule);
  const targetCredits =
    totalRule && "totalCredits" in totalRule ? totalRule.totalCredits : 0;
  const level3Rule = course.rules.find(
    (rule) => "minCreditsAtLevel" in rule && rule.minCreditsAtLevel.level === 3,
  );
  const targetLevel3 =
    level3Rule && "minCreditsAtLevel" in level3Rule
      ? level3Rule.minCreditsAtLevel.points
      : 0;
  const required = [...course.rules, ...major.rules].flatMap((rule) => {
    if ("requiredUnits" in rule) return rule.requiredUnits;
    if ("oneOf" in rule)
      return (
        (
          rule.oneOf.find((item) => item.label === selectedPathway) ??
          rule.oneOf[0]
        )?.requiredUnits ?? []
      );
    return [];
  });
  const fixed = plan.entries.filter((entry) => entry.status !== "planned");
  const needed = [...new Set(required)].filter(
    (code) => !fixed.some((entry) => satisfiesUnit(code, entry.unit, catalog)),
  );
  const order = priority(needed, catalog, major.suggestedSequence);
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
  let electiveCount = Math.max(
    0,
    Math.ceil((targetCredits - fixedCredit - blockCredit - neededCredit) / 6),
  );
  const level3 =
    fixed.reduce(
      (sum, entry) =>
        sum +
        (unitLevel(catalog.units[entry.unit] ?? entry.unit) === 3
          ? (catalog.units[entry.unit]?.creditPoints ?? 0)
          : 0),
      0,
    ) +
    needed.reduce(
      (sum, code) =>
        sum +
        (unitLevel(catalog.units[code] ?? code) === 3
          ? (catalog.units[code]?.creditPoints ?? 0)
          : 0),
      0,
    ) +
    plan.creditBlocks
      .filter((block) => block.level === 3)
      .reduce((sum, block) => sum + block.points, 0);
  let level3Electives = Math.min(
    electiveCount,
    Math.max(0, Math.ceil((targetLevel3 - level3) / 6)),
  );
  const start = Math.max(
    periodOrdinal(plan.startPeriod),
    periodOrdinal(options.currentPeriod) + 1,
  );
  let noCoreProgress = 0;
  let lastOrdinal = start;

  for (
    let offset = 0;
    offset < 16 && (remaining.size > 0 || electiveCount > 0);
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
      if (
        !unit ||
        unit.offerings === "TODO" ||
        !unit.offerings.includes(period.term)
      )
        continue;
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
            !candidate ||
            candidate.offerings === "TODO" ||
            !candidate.offerings.includes(period.term)
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
    while (slots > 0 && electiveCount > 0) {
      const isLevel3 =
        level3Electives > 0 && ordinal - periodOrdinal(plan.startPeriod) >= 3;
      const isGeneral = electiveCount > level3Electives;
      if (!isLevel3 && !isGeneral) break;
      placeholders.push({
        unit: isLevel3 ? "ELECTIVE_L3" : "ELECTIVE",
        period,
        points: 6,
      });
      if (isLevel3) level3Electives--;
      electiveCount--;
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
  if (electiveCount > 0)
    unscheduled.push({
      unit: "ELECTIVE",
      reason: `${electiveCount} elective slot(s) could not fit within 16 semesters.`,
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
