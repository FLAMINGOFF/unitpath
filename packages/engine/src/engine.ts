import type {
  Campus,
  Catalog,
  Course,
  Expr,
  Component,
  Period,
  Plan,
  Rule,
  Unit,
} from "./schema";

export type EvalNode = {
  expr: Expr | "TODO" | null;
  ok: boolean;
  unknown?: boolean;
  children?: EvalNode[];
  message: string;
};

export type RequisiteReport = {
  unit: string;
  period: Period;
  prerequisite: EvalNode;
  corequisite: EvalNode;
  prohibition: EvalNode;
  ok: boolean;
};

export type RuleProgress = {
  id: string;
  status: "met" | "partial" | "unmet";
  current: number;
  target: number;
  message: string;
  missingUnits?: string[];
  pathway?: string;
};

export type ProgressReport = {
  actual: RuleProgress[];
  projected: RuleProgress[];
  actualCredits: number;
  projectedCredits: number;
};

export type Issue = {
  level: "error" | "warning" | "info";
  unit?: string;
  period?: Period;
  code: string;
  message: string;
};

export function periodOrdinal(period: Period): number {
  return period.year * 2 + (period.term === "S1" ? 0 : 1);
}

export function periodFromOrdinal(value: number): Period {
  return { year: Math.floor(value / 2), term: value % 2 === 0 ? "S1" : "S2" };
}

export function unitLevel(unit: Unit | string): number {
  const code = typeof unit === "string" ? unit : unit.code;
  const digit = code.match(/\d/)?.[0];
  if (digit === undefined)
    throw new Error(`Unit code ${code} has no level digit.`);
  return typeof unit === "string"
    ? Number(digit)
    : (unit.level ?? Number(digit));
}

export function offeredAt(
  unit: Unit,
  period: Period,
  campus?: Campus | null,
): boolean | "unknown" {
  if (unit.offerings === "TODO" || !campus) return "unknown";
  return unit.offerings.some(
    (offering) => offering.term === period.term && offering.campus === campus,
  );
}

export function courseAndComponents(
  plan: Plan,
  catalog: Catalog,
): { course: Course; components: Component[] } {
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  if (!course)
    throw new Error(
      "Course " +
        plan.course.code +
        "/" +
        plan.course.version +
        " is not in the catalog.",
    );
  const resolve = (
    kind: string,
    ids: string[],
    options: Component[],
  ): Component[] =>
    ids.map((id) => {
      const component = options.find((item) => item.id === id);
      if (!component)
        throw new Error(kind + " " + id + " is not in the catalog.");
      return component;
    });
  const majorIds =
    plan.course.majorIds ?? (plan.course.majorId ? [plan.course.majorId] : []);
  const components = [
    ...resolve("Major", majorIds, course.majors),
    ...resolve("Minor", plan.course.minorIds ?? [], course.minors),
    ...resolve(
      "Specialisation",
      plan.course.specialisationIds ?? [],
      course.specialisations,
    ),
  ];
  return { course, components };
}

export function satisfiesUnit(
  required: string,
  taken: string,
  catalog: Catalog,
): boolean {
  const seen = new Set<string>();
  let current: string | null = required;
  while (current && !seen.has(current)) {
    if (current === taken) return true;
    seen.add(current);
    const replacement: string | null | "TODO" | undefined =
      catalog.units[current]?.replacedBy;
    current = replacement && replacement !== "TODO" ? replacement : null;
  }
  return false;
}

function uniqueEntries(
  plan: Plan,
  cutoff: number,
  inclusive: boolean,
): Plan["entries"] {
  const seen = new Set<string>();
  return plan.entries
    .filter((entry) =>
      inclusive
        ? periodOrdinal(entry.period) <= cutoff
        : periodOrdinal(entry.period) < cutoff,
    )
    .filter((entry) => {
      if (seen.has(entry.unit)) return false;
      seen.add(entry.unit);
      return true;
    });
}

function credits(
  entries: Plan["entries"],
  plan: Plan,
  catalog: Catalog,
  level?: number,
): number {
  const units = entries.reduce((sum, entry) => {
    if (
      level !== undefined &&
      unitLevel(catalog.units[entry.unit] ?? entry.unit) !== level
    )
      return sum;
    return sum + (catalog.units[entry.unit]?.creditPoints ?? 0);
  }, 0);
  const blocks = plan.creditBlocks
    .filter((block) => level === undefined || block.level === level)
    .reduce((sum, block) => sum + block.points, 0);
  return units + blocks;
}

