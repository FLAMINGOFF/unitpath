import type { Catalog, Plan } from "../../packages/engine/src/schema";
import { unit } from "./catalog";

/** Fictional data for tests only. Never publish as a Monash course. */
export function secondCourseCatalog(): Catalog {
  const units = [
    unit("SYN1001", {
      creditPoints: 4,
      offerings: [
        { term: "S1", campus: "Clayton" },
        { term: "S1", campus: "Malaysia" },
      ],
    }),
    unit("SYN2001", {
      creditPoints: 8,
      offerings: [
        { term: "S2", campus: "Clayton" },
        { term: "S2", campus: "Malaysia" },
      ],
      requisites: {
        prerequisite: { unit: "SYN1001" },
        corequisite: null,
        prohibitions: [],
      },
    }),
    unit("SYN1002", {
      creditPoints: 4,
      offerings: [{ term: "S1", campus: "Malaysia" }],
    }),
    unit("SYN2002", {
      creditPoints: 4,
      offerings: [{ term: "S2", campus: "Malaysia" }],
    }),
  ];
  return {
    units: Object.fromEntries(units.map((item) => [item.code, item])),
    courses: [
      {
        code: "Z9999",
        version: 2028,
        title: "Fictional multi-campus degree (test only)",
        source: "https://example.com/fictional-course",
        rules: [
          { id: "total", totalCredits: 20 },
          { id: "level-two", minCreditsAtLevel: { level: 2, points: 12 } },
        ],
        majors: [
          {
            id: "synthetic-major",
            title: "Synthetic major",
            rules: [
              { id: "major-core", requiredUnits: ["SYN1001", "SYN2001"] },
            ],
            suggestedSequence: { Y1S1: ["SYN1001"], Y1S2: ["SYN2001"] },
          },
        ],
        minors: [
          {
            id: "synthetic-minor",
            title: "Synthetic minor",
            rules: [
              {
                id: "minor-list",
                creditsFromList: { units: ["SYN1002", "SYN2002"], points: 8 },
              },
            ],
            suggestedSequence: {},
          },
        ],
        specialisations: [],
      },
    ],
  };
}

export function secondCoursePlan(changes: Partial<Plan> = {}): Plan {
  return {
    schemaVersion: 2,
    course: {
      code: "Z9999",
      version: 2028,
      majorIds: ["synthetic-major"],
      minorIds: ["synthetic-minor"],
      specialisationIds: [],
    },
    campus: "Malaysia",
    startPeriod: { year: 2028, term: "S1" },
    entries: [],
    creditBlocks: [],
    maxUnitsPerTerm: 4,
    selectedPathways: {},
    ...changes,
  };
}
