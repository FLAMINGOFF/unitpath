# Decisions

## 2026-11-25: Unknown Handbook facts remain unknown

The 2026 course map confirms the degree structure, fixed units, titles, recommended sequence, credit totals, and IBL alternative. It does not confirm all unit requisites, prohibitions, replacements, or actual campus-specific offerings. These fields are `TODO` in seed YAML and all unit records are `verified: false`. The engine distinguishes unknown data from a satisfied rule and automatic scheduling reports blocked units rather than silently assuming eligibility.

The requested elective list has not yet been supplied, so the catalog contains only the 16 standard-pathway units plus FIT3045. Elective slots are explicit placeholders, not invented unit codes.

## 2026-11-25: Pathway preference in the plan

Version 1 plans stored an optional `selectedPathway` for the Standard or IBL choice. Version 2 retains that value during migration and adds `selectedPathways` for rule-specific choices. When neither identifies a branch, the first branch remains the default for stable scheduling and progress displays.

## 2026-11-25: Static routing and CSP

The app uses client routing with a generated `404.html` copy for direct GitHub Pages route access. GitHub Pages does not provide custom response headers, so the Content Security Policy is in an HTML meta tag. It does not replace an HTTP CSP header.

## 2026-11-25: Private source repository, no public deployment

The source repository is private. The Pages workflow has a manual trigger only, so pushing or passing CI does not publish the site. Public deployment remains deferred until the user explicitly authorizes it and the data status is reviewed.

## 2026-11-25: Web interface redesign

The web app was redesigned around a "route ledger" look: warm paper background, ink rules, one highlighter accent, Fraunces for headings, Instrument Sans for text and JetBrains Mono for unit codes. Fonts are bundled from `@fontsource-variable` packages (OFL) so the site still loads nothing from third parties and the same-origin CSP holds. Light and dark themes follow the system setting. Status colours keep the spec mapping (completed green, enrolled/available blue, unknown grey, error red, warning amber) and always come with an icon and a word. On phones the board becomes a vertical list of terms and each card's menu offers "Move to" instead of dragging. That redesign did not change the engine, store or data. The multi-course work below builds on this interface.

## 2026-11-25: Multi-course planning

### Unit identity and credit points

The engine derives a unit's level from the first digit in its code; a YAML `level` value overrides it. This is independent of the unit prefix or degree. Units, credit blocks and credit rules accept positive integer credit points, and progress and validation add their actual values. The 24-cell progress graphic is proportional to the selected course's credit target, not a claim that every unit has six points.

### Course versions and component choices

Each course record is identified by course code and entry-year version. A record can define multiple majors, minors and specialisations; a version 2 Plan stores arrays of the selected ids. The engine evaluates the course's rules and all selected components together. `creditsFromList` counts each completed eligible unit once at its actual credit value and requires at least the declared point threshold. Automatic scheduling leaves an unmet list rule visible for manual choice; it does not invent a unit selection.

### Campus and teaching terms

Offerings are explicit term and campus pairs for Clayton, Caulfield, Peninsula, Malaysia and Online. The Plan stores the chosen campus, and availability checks match both fields. A null campus means unknown, especially after migration, and cannot be treated as evidence that an offering exists. The data schema reserves Summer and Winter, while Plan periods and the v1 interface remain S1/S2 only.

### Scheduling estimates

Elective placeholders are estimates, never catalog units. Their nominal point size uses the lower median of known required units from the selected course and components. If there is no such unit, the scheduler reports that it cannot estimate a slot instead of borrowing a credit value from another course. Graduation remains unknown while a required list rule or elective points are unresolved.

### Setup and existing web design

The PR #9 route-ledger design remains the basis for every changed screen. Setup searches course codes and titles, then exposes available entry-year versions and major/minor/specialisation choices. An absent course shows “暂无数据，欢迎贡献”. The planner graph and default completed-unit picker focus on the selected course; the picker can search the full catalog for an external unit. No degree or subject prefix is singled out in engine or web logic.

### Data contribution and quality signals

Course YAML and unit YAML remain hand-curated. The issue and PR templates ask for sources and unresolved facts, and `data:check` reports file and field context in CI. Per-course coverage is the share of distinct referenced units with complete reviewable fields; verification is the share that are both complete and marked verified. References include course and component rules and suggested sequences. Neither rate covers every possible elective or verifies the course rules themselves. Unknown Handbook facts stay `TODO` and unverified.

### Plan migration

Schema version 2 is canonical. Import and persisted-store hydration migrate valid v1 plans: the old major id becomes a one-element array, known arrays are retained, and an absent campus becomes null rather than a guessed campus. Legacy pathway choice is retained, and the existing browser storage key remains in place so older saved plans can be read. Invalid plans still fail validation.

### Test data and release boundary

The second course is fictional and lives only under the test fixture directory. Its 4- and 8-point units, minor list rule and two campuses test the generic model without presenting invented Monash facts to users. The statement and line coverage gate remains at least 90%. The repository and Codespace preview are private; the Pages workflow remains manual and no public deployment is part of this change.