function evalExpr(
  expr: Expr | null | "TODO",
  entries: Plan["entries"],
  plan: Plan,
  catalog: Catalog,
): EvalNode {
  if (expr === null) return { expr, ok: true, message: "No requirement." };
  if (expr === "TODO")
    return {
      expr,
      ok: false,
      unknown: true,
      message: "Requirement has not been verified.",
    };
  if ("unit" in expr) {
    const ok = entries.some((entry) =>
      satisfiesUnit(expr.unit, entry.unit, catalog),
    );
    return {
      expr,
      ok,
      message: ok
        ? `${expr.unit} is scheduled or completed.`
        : `${expr.unit} has not been scheduled.`,
    };
  }
  if ("all" in expr || "any" in expr) {
    const list = "all" in expr ? expr.all : expr.any;
    const children = list.map((item) => evalExpr(item, entries, plan, catalog));
    const ok =
      "all" in expr
        ? children.every((child) => child.ok)
        : children.some((child) => child.ok);
    return {
      expr,
      ok,
      unknown: !ok && children.some((child) => child.unknown),
      children,
      message: `${"all" in expr ? "All" : "At least one"} condition${list.length === 1 ? "" : "s"} ${ok ? "met" : "required"}.`,
    };
  }
  if ("atLeast" in expr) {
    const children = expr.atLeast.of.map((item) =>
      evalExpr(item, entries, plan, catalog),
    );
    const count = children.filter((child) => child.ok).length;
    return {
      expr,
      ok: count >= expr.atLeast.n,
      unknown:
        count < expr.atLeast.n && children.some((child) => child.unknown),
      children,
      message: `${count} of ${expr.atLeast.n} required conditions met.`,
    };
  }
  if ("minCredits" in expr) {
    const current = credits(entries, plan, catalog);
    return {
      expr,
      ok: current >= expr.minCredits,
      message: `${current} of ${expr.minCredits} credit points earned before this term.`,
    };
  }
  if ("minCreditsAtLevel" in expr) {
    const current = credits(
      entries,
      plan,
      catalog,
      expr.minCreditsAtLevel.level,
    );
    return {
      expr,
      ok: current >= expr.minCreditsAtLevel.points,
      message: `${current} of ${expr.minCreditsAtLevel.points} level ${expr.minCreditsAtLevel.level} credit points earned.`,
    };
  }
  const ok = plan.course.code === expr.enrolledIn;
  return {
    expr,
    ok,
    message: ok
      ? `Enrolled in ${expr.enrolledIn}.`
      : `Requires enrolment in ${expr.enrolledIn}.`,
  };
}

function prohibited(a: Unit, b: Unit): boolean | "TODO" {
  const forward = a.requisites.prohibitions;
  const backward = b.requisites.prohibitions;
  if (forward !== "TODO" && forward.includes(b.code)) return true;
  if (backward !== "TODO" && backward.includes(a.code)) return true;
  return forward === "TODO" || backward === "TODO" ? "TODO" : false;
}

export function evaluateRequisites(
  unit: Unit,
  period: Period,
  plan: Plan,
  catalog: Catalog,
): RequisiteReport {
  const cutoff = periodOrdinal(period);
  const earlier = uniqueEntries(plan, cutoff, false);
  const concurrent = uniqueEntries(plan, cutoff, true);
  const prerequisite = evalExpr(
    unit.requisites.prerequisite,
    earlier,
    plan,
    catalog,
  );
  const corequisite = evalExpr(
    unit.requisites.corequisite,
    concurrent,
    plan,
    catalog,
  );
  const conflicts: string[] = [];
  let prohibitionUnknown = unit.requisites.prohibitions === "TODO";
  for (const entry of plan.entries) {
    if (entry.unit === unit.code) continue;
    const other = catalog.units[entry.unit];
    if (!other) continue;
    const result = prohibited(unit, other);
    if (result === true) conflicts.push(other.code);
    if (result === "TODO") prohibitionUnknown = true;
  }
  const prohibition: EvalNode = conflicts.length
    ? {
        expr: null,
        ok: false,
        message: `Prohibited combination with ${[...new Set(conflicts)].sort().join(", ")}.`,
      }
    : prohibitionUnknown
      ? {
          expr: "TODO",
          ok: false,
          unknown: true,
          message: "Prohibitions have not been verified.",
        }
      : { expr: null, ok: true, message: "No prohibition conflict." };
  return {
    unit: unit.code,
    period,
    prerequisite,
    corequisite,
    prohibition,
    ok: prerequisite.ok && corequisite.ok && prohibition.ok,
  };
}

