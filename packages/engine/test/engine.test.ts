import { describe, expect, it } from "vitest";
import {
  autoSchedule,
  checkProgress,
  courseDataMetrics,
  migratePlan,
  evaluateRequisites,
  latestHandbookVersion,
  parsePlanJson,
  satisfiesUnit,
  unitLevel,
  unitSchema,
  planSchema,
  teachingTermSchema,
  periodSchema,
  validatePlan,
} from "../src";
import {
  fixtureCatalog,
  fixturePlan,
  unit,
} from "../../../test/fixtures/catalog";
import type { Catalog, Expr, Period, Plan } from "../src";

const s1: Period = { year: 2026, term: "S1" };
const s2: Period = { year: 2026, term: "S2" };
const laterS1: Period = { year: 2027, term: "S1" };
const laterS2: Period = { year: 2027, term: "S2" };
const entry = (
  code: string,
  period: Period,
  status: "completed" | "enrolled" | "planned" = "planned",
) => ({ unit: code, period, status });

function reportFor(
  expr: Expr | null | "TODO",
  plan: Plan,
  period: Period = s2,
) {
  const catalog = fixtureCatalog();
  const subject = unit("TST3999", {
    requisites: { prerequisite: expr, corequisite: null, prohibitions: [] },
  });
  catalog.units[subject.code] = subject;
  return evaluateRequisites(subject, period, plan, catalog).prerequisite;
}

describe("Handbook version matching", () => {
  it("chooses the latest version no later than the entry year", () => {
    const catalog = fixtureCatalog();
    catalog.courses.push({ ...catalog.courses[0]!, version: 2028 });
    expect(latestHandbookVersion(catalog, "C2000", 2025)).toBeNull();
    expect(latestHandbookVersion(catalog, "C2000", 2026)).toBe(2026);
    expect(latestHandbookVersion(catalog, "C2000", 2027)).toBe(2026);
    expect(latestHandbookVersion(catalog, "C2000", 2028)).toBe(2028);
    expect(latestHandbookVersion(catalog, "C2000", 2030)).toBe(2028);
    expect(latestHandbookVersion(catalog, "C9999", 2030)).toBeNull();
  });
});

describe("unit levels", () => {
  it("uses the first code digit unless YAML overrides it", () => {
    expect(unitLevel("ABC1234")).toBe(1);
    expect(unitLevel("ABC4999")).toBe(4);
    expect(unitLevel(unit("ABC1234", { level: 4 }))).toBe(4);
    const catalog = fixtureCatalog();
    catalog.units.ABC1234 = unit("ABC1234", { level: 4 });
    catalog.courses[0]!.rules.push({
      id: "level4-min",
      minCreditsAtLevel: { level: 4, points: 6 },
    });
    const report = checkProgress(
      fixturePlan({ entries: [entry("ABC1234", s1, "completed")] }),
      catalog,
    );
    expect(report.actualCredits).toBe(6);
    expect(
      report.actual.find((rule) => rule.id === "course/level4-min")?.status,
    ).toBe("met");
  });
});

describe("credit points", () => {
  it("accepts positive non-six unit and advanced standing credits", () => {
    expect(
      unitSchema.safeParse(unit("TST1001", { creditPoints: 5 })).success,
    ).toBe(true);
    expect(
      unitSchema.safeParse(unit("TST1001", { creditPoints: 0 })).success,
    ).toBe(false);
    const plan = fixturePlan({
      entries: [entry("TST1001", s1, "completed")],
      creditBlocks: [{ label: "Recognised study", level: 2, points: 3 }],
    });
    expect(planSchema.safeParse(plan).success).toBe(true);
    const catalog = fixtureCatalog();
    catalog.units.TST1001!.creditPoints = 5;
    const report = checkProgress(plan, catalog);
    expect(report.actualCredits).toBe(8);
    expect(
      report.actual.find((rule) => rule.id === "course/total")?.current,
    ).toBe(8);
  });
});

