import { z } from "zod";

export const termSchema = z.enum(["S1", "S2"]);
export type Term = z.infer<typeof termSchema>;
export const teachingTermSchema = z.enum(["S1", "S2", "Summer", "Winter"]);
export type TeachingTerm = z.infer<typeof teachingTermSchema>;
export const campusSchema = z.enum([
  "Clayton",
  "Caulfield",
  "Peninsula",
  "Malaysia",
  "Online",
]);
export type Campus = z.infer<typeof campusSchema>;
export const offeringSchema = z.strictObject({
  term: teachingTermSchema,
  campus: campusSchema,
});
export type Offering = z.infer<typeof offeringSchema>;

export const periodSchema = z.strictObject({
  year: z.number().int().min(2020).max(2100),
  term: termSchema,
});
export type Period = z.infer<typeof periodSchema>;

export type Expr =
  | { unit: string }
  | { all: Expr[] }
  | { any: Expr[] }
  | { atLeast: { n: number; of: Expr[] } }
  | { minCredits: number }
  | { minCreditsAtLevel: { level: number; points: number } }
  | { enrolledIn: string };

const unitCode = z.string().regex(/^[A-Z]{2,5}\d{4}$/);
export const levelSchema = z.number().int().min(0).max(9);
const level = levelSchema;
const points = z.number().int().nonnegative();

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.strictObject({ unit: unitCode }),
    z.strictObject({ all: z.array(exprSchema).min(1) }),
    z.strictObject({ any: z.array(exprSchema).min(1) }),
    z.strictObject({
      atLeast: z.strictObject({
        n: z.number().int().positive(),
        of: z.array(exprSchema).min(1),
      }),
    }),
    z.strictObject({ minCredits: points }),
    z.strictObject({ minCreditsAtLevel: z.strictObject({ level, points }) }),
    z.strictObject({ enrolledIn: z.string().regex(/^[A-Z]\d{4}$/) }),
  ]),
);

export const unitSchema = z.strictObject({
  code: unitCode,
  title: z.string().min(1),
  creditPoints: z.number().int().positive(),
  level: level.optional(),
  offerings: z.union([z.array(offeringSchema).min(1), z.literal("TODO")]),
  requisites: z.strictObject({
    prerequisite: z.union([exprSchema, z.null(), z.literal("TODO")]),
    corequisite: z.union([exprSchema, z.null(), z.literal("TODO")]),
    prohibitions: z.union([z.array(unitCode), z.literal("TODO")]),
  }),
  replacedBy: z.union([unitCode, z.null(), z.literal("TODO")]),
  source: z.url(),
  verified: z.boolean(),
});
export type Unit = z.infer<typeof unitSchema>;

const requiredUnitsRuleSchema = z.strictObject({
  id: z.string().min(1),
  requiredUnits: z.array(unitCode).min(1),
});
const totalCreditsRuleSchema = z.strictObject({
  id: z.string().min(1),
  totalCredits: points,
});
const maxCreditsAtLevelRuleSchema = z.strictObject({
  id: z.string().min(1),
  maxCreditsAtLevel: z.strictObject({ level, points }),
});
const minCreditsAtLevelRuleSchema = z.strictObject({
  id: z.string().min(1),
  minCreditsAtLevel: z.strictObject({ level, points }),
});
const pathwaySchema = z.strictObject({
  label: z.string().min(1),
  requiredUnits: z.array(unitCode).min(1),
});
const oneOfRuleSchema = z.strictObject({
  id: z.string().min(1),
  oneOf: z.array(pathwaySchema).min(2),
});
const creditsFromListRuleSchema = z.strictObject({
  id: z.string().min(1),
  creditsFromList: z.strictObject({
    units: z.array(unitCode).min(1),
    points: z.number().int().positive(),
  }),
});

export const ruleSchema = z.union([
  requiredUnitsRuleSchema,
  totalCreditsRuleSchema,
  maxCreditsAtLevelRuleSchema,
  minCreditsAtLevelRuleSchema,
  oneOfRuleSchema,
  creditsFromListRuleSchema,
]);
export type Rule = z.infer<typeof ruleSchema>;