function tally(
  plan: Plan,
  catalog: Catalog,
  includePlanned: boolean,
): { entries: Plan["entries"]; credits: Record<number, number> } {
  const entries = uniqueEntries(
    {
      ...plan,
      entries: plan.entries.filter(
        (entry) => includePlanned || entry.status !== "planned",
      ),
    },
    Number.POSITIVE_INFINITY,
    true,
  );
  return {
    entries,
    credits: Object.fromEntries(
      [
        ...new Set([
          ...entries.map((entry) =>
            unitLevel(catalog.units[entry.unit] ?? entry.unit),
          ),
          ...plan.creditBlocks.map((block) => block.level),
        ]),
      ].map((level) => [level, credits(entries, plan, catalog, level)]),
    ),
  };
}

function countedCredits(
  byLevel: Record<number, number>,
  caps: Map<number, number>,
): number {
  return Object.entries(byLevel).reduce(
    (sum, [level, value]) =>
      sum +
      Math.min(value, caps.get(Number(level)) ?? Number.POSITIVE_INFINITY),
    0,
  );
}

function progressForRule(
  rule: Rule,
  plan: Plan,
  catalog: Catalog,
  entries: Plan["entries"],
  byLevel: Record<number, number>,
  caps: Map<number, number>,
): RuleProgress {
  const status = (current: number, target: number): RuleProgress["status"] =>
    current >= target ? "met" : current > 0 ? "partial" : "unmet";
  if ("totalCredits" in rule) {
    const current = countedCredits(byLevel, caps);
    const overflow = [...caps].flatMap(([level, cap]) => {
      const excess = (byLevel[level] ?? 0) - cap;
      return excess > 0
        ? [`${excess} level ${level} points exceed the cap`]
        : [];
    });
    return {
      id: rule.id,
      status: status(current, rule.totalCredits),
      current,
      target: rule.totalCredits,
      message: `${current}/${rule.totalCredits} credit points count toward the degree${overflow.length ? `; ${overflow.join("; ")}` : ""}.`,
    };
  }
  if ("maxCreditsAtLevel" in rule) {
    const { level, points } = rule.maxCreditsAtLevel;
    const current = byLevel[level] ?? 0;
    return {
      id: rule.id,
      status: current <= points ? "met" : "unmet",
      current,
      target: points,
      message: `${current} level ${level} points; at most ${points} count toward the degree.`,
    };
  }
  if ("minCreditsAtLevel" in rule) {
    const { level, points } = rule.minCreditsAtLevel;
    const current = byLevel[level] ?? 0;
    return {
      id: rule.id,
      status: status(current, points),
      current,
      target: points,
      message: `${current}/${points} level ${level} points.`,
    };
  }
  if ("creditsFromList" in rule) {
    const eligible = new Set(rule.creditsFromList.units);
    const current = entries.reduce((sum, entry) => {
      const unit = catalog.units[entry.unit];
      return unit &&
        [...eligible].some((code) => satisfiesUnit(code, entry.unit, catalog))
        ? sum + unit.creditPoints
        : sum;
    }, 0);
    return {
      id: rule.id,
      status: status(current, rule.creditsFromList.points),
      current,
      target: rule.creditsFromList.points,
      message:
        current +
        "/" +
        rule.creditsFromList.points +
        " credit points from the selected unit list.",
    };
  }
  if ("requiredUnits" in rule) {
    const missingUnits = rule.requiredUnits.filter(
      (code) =>
        !entries.some((entry) => satisfiesUnit(code, entry.unit, catalog)),
    );
    const current = rule.requiredUnits.length - missingUnits.length;
    return {
      id: rule.id,
      status: status(current, rule.requiredUnits.length),
      current,
      target: rule.requiredUnits.length,
      missingUnits,
      message: missingUnits.length
        ? `Missing: ${missingUnits.join(", ")}.`
        : "All required units are present.",
    };
  }
  const scored = rule.oneOf.map((branch) => {
    const missingUnits = branch.requiredUnits.filter(
      (code) =>
        !entries.some((entry) => satisfiesUnit(code, entry.unit, catalog)),
    );
    return {
      branch,
      missingUnits,
      current: branch.requiredUnits.length - missingUnits.length,
    };
  });
  const selected =
    scored.find((item) => item.branch.label === plan.selectedPathway) ??
    [...scored].sort(
      (a, b) =>
        b.current / b.branch.requiredUnits.length -
        a.current / a.branch.requiredUnits.length,
    )[0]!;
  const anyMet = scored.some((item) => item.missingUnits.length === 0);
  return {
    id: rule.id,
    status: anyMet
      ? "met"
      : status(selected.current, selected.branch.requiredUnits.length),
    current: selected.current,
    target: selected.branch.requiredUnits.length,
    missingUnits: selected.missingUnits,
    pathway: selected.branch.label,
    message: `${selected.branch.label}: ${selected.current}/${selected.branch.requiredUnits.length} required units.`,
  };
}