describe("course component combinations", () => {
  it("evaluates multiple majors, a minor, a specialisation, and list credits", () => {
    const catalog = fixtureCatalog();
    const course = catalog.courses[0]!;
    course.majors.push({
      id: "second-major",
      title: "Second major",
      rules: [{ id: "second-core", requiredUnits: ["TST1002"] }],
      suggestedSequence: {},
    });
    course.minors.push({
      id: "test-minor",
      title: "Test minor",
      rules: [
        {
          id: "minor-credits",
          creditsFromList: { units: ["TST1002", "TST1003"], points: 12 },
        },
      ],
      suggestedSequence: {},
    });
    course.specialisations.push({
      id: "test-specialisation",
      title: "Test specialisation",
      rules: [{ id: "specialisation-core", requiredUnits: ["TST1003"] }],
      suggestedSequence: {},
    });
    catalog.units.TST1002!.creditPoints = 5;
    catalog.units.TST1003!.creditPoints = 7;
    const plan = fixturePlan({
      course: {
        code: "C2000",
        version: 2026,
        majorIds: ["test-major", "second-major"],
        minorIds: ["test-minor"],
        specialisationIds: ["test-specialisation"],
      },
      entries: [
        entry("TST1002", s1, "completed"),
        entry("TST1003", s1, "completed"),
      ],
    });
    expect(planSchema.safeParse(plan).success).toBe(true);
    const report = checkProgress(plan, catalog);
    expect(
      report.actual.find((rule) => rule.id === "major:second-major/second-core")
        ?.status,
    ).toBe("met");
    expect(
      report.actual.find(
        (rule) =>
          rule.id === "specialisation:test-specialisation/specialisation-core",
      )?.status,
    ).toBe("met");
    expect(
      report.actual.find((rule) => rule.id === "minor:test-minor/minor-credits")
        ?.current,
    ).toBe(12);
    expect(
      report.actual.find((rule) => rule.id === "minor:test-minor/minor-credits")
        ?.status,
    ).toBe("met");
  });
  it("keeps same-named major rules and pathway choices independent", () => {
    const catalog = fixtureCatalog();
    catalog.courses[0]!.majors.push({
      id: "other-major",
      title: "Other major",
      rules: [
        {
          id: "path",
          oneOf: [
            { label: "Other A", requiredUnits: ["TST1001"] },
            { label: "Other B", requiredUnits: ["TST1002"] },
          ],
        },
      ],
      suggestedSequence: {},
    });
    const plan = fixturePlan({
      course: {
        ...fixturePlan().course,
        majorIds: ["test-major", "other-major"],
      },
      selectedPathways: {
        "major:test-major/path": "Alternative pathway",
        "major:other-major/path": "Other B",
      },
      entries: [
        entry("TST3003", s1, "completed"),
        entry("TST1002", s1, "completed"),
      ],
    });
    const rules = checkProgress(plan, catalog).actual;
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
    expect(
      rules.find((rule) => rule.id === "major:test-major/path")?.pathway,
    ).toBe("Alternative pathway");
    expect(
      rules.find((rule) => rule.id === "major:other-major/path")?.pathway,
    ).toBe("Other B");
    const changed = checkProgress(
      {
        ...plan,
        selectedPathways: {
          ...plan.selectedPathways,
          "major:test-major/path": "Standard pathway",
        },
      },
      catalog,
    ).actual;
    expect(
      changed.find((rule) => rule.id === "major:other-major/path")?.pathway,
    ).toBe("Other B");
  });
});

describe("campus offerings", () => {
  it("filters by both semester and campus while reserving seasonal terms", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST4001 = unit("TST4001", {
      offerings: [
        { term: "S1", campus: "Clayton" },
        { term: "S2", campus: "Malaysia" },
        { term: "Summer", campus: "Online" },
      ],
    });
    expect(teachingTermSchema.safeParse("Summer").success).toBe(true);
    expect(teachingTermSchema.safeParse("Winter").success).toBe(true);
    expect(periodSchema.safeParse({ year: 2026, term: "Summer" }).success).toBe(
      false,
    );
    const wrongCampus = validatePlan(
      fixturePlan({ campus: "Malaysia", entries: [entry("TST4001", s1)] }),
      catalog,
    );
    expect(wrongCampus.some((issue) => issue.code === "NOT_OFFERED")).toBe(
      true,
    );
    const valid = validatePlan(
      fixturePlan({ campus: "Malaysia", entries: [entry("TST4001", s2)] }),
      catalog,
    );
    expect(valid.some((issue) => issue.code === "NOT_OFFERED")).toBe(false);
    const unknown = validatePlan(
      fixturePlan({ campus: undefined, entries: [entry("TST4001", s1)] }),
      catalog,
    );
    expect(unknown.some((issue) => issue.code === "CAMPUS_UNSELECTED")).toBe(
      true,
    );
  });
});

