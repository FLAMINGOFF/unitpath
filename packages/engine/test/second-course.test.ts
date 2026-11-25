import { describe, expect, it } from "vitest";
import {
  autoSchedule,
  catalogSchema,
  checkProgress,
  courseDataMetrics,
  validatePlan,
} from "../src";
import {
  secondCourseCatalog,
  secondCoursePlan,
} from "../../../test/fixtures/second-course";

const first = { year: 2028, term: "S1" } as const;
const second = { year: 2028, term: "S2" } as const;
const completed = (unit: string, period: typeof first | typeof second) => ({
  unit,
  period,
  status: "completed" as const,
});

describe("fictional second course", () => {
  it("uses 4 and 8 point units for total, level and minor list rules", () => {
    const catalog = secondCourseCatalog();
    expect(catalogSchema.safeParse(catalog).success).toBe(true);
    const plan = secondCoursePlan({
      entries: [
        completed("SYN1001", first),
        completed("SYN1002", first),
        completed("SYN2001", second),
        completed("SYN2002", second),
      ],
    });
    const report = checkProgress(plan, catalog);
    expect(report.actualCredits).toBe(20);
    expect(report.actual.find((rule) => rule.id === "level-two")?.current).toBe(
      12,
    );
    expect(
      report.actual.find((rule) => rule.id === "minor-list")?.current,
    ).toBe(8);
    expect(report.actual.every((rule) => rule.status === "met")).toBe(true);
    expect(
      validatePlan(plan, catalog).filter((issue) => issue.level === "error"),
    ).toEqual([]);
    expect(
      courseDataMetrics(catalog.courses[0]!, catalog).coveragePercent,
    ).toBe(100);
  });

  it("validates both campus and teaching period", () => {
    const catalog = secondCourseCatalog();
    const entry = completed("SYN1002", first);
    expect(
      validatePlan(secondCoursePlan({ entries: [entry] }), catalog).some(
        (issue) => issue.code === "NOT_OFFERED",
      ),
    ).toBe(false);
    expect(
      validatePlan(
        secondCoursePlan({ campus: "Clayton", entries: [entry] }),
        catalog,
      ).some((issue) => issue.code === "NOT_OFFERED"),
    ).toBe(true);
    expect(
      validatePlan(
        secondCoursePlan({ campus: null, entries: [entry] }),
        catalog,
      ).some((issue) => issue.code === "CAMPUS_UNSELECTED"),
    ).toBe(true);
  });

  it("keeps an unsatisfied minor list visible instead of claiming graduation", () => {
    const result = autoSchedule(secondCoursePlan(), secondCourseCatalog(), {
      currentPeriod: { year: 2027, term: "S2" },
    });
    expect(result.entries.map((entry) => entry.unit)).toContain("SYN2001");
    expect(
      result.unscheduled.some(
        (item) =>
          item.unit === "minor-list" && item.reason.includes("8 credit points"),
      ),
    ).toBe(true);
    expect(result.expectedGraduation).toBeNull();
  });
});
