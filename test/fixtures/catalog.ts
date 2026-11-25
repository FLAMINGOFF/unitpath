import type { Catalog, Plan, Unit } from "../../packages/engine/src/schema";

export function unit(code: string, changes: Partial<Unit> = {}): Unit {
  return {
    code,
    title: code,
    creditPoints: 6,
    offerings: ["S1", "S2"],
    requisites: { prerequisite: null, corequisite: null, prohibitions: [] },
    replacedBy: null,
    source: `https://example.com/${code}`,
    verified: true,
    ...changes,
  };
}

export function fixtureCatalog(): Catalog {
  const units = [
    unit("TST1001", { offerings: ["S1"] }),
    unit("TST1002"),
    unit("TST1003", {
      requisites: {
        prerequisite: null,
        corequisite: null,
        prohibitions: ["TST1001"],
      },
    }),
    unit("TST2001", {
      offerings: ["S2"],
      requisites: {
        prerequisite: { unit: "TST1001" },
        corequisite: null,
        prohibitions: [],
      },
    }),
    unit("TST2002", {
      offerings: ["S1"],
      requisites: {
        prerequisite: { unit: "TST2001" },
        corequisite: null,
        prohibitions: [],
      },
    }),
    unit("TST3001", {
      offerings: ["S2"],
      requisites: {
        prerequisite: { unit: "TST2002" },
        corequisite: { unit: "TST3002" },
        prohibitions: [],
      },
    }),
    unit("TST3002", { offerings: ["S2"] }),
    unit("TST3003"),
    unit("TST3004", { replacedBy: "TST3005" }),
    unit("TST3005"),
  ];
  return {
    units: Object.fromEntries(units.map((item) => [item.code, item])),
    courses: [
      {
        code: "C2000",
        version: 2026,
        title: "Test degree",
        source: "https://example.com/course",
        rules: [
          { id: "total", totalCredits: 36 },
          { id: "level1-cap", maxCreditsAtLevel: { level: 1, points: 24 } },
          { id: "level3-min", minCreditsAtLevel: { level: 3, points: 6 } },
        ],
        majors: [
          {
            id: "test-major",
            title: "Test major",
            rules: [
              {
                id: "core",
                requiredUnits: ["TST1001", "TST2001", "TST2002", "TST3001"],
              },
              {
                id: "path",
                oneOf: [
                  { label: "Standard pathway", requiredUnits: ["TST3002"] },
                  { label: "Alternative pathway", requiredUnits: ["TST3003"] },
                ],
              },
            ],
            suggestedSequence: {
              Y1S1: ["TST1001"],
              Y1S2: ["TST2001"],
              Y2S1: ["TST2002"],
              Y2S2: ["TST3001", "TST3002"],
            },
          },
        ],
      },
    ],
  };
}

export function fixturePlan(changes: Partial<Plan> = {}): Plan {
  return {
    schemaVersion: 1,
    course: { code: "C2000", version: 2026, majorId: "test-major" },
    startPeriod: { year: 2026, term: "S1" },
    entries: [],
    creditBlocks: [],
    maxUnitsPerTerm: 4,
    selectedPathway: "Standard pathway",
    ...changes,
  };
}
