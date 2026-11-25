# Contributing Monash course data

UnitPath keeps rules in hand-reviewed YAML. Do not scrape the Handbook, infer missing requirements, or copy rules from a different entry year. A missing course should remain unavailable until its source has been checked.

## Files and versions

- Put each unit in `data/units/CODE.yaml`. The filename must match `code`.
- Put each course version in `data/courses/CODE/YEAR.yaml`. The directory and filename must match `code` and `version`. Keep older versions when adding a new entry year.
- The supported shape is defined by `packages/engine/src/schema.ts`. Run `pnpm data:check` to validate files and regenerate `apps/web/src/catalog.json`. Commit the generated catalog with your YAML change.

## Unit records

Every unit needs its official code, title, versioned Handbook `source`, `verified` flag, offerings, requisites and replacement status. `creditPoints` may be omitted, in which case it defaults to 6; if supplied, it must be a positive integer. Credit points do not have to be multiples of six. The first digit in a unit code determines its level; set `level` only when an official source shows a different level.

Each known offering is an object with `term` and `campus`. Campuses are Clayton, Caulfield, Peninsula, Malaysia and Online. Data accepts S1, S2, Summer and Winter; the planner currently offers only S1 and S2. Record each confirmed campus and term pair separately. If offerings are not checked, use `TODO`.

Requisites use expression nodes `unit`, `all`, `any`, `atLeast`, `minCredits`, `minCreditsAtLevel`, `minCreditsFrom` and `enrolledIn`. `minCreditsFrom` takes `points` plus an optional unit code `prefix` (for rules such as "12 credit points of FIT units") and optional `levels`. Prior-credit blocks and elective slots never count toward a prefixed rule. A unit may carry a `notes` list for Handbook text that the expression cannot state exactly; the unit drawer shows it. Use `TODO` for an unchecked prerequisite, corequisite, prohibition list or replacement. Use `null` or an empty prohibition list only after confirming that none exists. Set `verified: true` only when every field has been checked against the linked Handbook version and none remains `TODO`.

## Course rules

A course has `rules` and arrays of `majors`, `minors` and `specialisations`. Each component has an id, title, rules and optional `suggestedSequence`. The planner applies course rules plus every component selected in the Plan. Rules include `requiredUnits`, `totalCredits`, `maxCreditsAtLevel`, `minCreditsAtLevel`, `oneOf` and `creditsFromList`. A `creditsFromList` value contains `units` and a positive integer `points` threshold; eligible units contribute their actual credit points once each.

Use the course map for the exact entry year and official unit pages for unit facts. Cite the official course URL in `source`. If a requirement cannot be represented, open a data issue and leave it unverified rather than approximating it.

## Coverage shown in the app

For each course version, the denominator is the distinct unit codes referenced by its rules, all component rules and suggested sequences. **Coverage** is the share of those units with records whose five reviewable fields (offerings, prerequisite, corequisite, prohibitions, replacement) have no `TODO`. **Verified** is the share with complete fields and `verified: true`. A version with no referenced units displays an em dash. These rates describe the published rule list; they do not measure every possible elective or guarantee that the course rules themselves are correct.

## Before opening a PR

1. Run `pnpm data:check` and read every `ERROR` line. Errors include the file and field; warnings identify incomplete but allowed records.
2. Run `pnpm lint`, `pnpm typecheck` and `pnpm test:coverage`.
3. Describe which Handbook pages and entry year you checked. List every unresolved field as `TODO` and explain it in the PR template.

Use the **New course** issue template to propose a missing course, or **Data correction** for a specific discrepancy. These reports are requests for review, not evidence that a rule is verified.
