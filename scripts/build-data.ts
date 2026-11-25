import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { ZodError } from "zod";
import {
  courseSchema,
  type Catalog,
  type Course,
  type Expr,
  type Unit,
  unitSchema,
} from "../packages/engine/src/schema";

const root = resolve(
  process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url)),
);
const unitsDir = join(root, "data/units");
const coursesDir = join(root, "data/courses");
const errors: string[] = [];
const warnings: string[] = [];

function parseError(file: string, error: unknown): void {
  const path = relative(root, file);
  if (error instanceof ZodError) {
    for (const issue of error.issues)
      errors.push(
        path + ":" + (issue.path.join(".") || "(root)") + ": " + issue.message,
      );
  } else
    errors.push(
      path + ": " + (error instanceof Error ? error.message : String(error)),
    );
}

function unitRefs(expr: Expr | null | "TODO"): string[] {
  if (!expr || expr === "TODO") return [];
  if ("unit" in expr) return [expr.unit];
  if ("all" in expr) return expr.all.flatMap(unitRefs);
  if ("any" in expr) return expr.any.flatMap(unitRefs);
  if ("atLeast" in expr) return expr.atLeast.of.flatMap(unitRefs);
  return [];
}

function checkGraph(edges: Map<string, string[]>, label: string): void {
  const active = new Set<string>();
  const visited = new Set<string>();
  function visit(node: string, path: string[]): void {
    if (active.has(node)) {
      errors.push(`${label} cycle: ${[...path, node].join(" -> ")}`);
      return;
    }
    if (visited.has(node)) return;
    active.add(node);
    for (const next of edges.get(node) ?? []) visit(next, [...path, node]);
    active.delete(node);
    visited.add(node);
  }
  for (const node of [...edges.keys()].sort()) visit(node, []);
}

async function collectCourseFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...(await collectCourseFiles(path)));
    else if (item.name.endsWith(".yaml")) files.push(path);
  }
  return files.sort();
}

async function main(): Promise<void> {
  const units: Record<string, Unit> = {};
  for (const name of (await readdir(unitsDir))
    .filter((file) => file.endsWith(".yaml"))
    .sort()) {
    const file = join(unitsDir, name);
    try {
      const unit = unitSchema.parse(YAML.parse(await readFile(file, "utf8")));
      if (basename(name, ".yaml") !== unit.code)
        errors.push(`${name}: filename does not match code ${unit.code}`);
      if (units[unit.code]) errors.push(`${name}: duplicate unit ${unit.code}`);
      units[unit.code] = unit;
      if (!unit.verified) warnings.push(`${unit.code}: unverified`);
      const unknownFields: string[] = [];
      for (const field of [
        "offerings",
        "prerequisite",
        "corequisite",
        "prohibitions",
        "replacedBy",
      ] as const) {
        const value =
          field === "offerings" || field === "replacedBy"
            ? unit[field]
            : unit.requisites[field];
        if (value === "TODO") {
          warnings.push(`${unit.code}: ${field} TODO`);
          unknownFields.push(field);
        }
      }
      if (unit.verified && unknownFields.length)
        errors.push(
          `data/units/${unit.code}.yaml:verified: cannot be true while ${unknownFields.join(", ")} is TODO`,
        );
    } catch (error) {
      parseError(file, error);
    }
  }
  const courses: Course[] = [];
  const courseKeys = new Set<string>();
  for (const file of await collectCourseFiles(coursesDir)) {
    try {
      const course = courseSchema.parse(
        YAML.parse(await readFile(file, "utf8")),
      );
      if (
        basename(file, ".yaml") !== String(course.version) ||
        basename(resolve(file, "..")) !== course.code
      ) {
        errors.push(
          `${file}: path must match ${course.code}/${course.version}.yaml`,
        );
      }
      const key = course.code + "/" + course.version;
      if (courseKeys.has(key))
        errors.push(relative(root, file) + ": duplicate course version " + key);
      courseKeys.add(key);
      courses.push(course);
    } catch (error) {
      parseError(file, error);
    }
  }
  const prereqEdges = new Map<string, string[]>();
  const replacementEdges = new Map<string, string[]>();
  for (const unit of Object.values(units)) {
    const references = [
      ...unitRefs(unit.requisites.prerequisite),
      ...unitRefs(unit.requisites.corequisite),
      ...(unit.requisites.prohibitions === "TODO"
        ? []
        : unit.requisites.prohibitions),
    ];
    if (
      unit.replacedBy &&
      unit.replacedBy !== "TODO" &&
      !units[unit.replacedBy]
    )
      errors.push(
        `data/units/${unit.code}.yaml: missing referenced unit ${unit.replacedBy}`,
      );
    // Handbook requisites often name alternatives outside this catalogue
    // (other faculties, retired codes). They stay as unmet references, which is
    // the honest reading, and are reported as warnings rather than errors.
    for (const reference of references)
      if (!units[reference])
        warnings.push(
          `${unit.code}: references ${reference}, which is not in the catalogue`,
        );
    prereqEdges.set(unit.code, unitRefs(unit.requisites.prerequisite));
    replacementEdges.set(
      unit.code,
      unit.replacedBy && unit.replacedBy !== "TODO" ? [unit.replacedBy] : [],
    );
  }
  for (const course of courses) {
    const courseFile = `data/courses/${course.code}/${course.version}.yaml`;
    const seenRuleIds = new Set<string>();
    const components = [
      ...course.majors,
      ...course.minors,
      ...course.specialisations,
    ];
    for (const component of components) {
      for (const codes of Object.values(component.suggestedSequence)) {
        for (const code of codes)
          if (!units[code])
            errors.push(
              `data/courses/${course.code}/${course.version}.yaml:${component.id}: missing sequence unit ${code}`,
            );
      }
    }
    for (const rule of [
      ...course.rules,
      ...components.flatMap((component) => component.rules),
    ]) {
      if (seenRuleIds.has(rule.id))
        errors.push(`${courseFile}: duplicate rule id ${rule.id}`);
      seenRuleIds.add(rule.id);
      const refs =
        "requiredUnits" in rule
          ? rule.requiredUnits
          : "oneOf" in rule
            ? rule.oneOf.flatMap((branch) => branch.requiredUnits)
            : "creditsFromList" in rule
              ? rule.creditsFromList.units
              : [];
      for (const code of refs)
        if (!units[code])
          errors.push(
            `data/courses/${course.code}/${course.version}.yaml:${rule.id}: missing referenced unit ${code}`,
          );
    }
  }
  checkGraph(prereqEdges, "Prerequisite");
  checkGraph(replacementEdges, "Replacement");
  if (errors.length) {
    for (const error of errors) {
      console.error(`ERROR ${error}`);
      if (process.env.GITHUB_ACTIONS) {
        const file = error.match(/^([^:]+):/)?.[1];
        console.error(
          `::error${file ? ` file=${file}` : ""}::${error.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`,
        );
      }
    }
    process.exitCode = 1;
    return;
  }
  const catalog: Catalog = { units, courses };
  await writeFile(
    join(root, "apps/web/src/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  console.log(
    `Catalog valid: ${Object.keys(units).length} units, ${courses.length} course version(s).`,
  );
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

await main();