describe("course data metrics", () => {
  it("counts only referenced, complete and verified records", () => {
    const catalog = fixtureCatalog();
    const course = catalog.courses[0]!;
    const all = courseDataMetrics(course, catalog);
    expect(all.referencedUnits).toBe(6);
    expect(all.coveragePercent).toBe(100);
    expect(all.verificationPercent).toBe(100);
    catalog.units.TST1001!.offerings = "TODO";
    catalog.units.TST1001!.verified = false;
    catalog.units.TST2001!.verified = false;
    const partial = courseDataMetrics(course, catalog);
    expect(partial.coveredUnits).toBe(5);
    expect(partial.verifiedUnits).toBe(4);
    expect(partial.coveragePercent).toBe(83);
    expect(partial.verificationPercent).toBe(67);
  });
});

describe("replacement equivalence", () => {
  it("accepts the original unit and a direct replacement", () => {
    const catalog = fixtureCatalog();
    expect(satisfiesUnit("TST3004", "TST3004", catalog)).toBe(true);
    expect(satisfiesUnit("TST3004", "TST3005", catalog)).toBe(true);
  });
  it("walks two replacements and rejects unrelated units", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST3005!.replacedBy = "TST3003";
    expect(satisfiesUnit("TST3004", "TST3003", catalog)).toBe(true);
    expect(satisfiesUnit("TST3004", "TST1001", catalog)).toBe(false);
  });
});

describe("requisite evaluation", () => {
  it("returns every all child, including missing conditions", () => {
    const expr: Expr = { all: [{ unit: "TST1001" }, { unit: "TST1002" }] };
    const good = reportFor(
      expr,
      fixturePlan({ entries: [entry("TST1001", s1), entry("TST1002", s1)] }),
    );
    const partial = reportFor(
      expr,
      fixturePlan({ entries: [entry("TST1001", s1)] }),
    );
    expect(good.ok).toBe(true);
    expect(partial.ok).toBe(false);
    expect(partial.children).toHaveLength(2);
    expect(partial.children?.map((child) => child.ok)).toEqual([true, false]);
  });
  it("reports all unsuccessful any branches", () => {
    const node = reportFor(
      { any: [{ unit: "TST1001" }, { unit: "TST1002" }] },
      fixturePlan(),
    );
    expect(node.ok).toBe(false);
    expect(node.children?.map((child) => child.ok)).toEqual([false, false]);
  });
  it("supports atLeast and exact credit thresholds", () => {
    const plan = fixturePlan({
      entries: [entry("TST1001", s1), entry("TST1002", s1)],
    });
    expect(
      reportFor(
        {
          atLeast: {
            n: 2,
            of: [{ unit: "TST1001" }, { unit: "TST1002" }, { unit: "TST1003" }],
          },
        },
        plan,
      ).ok,
    ).toBe(true);
    expect(
      reportFor(
        {
          atLeast: {
            n: 3,
            of: [{ unit: "TST1001" }, { unit: "TST1002" }, { unit: "TST1003" }],
          },
        },
        plan,
      ).ok,
    ).toBe(false);
    expect(reportFor({ minCredits: 12 }, plan).ok).toBe(true);
    expect(reportFor({ minCredits: 18 }, plan).ok).toBe(false);
  });
  it("counts advanced standing and level-specific credits", () => {
    const plan = fixturePlan({
      entries: [entry("TST2001", s1)],
      creditBlocks: [{ label: "Transfer", level: 2, points: 6 }],
    });
    expect(reportFor({ minCredits: 12 }, plan).ok).toBe(true);
    expect(
      reportFor({ minCreditsAtLevel: { level: 2, points: 12 } }, plan).ok,
    ).toBe(true);
    expect(reportFor({ enrolledIn: "C2000" }, plan).ok).toBe(true);
    expect(reportFor({ enrolledIn: "C9999" }, plan).ok).toBe(false);
  });
  it("does not count a same-term prerequisite but does count a corequisite", () => {
    const catalog = fixtureCatalog();
    const subject = unit("TST3999", {
      requisites: {
        prerequisite: { unit: "TST1001" },
        corequisite: { unit: "TST1001" },
        prohibitions: [],
      },
    });
    catalog.units[subject.code] = subject;
    const report = evaluateRequisites(
      subject,
      s1,
      fixturePlan({ entries: [entry("TST1001", s1)] }),
      catalog,
    );
    expect(report.prerequisite.ok).toBe(false);
    expect(report.corequisite.ok).toBe(true);
  });
  it("treats a prohibition as bidirectional and flags unknown rules", () => {
    const catalog = fixtureCatalog();
    const plan = fixturePlan({ entries: [entry("TST1003", s1)] });
    expect(
      evaluateRequisites(catalog.units.TST1001!, s2, plan, catalog).prohibition
        .ok,
    ).toBe(false);
    expect(
      evaluateRequisites(
        catalog.units.TST1003!,
        s2,
        fixturePlan({ entries: [entry("TST1001", s1)] }),
        catalog,
      ).prohibition.ok,
    ).toBe(false);
    catalog.units.TST1001!.requisites.prerequisite = "TODO";
    expect(
      evaluateRequisites(catalog.units.TST1001!, s2, fixturePlan(), catalog)
        .prerequisite.unknown,
    ).toBe(true);
  });
});

