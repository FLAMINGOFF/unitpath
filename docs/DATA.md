# Catalog data

Each unit lives in `data/units/CODE.yaml`. Each course version lives in `data/courses/CODE/YEAR.yaml`. Run `pnpm data:check` after editing. The build validates each YAML file, references, prerequisite cycles, replacement cycles, and file names before writing `apps/web/src/catalog.json`.

`source` is required for every unit. Use the versioned Monash Handbook URL and set `verified: true` only after checking all fields against that page and relevant re-enrolment guidance. `TODO` is allowed for an unknown offering, prerequisite, corequisite, prohibition list, or replacement. `null` means a checked absence, so do not use it for an unreviewed field. The build lists all `TODO` and unverified records.

Supported expression nodes are `unit`, `all`, `any`, `atLeast`, `minCredits`, `minCreditsAtLevel`, and `enrolledIn`. Requirements are data, so new course versions can be added without changing engine code. See `packages/engine/src/schema.ts` for exact validation rules.

The current seed data includes only the fixed Applied cybersecurity units and FIT3045. Add electives only after choosing and checking their official unit pages. For campus-specific offerings, include only S1 and S2 periods applicable to the intended student cohort; this v1 model cannot represent a campus or non-standard teaching period.
