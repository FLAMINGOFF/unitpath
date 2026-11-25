# Decisions

## 2026-11-25: Unknown Handbook facts remain unknown

The 2026 course map confirms the degree structure, fixed units, titles, recommended sequence, credit totals, and IBL alternative. It does not confirm all unit requisites, prohibitions, replacements, or actual campus-specific offerings. These fields are `TODO` in seed YAML and all unit records are `verified: false`. The engine distinguishes unknown data from a satisfied rule and automatic scheduling reports blocked units rather than silently assuming eligibility.

The requested elective list has not yet been supplied, so the catalog contains only the 16 standard-pathway units plus FIT3045. Elective slots are explicit placeholders, not invented unit codes.

## 2026-11-25: Pathway preference in the plan

Version 1 plans stored an optional `selectedPathway` for a single choice. Version 2 stores only `selectedPathways`, keyed by scoped rule id such as `course/total` or `major:applied-cybersecurity/path`. Migration uses the exact course version and legacy major to map the old label to matching `oneOf` rules; an unknown label is rejected rather than guessed. When no choice is stored, the first branch remains the stable default for progress and scheduling.

## 2026-11-25: Static routing and CSP

The app uses client routing with a generated `404.html` copy for direct GitHub Pages route access. GitHub Pages does not provide custom response headers, so the Content Security Policy is in an HTML meta tag. It does not replace an HTTP CSP header. Production CSP permits only same-origin connections; the development server adds `ws:` to this directive for Vite hot reload.

## 2026-11-25: Private source repository, no public deployment

The source repository is private. The Pages workflow has a manual trigger only, so pushing or passing CI does not publish the site. Public deployment remains deferred until the user explicitly authorizes it and the data status is reviewed.

## 2026-11-25: Web interface redesign

The web app was redesigned around a "route ledger" look: warm paper background, ink rules, one highlighter accent, Fraunces for headings, Instrument Sans for text and JetBrains Mono for unit codes. Fonts are bundled from `@fontsource-variable` packages (OFL) so the site still loads nothing from third parties and the same-origin CSP holds. Light and dark themes follow the system setting. Status colours keep the spec mapping (completed green, enrolled/available blue, unknown grey, error red, warning amber) and always come with an icon and a word. On phones the board becomes a vertical list of terms and each card's menu offers "Move to" instead of dragging. That redesign did not change the engine, store or data. The multi-course work below builds on this interface.

## 2026-11-25: Multi-course planning

### Unit identity and credit points

Engine sorting uses ordinal string comparison rather than locale-sensitive collation, so issue and schedule ordering is deterministic across hosts. The engine derives a unit's level from the first digit in its code; a YAML `level` value overrides it. This is independent of the unit prefix or degree. Unit `creditPoints` defaults to 6 when omitted from YAML and otherwise accepts any positive integer; credit blocks and credit rules use positive integer points. Progress and validation add actual parsed values. The 24-cell progress graphic is proportional to the selected course's credit target, not a claim that every unit has six points.

### Course versions and component choices

Each course record is identified by course code and Handbook year. Entry year is independent and may differ from the Handbook version: setup initially selects the newest available version no later than entry year, permits a manual version choice, and warns when exact-year data is absent. The caller supplies the current year; the engine does not read the clock. A record can define multiple majors, minors and specialisations; a version 2 Plan stores arrays of the selected ids. The engine evaluates the course rules and all selected components together. Raw rule ids must be unique within a course version across course and component rules; evaluated ids add `course/`, `major:<id>/`, `minor:<id>/` or `specialisation:<id>/` so selections cannot collide.

### List credits and rule overlap

`creditsFromList` counts each completed eligible unit once within that rule, using its actual credit value. It never adds units to automatic schedules: the student must choose eligible units manually. By default, the same unit may satisfy more than one separate rule, including overlapping list and major requirements; there is no implicit exclusive allocation or double-count prohibition.

### Campus and teaching terms

Offerings are explicit term and campus pairs for Clayton, Caulfield, Peninsula, Malaysia and Online. The Plan stores the chosen campus, and availability checks match both fields. A null campus means unknown, especially after migration, and cannot be treated as evidence that an offering exists. The data schema reserves Summer and Winter, while Plan periods and the v1 interface remain S1/S2 only.

### Scheduling estimates