describe("progress", () => {
  it("caps 66 level-one points at 60", () => {
    const catalog = fixtureCatalog();
    catalog.courses[0]!.rules = [
      { id: "total", totalCredits: 144 },
      { id: "level1-cap", maxCreditsAtLevel: { level: 1, points: 60 } },
      { id: "level3-min", minCreditsAtLevel: { level: 3, points: 36 } },
    ];
    const entries = Array.from({ length: 11 }, (_, index) => {
      const code = `TST1${String(index + 100).padStart(3, "0")}`;
      catalog.units[code] = unit(code);
      return entry(code, s1, "completed");
    });
    const report = checkProgress(fixturePlan({ entries }), catalog);
    expect(report.actualCredits).toBe(60);
    expect(
      report.actual.find((rule) => rule.id === "course/total")?.message,
    ).toContain("6 level 1 points exceed the cap");
  });
  it("reports partial level-three progress at 30 of 36 points", () => {
    const catalog = fixtureCatalog();
    catalog.courses[0]!.rules[2] = {
      id: "level3-min",
      minCreditsAtLevel: { level: 3, points: 36 },
    };
    const plan = fixturePlan({
      creditBlocks: [{ label: "Transfer", level: 3, points: 30 }],
    });
    expect(
      checkProgress(plan, catalog).actual.find(
        (rule) => rule.id === "course/level3-min",
      )?.status,
    ).toBe("partial");
  });
  it("accepts either pathway and excludes planned units from the actual view", () => {
    const catalog = fixtureCatalog();
    const standard = fixturePlan({
      entries: [entry("TST3002", s2, "completed")],
    });
    const alternative = fixturePlan({
      entries: [entry("TST3003", s2, "completed")],
    });
    expect(
      checkProgress(standard, catalog).actual.find(
        (rule) => rule.id === "major:test-major/path",
      )?.status,
    ).toBe("met");
    expect(
      checkProgress(alternative, catalog).actual.find(
        (rule) => rule.id === "major:test-major/path",
      )?.status,
    ).toBe("met");
    const planned = fixturePlan({ entries: [entry("TST1001", s1, "planned")] });
    expect(checkProgress(planned, catalog).actualCredits).toBe(0);
    expect(checkProgress(planned, catalog).projectedCredits).toBe(6);
  });
});

