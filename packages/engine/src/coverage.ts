import type { Catalog, Course, Rule, Unit } from "./schema";

export type CourseDataMetrics = {
  referencedUnits: number;
  coveredUnits: number;
  verifiedUnits: number;
  coveragePercent: number | null;
  verificationPercent: number | null;
};

function ruleUnits(rule: Rule): string[] {
  if ("requiredUnits" in rule) return rule.requiredUnits;
  if ("oneOf" in rule)
    return rule.oneOf.flatMap((branch) => branch.requiredUnits);
  if ("creditsFromList" in rule) return rule.creditsFromList.units;
  return [];
}

function complete(unit: Unit): boolean {
  return (
    unit.offerings !== "TODO" &&
    unit.requisites.prerequisite !== "TODO" &&
    unit.requisites.corequisite !== "TODO" &&
    unit.requisites.prohibitions !== "TODO" &&
    unit.replacedBy !== "TODO"
  );
}

export function courseUnitCodes(course: Course): string[] {
  const components = [
    ...course.majors,
    ...course.minors,
    ...course.specialisations,
  ];
  return [
    ...new Set([
      ...course.rules.flatMap(ruleUnits),
      ...components.flatMap((component) => component.rules.flatMap(ruleUnits)),
      ...components.flatMap((component) =>
        Object.values(component.suggestedSequence).flat(),
      ),
    ]),
  ].sort();
}

export function courseDataMetrics(
  course: Course,
  catalog: Catalog,
): CourseDataMetrics {
  const referenced = new Set(courseUnitCodes(course));
  const records = [...referenced]
    .map((code) => catalog.units[code])
    .filter((unit): unit is Unit => unit !== undefined);
  const coveredUnits = records.filter(complete).length;
  const verifiedUnits = records.filter(
    (unit) => unit.verified && complete(unit),
  ).length;
  const referencedUnits = referenced.size;
  return {
    referencedUnits,
    coveredUnits,
    verifiedUnits,
    coveragePercent: referencedUnits
      ? Math.round((100 * coveredUnits) / referencedUnits)
      : null,
    verificationPercent: referencedUnits
      ? Math.round((100 * verifiedUnits) / referencedUnits)
      : null,
  };
}