Elective placeholders are estimates, never catalog units. Their nominal point size uses the lower median of known required units from the selected course and components. If there is no such unit, the scheduler reports that it cannot estimate a slot instead of borrowing a credit value from another course. Graduation remains unknown while a required list rule or elective points are unresolved. When selected components suggest units in the same term, their arrays merge in component order with duplicate unit codes removed.

### Setup and existing web design

The PR #9 route-ledger design remains the basis for every changed screen. Setup uses the existing unit tile styling for component checkboxes and a consistent vertical gap between controls. Setup searches course codes and titles, then exposes available entry-year versions and major/minor/specialisation choices. An absent course shows an English contribution prompt. The planner graph and default completed-unit picker focus on the selected course; the picker can search the full catalog for an external unit. No degree or subject prefix is singled out in engine or web logic.

### Data contribution and quality signals

Course YAML and unit YAML remain hand-curated. The issue and PR templates ask for sources and unresolved facts, and `data:check` reports file and field context in CI. Per-course coverage is the share of distinct referenced units with complete reviewable fields; verification is the share that are both complete and marked verified. References include course and component rules and suggested sequences. Neither rate covers every possible elective or verifies the course rules themselves. Unknown Handbook facts stay `TODO` and unverified.

### Plan migration

Schema version 2 is canonical. Import and persisted-store hydration migrate valid v1 plans: the old major id becomes a one-element array and campus becomes null rather than a guessed campus. The strict v1 parser rejects new v2 fields such as campus or component arrays when a file claims to be v1. Legacy pathway choice is converted to scoped `selectedPathways` keys, and the existing browser storage key remains in place so older saved plans can be read. Invalid plans still fail validation.

### Test data and release boundary

The second course is fictional and lives only under the test fixture directory. Its 4- and 8-point units, minor list rule and two campuses test the generic model without presenting invented Monash facts to users. The statement and line coverage gate remains at least 90%. The repository and Codespace preview are private; the Pages workflow remains manual and no public deployment is part of this change.

## 2026-11-25: Handbook 2026 unit data

### Source and status

The 17 C2000 applied cybersecurity units and eleven electives were read from their Monash Handbook 2026 pages, one page at a time, in a normal browser session. There is still no crawler: adding a unit means reading its page. Each record links to its page and stays `verified: false` until a person checks it (see `docs/VERIFY.md`). Two fields stay `TODO` because the Handbook does not state them in a form the model can hold: FIT3045 offerings (IBL-specific Term 2 and Term 4) and prerequisite (entry by selection), and the FIT1043 prerequisite (it accepts a VCE result).

The eleven electives are the free elective options listed on the C2000 2026 course page that are not already in the major: FIT1059 and FIT3195, plus the data science, mobile apps development and human computer interaction minor units. Four are level 3.

The IBL description on the course page says the placement replaces the applied studies project units and the nominated level 3 unit in the major, which matches the course map's `oneOf` between FIT3047, FIT3048 and FIT3031 and FIT3045 alone. The course rules were not changed.

### What is approximated

- Teaching periods other than S1, S2 and summer semester B are left out and listed in the unit's `notes`. Summer semester B is stored as `Summer`.
- Requisites that name units outside the catalogue, such as ENG1013, keep those codes. `data:check` reports them as warnings instead of errors, and the engine explains them as "not in the UnitPath catalogue". A missing `replacedBy` target is still an error.
- Text rules such as "12 credit points of FIT units" use the new `minCreditsFrom` node. FIT3047's "additional 12 points of FIT level 1 and 12 of level 2 or 3" is read as 30 and 30 points including the named units. The interpretation is written in each unit's `notes`.
- Course restrictions ("must be core in your degree", "available to BIT, BCS and BSE students") are not checked and are written in `notes`.

### Elective slots are saved with the plan

Real rules such as "90 credit points before FIT3047" depend on electives a student has not chosen yet. Applying an automatic schedule now saves its elective slots in the plan as `electiveSlots` (optional, so older files still load). A slot counts toward generic credit thresholds in later terms and toward the term load, but never toward a prefixed rule and never toward degree progress, which counts only real units. Adding a unit to a full term replaces one of its slots. Without this, an applied schedule would immediately show a false error on FIT3047.

## 2026-11-25: Public deployment

This supersedes "Private source repository, no public deployment". The owner chose to make the repository public so GitHub Pages can host the site for free. The full history was scanned for credentials before that step and none were found. Deploy Pages now runs after CI succeeds on a push to `main` and skips itself while the repository is private, so it never fails noisily. Unit data stays marked unverified on the site until a person checks it, and every page shows that warning.