export function checkProgress(plan: Plan, catalog: Catalog): ProgressReport {
  const { course, components } = courseAndComponents(plan, catalog);
  const rules = [
    ...course.rules,
    ...components.flatMap((component) => component.rules),
  ];
  const caps = new Map<number, number>();
  for (const rule of rules) {
    if ("maxCreditsAtLevel" in rule) {
      const { level, points } = rule.maxCreditsAtLevel;
      caps.set(
        level,
        Math.min(caps.get(level) ?? Number.POSITIVE_INFINITY, points),
      );
    }
  }
  const actual = tally(plan, catalog, false);
  const projected = tally(plan, catalog, true);
  const actualRules = rules.map((rule) =>
    progressForRule(rule, plan, catalog, actual.entries, actual.credits, caps),
  );
  const projectedRules = rules.map((rule) =>
    progressForRule(
      rule,
      plan,
      catalog,
      projected.entries,
      projected.credits,
      caps,
    ),
  );
  return {
    actual: actualRules,
    projected: projectedRules,
    actualCredits: countedCredits(actual.credits, caps),
    projectedCredits: countedCredits(projected.credits, caps),
  };
}

export function validatePlan(plan: Plan, catalog: Catalog): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const perTerm = new Map<number, number>();
  for (const entry of plan.entries) {
    const ordinal = periodOrdinal(entry.period);
    perTerm.set(ordinal, (perTerm.get(ordinal) ?? 0) + 1);
    if (seen.has(entry.unit)) {
      issues.push({
        level: "error",
        unit: entry.unit,
        period: entry.period,
        code: "DUPLICATE_UNIT",
        message: `${entry.unit} appears more than once.`,
      });
    }
    seen.add(entry.unit);
    const unit = catalog.units[entry.unit];
    if (!unit) {
      issues.push({
        level: "error",
        unit: entry.unit,
        period: entry.period,
        code: "UNKNOWN_UNIT",
        message: `${entry.unit} is not in this catalog.`,
      });
      continue;
    }
    if (!unit.verified) {
      issues.push({
        level: "info",
        unit: entry.unit,
        period: entry.period,
        code: "DATA_UNVERIFIED",
        message: `${entry.unit} data has not been verified against the Handbook.`,
      });
    }
    const offered = offeredAt(unit, entry.period, plan.campus);
    if (offered === "unknown") {
      issues.push({
        level: "info",
        unit: entry.unit,
        period: entry.period,
        code:
          unit.offerings === "TODO" ? "OFFERING_UNKNOWN" : "CAMPUS_UNSELECTED",
        message:
          unit.offerings === "TODO"
            ? entry.unit + " offerings are not verified."
            : "Choose a campus to check " + entry.unit + " offerings.",
      });
    } else if (!offered) {
      issues.push({
        level: "error",
        unit: entry.unit,
        period: entry.period,
        code: "NOT_OFFERED",
        message:
          entry.unit +
          " is not offered in " +
          entry.period.term +
          " at " +
          plan.campus +
          ".",
      });
    }
    if (
      unit.replacedBy &&
      unit.replacedBy !== "TODO" &&
      entry.status === "planned"
    ) {
      issues.push({
        level: "warning",
        unit: entry.unit,
        period: entry.period,
        code: "REPLACED_UNIT",
        message: `${entry.unit} may have been replaced by ${unit.replacedBy}.`,
      });
    }
    const report = evaluateRequisites(unit, entry.period, plan, catalog);
    for (const [key, node, code] of [
      ["Prerequisite", report.prerequisite, "PREREQ_UNMET"],
      ["Corequisite", report.corequisite, "COREQ_UNMET"],
      ["Prohibition", report.prohibition, "PROHIBITION_CONFLICT"],
    ] as const) {
      if (node.ok) continue;
      issues.push({
        level: node.unknown ? "info" : "error",
        unit: entry.unit,
        period: entry.period,
        code: node.unknown ? `${key.toUpperCase()}_UNKNOWN` : code,
        message: `${key}: ${node.message}`,
      });
    }
  }
  for (const [ordinal, count] of perTerm) {
    if (count > plan.maxUnitsPerTerm) {
      issues.push({
        level: "warning",
        period: periodFromOrdinal(ordinal),
        code: "TERM_OVERLOAD",
        message: `${count} units exceed the ${plan.maxUnitsPerTerm} unit term limit.`,
      });
    }
  }
  return issues.sort(
    (a, b) =>
      periodOrdinal(a.period ?? plan.startPeriod) -
        periodOrdinal(b.period ?? plan.startPeriod) ||
      (a.unit ?? "").localeCompare(b.unit ?? "") ||
      a.code.localeCompare(b.code),
  );
}