export const componentSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  rules: z.array(ruleSchema),
  suggestedSequence: z
    .record(z.string().regex(/^Y\d+S[12]$/), z.array(unitCode))
    .default({}),
});
export const majorSchema = componentSchema;
export type Component = z.infer<typeof componentSchema>;
export type Major = Component;

export const courseSchema = z.strictObject({
  code: z.string().regex(/^[A-Z]\d{4}$/),
  version: z.number().int().min(2020).max(2100),
  title: z.string().min(1),
  source: z.url(),
  rules: z.array(ruleSchema),
  majors: z.array(componentSchema).default([]),
  minors: z.array(componentSchema).default([]),
  specialisations: z.array(componentSchema).default([]),
});
export type Course = z.infer<typeof courseSchema>;

const entrySchema = z.strictObject({
  unit: unitCode,
  period: periodSchema,
  status: z.enum(["completed", "enrolled", "planned"]),
});
const creditBlockSchema = z.strictObject({
  label: z.string().min(1),
  level,
  points: z.number().int().positive(),
});
const planFields = {
  startPeriod: periodSchema,
  entries: z.array(entrySchema),
  creditBlocks: z.array(creditBlockSchema),
  maxUnitsPerTerm: z.number().int().min(1).max(8),
};

export const planV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  course: z.strictObject({
    code: z.string(),
    version: z.number().int(),
    majorId: z.string(),
  }),
  selectedPathway: z.string().optional(),
  ...planFields,
});
export type PlanV1 = z.infer<typeof planV1Schema>;

export const planSchema = z.strictObject({
  schemaVersion: z.literal(2),
  course: z.strictObject({
    code: z.string().regex(/^[A-Z]\d{4}$/),
    version: z.number().int().min(2020).max(2100),
    majorIds: z.array(z.string().min(1)),
    minorIds: z.array(z.string().min(1)),
    specialisationIds: z.array(z.string().min(1)),
  }),
  campus: campusSchema.nullable(),
  selectedPathways: z.record(z.string(), z.string()).default({}),
  ...planFields,
});
export type Plan = z.infer<typeof planSchema>;

export const catalogSchema = z.strictObject({
  units: z.record(unitCode, unitSchema),
  courses: z.array(courseSchema).min(1),
});
export type Catalog = z.infer<typeof catalogSchema>;

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}

function migrateLegacyPathway(
  old: PlanV1,
  catalog: Catalog,
): Record<string, string> {
  if (!old.selectedPathway) return {};
  const course = catalog.courses.find(
    (item) =>
      item.code === old.course.code && item.version === old.course.version,
  );
  if (!course)
    throw new Error("Legacy plan course version is not in the catalog.");
  const major = course.majors.find((item) => item.id === old.course.majorId);
  const candidates = [
    ...course.rules.map((rule) => ({ id: "course/" + rule.id, rule })),
    ...(major?.rules ?? []).map((rule) => ({
      id: "major:" + major!.id + "/" + rule.id,
      rule,
    })),
  ];
  const matches = candidates.filter(
    ({ rule }) =>
      "oneOf" in rule &&
      rule.oneOf.some((branch) => branch.label === old.selectedPathway),
  );
  if (matches.length === 0)
    throw new Error("Legacy pathway is not in the selected course version.");
  return Object.fromEntries(
    matches.map(({ id }) => [id, old.selectedPathway!]),
  );
}

export function migratePlan(input: unknown, catalog: Catalog): Plan {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === 1
  ) {
    const old = planV1Schema.parse(input);
    return planSchema.parse({
      schemaVersion: 2,
      course: {
        code: old.course.code,
        version: old.course.version,
        majorIds: [old.course.majorId],
        minorIds: [],
        specialisationIds: [],
      },
      campus: null,
      startPeriod: old.startPeriod,
      entries: old.entries,
      creditBlocks: old.creditBlocks,
      maxUnitsPerTerm: old.maxUnitsPerTerm,
      selectedPathways: migrateLegacyPathway(old, catalog),
    });
  }
  return planSchema.parse(input);
}

export function parsePlanJson(input: string, catalog: Catalog): Plan {
  if (utf8ByteLength(input) > 1_000_000) {
    throw new Error("Plan file exceeds the 1 MB limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Plan file is not valid JSON.");
  }
  return migratePlan(parsed, catalog);
}
