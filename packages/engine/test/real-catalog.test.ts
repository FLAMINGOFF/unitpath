import { describe, expect, it } from "vitest";
import rawCatalog from "../../../apps/web/src/catalog.json";
import {
  autoSchedule,
  catalogSchema,
  checkProgress,
  periodOrdinal,
  toPlanSlots,
  validatePlan,
  type Plan,
} from "../src";

const catalog = catalogSchema.parse(rawCatalog);

function emptyPlan(changes: Partial<Plan> = {}): Plan {
  return {
    schemaVersion: 2,
    course: {
      code: "C2000",
      version: 2026,
      majorIds: ["applied-cybersecurity"],
      minorIds: [],
      specialisationIds: [],
    },
    campus: "Clayton",
    startPeriod: { year: 2026, term: "S1" },
    entries: [],
    creditBlocks: [],
    maxUnitsPerTerm: 4,
    selectedPathways: {},
    ...changes,
  };
}
const options = { currentPeriod: { year: 2025, term: "S2" as const } };

describe("real Handbook catalogue", () => {
  it("records a Handbook source for every unit and keeps all unverified", () => {
    for (const unit of Object.values(catalog.units)) {
      expect(unit.source).toBe(
        `https://handbook.monash.edu/2026/units/${unit.code}`,
      );
      expect(unit.verified).toBe(false);
    }
  });

  it("auto-schedules C2000 applied cybersecurity into six terms with no errors", () => {
    const result = autoSchedule(emptyPlan(), catalog, options);
    expect(result.unscheduled).toEqual([]);
    expect(result.expectedGraduation).toEqual({ year: 2028, term: "S2" });
    expect(result.issues.filter((issue) => issue.level === "error")).toEqual(
      [],
    );
    const terms = new Set(
      [...result.entries, ...result.placeholders].map((item) =>
        periodOrdinal(item.period),
      ),
    );
    expect(terms.size).toBe(6);
    const points =
      result.entries.reduce(
        (sum, entry) => sum + catalog.units[entry.unit]!.creditPoints,
        0,
      ) + result.placeholders.reduce((sum, slot) => sum + slot.points, 0);
    expect(points).toBe(144);
  });

  it("keeps the applied schedule free of errors once its elective slots are saved", () => {
    const result = autoSchedule(emptyPlan(), catalog, options);
    const applied = emptyPlan({
      entries: result.entries,
      electiveSlots: toPlanSlots(result.placeholders),
    });
    expect(
      validatePlan(applied, catalog).filter((issue) => issue.level === "error"),
    ).toEqual([]);
    // Without the slots, the studio unit's 90-point rule is honestly unmet.
    const withoutSlots = emptyPlan({ entries: result.entries });
    expect(
      validatePlan(withoutSlots, catalog).some(
        (issue) => issue.unit === "FIT3047" && issue.code === "PREREQ_UNMET",
      ),
    ).toBe(true);
  });

  it("reports the IBL pathway as blocked by unverified teaching periods", () => {
    const result = autoSchedule(
      emptyPlan({
        selectedPathways: {
          "major:applied-cybersecurity/studio-or-ibl":
            "Industry Based Learning",
        },
      }),
      catalog,
      options,
    );
    expect(result.unscheduled).toContainEqual({
      unit: "FIT3045",
      reason: "Teaching periods have not been verified.",
    });
    expect(result.expectedGraduation).toBeNull();
  });

  it("runs progress and validation on the empty plan without throwing", () => {
    expect(() => checkProgress(emptyPlan(), catalog)).not.toThrow();
    expect(validatePlan(emptyPlan(), catalog)).toEqual([]);
  });
});