describe("plan validation", () => {
  const codes = (plan: Plan, catalog: Catalog = fixtureCatalog()) =>
    validatePlan(plan, catalog).map((issue) => issue.code);
  it("detects missing prerequisites and corequisites", () => {
    expect(codes(fixturePlan({ entries: [entry("TST2001", s2)] }))).toContain(
      "PREREQ_UNMET",
    );
    expect(
      codes(fixturePlan({ entries: [entry("TST3001", laterS2)] })),
    ).toContain("COREQ_UNMET");
    expect(
      codes(
        fixturePlan({
          entries: [
            entry("TST1001", s1),
            entry("TST2001", s2),
            entry("TST2002", laterS1),
            entry("TST3001", laterS2),
            entry("TST3002", laterS2),
          ],
        }),
      ),
    ).not.toContain("PREREQ_UNMET");
  });
  it("detects offerings, duplicates, prohibitions and unknown units", () => {
    expect(codes(fixturePlan({ entries: [entry("TST2001", s1)] }))).toContain(
      "NOT_OFFERED",
    );
    expect(
      codes(
        fixturePlan({ entries: [entry("TST1001", s1), entry("TST1001", s2)] }),
      ),
    ).toContain("DUPLICATE_UNIT");
    expect(
      codes(
        fixturePlan({ entries: [entry("TST1001", s1), entry("TST1003", s2)] }),
      ),
    ).toContain("PROHIBITION_CONFLICT");
    expect(codes(fixturePlan({ entries: [entry("TST9999", s1)] }))).toContain(
      "UNKNOWN_UNIT",
    );
    expect(
      codes(fixturePlan({ entries: [entry("TST1001", s1)] })),
    ).not.toContain("PROHIBITION_CONFLICT");
  });
  it("reports replaced units, overloads and unverified data", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST1001!.verified = false;
    expect(
      codes(fixturePlan({ entries: [entry("TST1001", s1)] }), catalog),
    ).toContain("DATA_UNVERIFIED");
    expect(codes(fixturePlan({ entries: [entry("TST3004", s1)] }))).toContain(
      "REPLACED_UNIT",
    );
    expect(
      codes(
        fixturePlan({
          entries: [entry("TST1001", s1), entry("TST1002", s1)],
          maxUnitsPerTerm: 1,
        }),
      ),
    ).toContain("TERM_OVERLOAD");
    expect(
      codes(
        fixturePlan({ entries: [entry("TST1002", s1)], maxUnitsPerTerm: 1 }),
      ),
    ).not.toContain("TERM_OVERLOAD");
  });
  it("uses information notices when catalog rules are unknown", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST1001!.offerings = "TODO";
    catalog.units.TST1001!.requisites.prerequisite = "TODO";
    expect(
      codes(fixturePlan({ entries: [entry("TST1001", s1)] }), catalog),
    ).toEqual(
      expect.arrayContaining(["OFFERING_UNKNOWN", "PREREQUISITE_UNKNOWN"]),
    );
    expect(
      codes(fixturePlan({ entries: [entry("TST1001", s1)] }), catalog),
    ).not.toContain("NOT_OFFERED");
  });
});

describe("automatic scheduling", () => {
  const options = { currentPeriod: { year: 2025, term: "S2" } as Period };
  it("schedules an empty plan deterministically and keeps S2-only units out of S1", () => {
    const catalog = fixtureCatalog();
    const first = autoSchedule(fixturePlan(), catalog, options);
    const second = autoSchedule(fixturePlan(), catalog, options);
    expect(first).toEqual(second);
    expect(first.unscheduled).toEqual([]);
    expect(first.expectedGraduation).not.toBeNull();
    expect(
      first.entries.find((item) => item.unit === "TST2001")?.period.term,
    ).toBe("S2");
    expect(
      first.entries.findIndex((item) => item.unit === "TST1001"),
    ).toBeLessThan(first.entries.findIndex((item) => item.unit === "TST2001"));
    expect(first.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });
  it("prioritises the critical chain and places corequisites together", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST3002!.requisites.prerequisite = { unit: "TST2002" };
    const core = catalog.courses[0]!.majors[0]!.rules[0]!;
    if ("requiredUnits" in core) core.requiredUnits.push("TST1002");
    const result = autoSchedule(fixturePlan(), catalog, options);
    expect(result.entries[0]?.unit).toBe("TST1001");
    expect(
      result.entries.find((item) => item.unit === "TST3001")?.period,
    ).toEqual(result.entries.find((item) => item.unit === "TST3002")?.period);
  });
  it("reports an impossible unit with a reason and keeps fixed entries", () => {
    const catalog = fixtureCatalog();
    catalog.units.TST2001!.requisites.prerequisite = { enrolledIn: "C9999" };
    const result = autoSchedule(
      fixturePlan({ entries: [entry("TST1001", s1, "completed")] }),
      catalog,
      options,
    );
    expect(
      result.unscheduled.find((item) => item.unit === "TST2001")?.reason,
    ).toContain("C9999");
    expect(result.entries.some((item) => item.unit === "TST1001")).toBe(false);
    expect(result.expectedGraduation).toBeNull();
  });
});

describe("plan v1 migration", () => {
  it("migrates original v1 files without guessing a campus", () => {
    const old = {
      schemaVersion: 1,
      course: { code: "C2000", version: 2026, majorId: "test-major" },
      startPeriod: s1,
      entries: [entry("TST1001", s1, "completed")],
      creditBlocks: [{ label: "Advanced standing", level: 1, points: 3 }],
      maxUnitsPerTerm: 4,
      selectedPathway: "Standard pathway",
    };
    const migrated = parsePlanJson(JSON.stringify(old), fixtureCatalog());
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.course).toEqual({
      code: "C2000",
      version: 2026,
      majorIds: ["test-major"],
      minorIds: [],
      specialisationIds: [],
    });
    expect(migrated.campus).toBeNull();
    expect(migrated.entries).toEqual(old.entries);
    expect(migrated.creditBlocks).toEqual(old.creditBlocks);
    expect(migrated.selectedPathways).toEqual({
      "major:test-major/path": "Standard pathway",
    });
    expect(migratePlan(migrated, fixtureCatalog())).toEqual(migrated);
  });

  it("rejects v2-only fields in files labelled v1", () => {
    const legacy = {
      schemaVersion: 1,
      course: { code: "C2000", version: 2026, majorId: "test-major" },
      startPeriod: s1,
      entries: [],
      creditBlocks: [],
      maxUnitsPerTerm: 4,
    };
    const additions = [
      { ...legacy, campus: "Clayton" },
      { ...legacy, selectedPathways: {} },
      { ...legacy, course: { ...legacy.course, majorIds: ["test-major"] } },
      { ...legacy, course: { ...legacy.course, minorIds: [] } },
      { ...legacy, course: { ...legacy.course, specialisationIds: [] } },
    ];
    for (const input of additions) {
      expect(() =>
        parsePlanJson(JSON.stringify(input), fixtureCatalog()),
      ).toThrow();
    }
  });

  it("rejects the removed pathway field in v2 plans", () => {
    const oldField = { ...fixturePlan(), selectedPathway: "Standard pathway" };
    expect(planSchema.safeParse(oldField).success).toBe(false);
    expect(() => migratePlan(oldField, fixtureCatalog())).toThrow();
  });
});

describe("plan import", () => {
  it("round-trips valid JSON and rejects malformed or unsupported versions", () => {
    const plan = fixturePlan();
    expect(parsePlanJson(JSON.stringify(plan), fixtureCatalog())).toEqual(plan);
    expect(() => parsePlanJson("{", fixtureCatalog())).toThrow(
      "not valid JSON",
    );
    expect(() =>
      parsePlanJson(
        JSON.stringify({ ...plan, entries: undefined }),
        fixtureCatalog(),
      ),
    ).toThrow();
    expect(() =>
      parsePlanJson(
        JSON.stringify({ ...plan, maxUnitsPerTerm: "four" }),
        fixtureCatalog(),
      ),
    ).toThrow();
    expect(() =>
      parsePlanJson(
        JSON.stringify({ ...plan, schemaVersion: 3 }),
        fixtureCatalog(),
      ),
    ).toThrow();
    expect(() =>
      parsePlanJson(
        `${JSON.stringify(plan)}${" ".repeat(1_000_001)}`,
        fixtureCatalog(),
      ),
    ).toThrow("1 MB");
  });
});
