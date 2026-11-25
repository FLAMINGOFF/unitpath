# Handbook verification checklist

On 2026-11-25 every unit below was read, one page at a time, from its Monash Handbook 2026 page. Offerings, requisites, prohibitions and credit points were copied from the page's own data. Nothing was taken from memory or other sites. Every record stays `verified: false` until a person compares it with the linked page.

How to verify one unit:

1. Open the Handbook link and compare offerings (semester and campus), prerequisites, corequisites, prohibitions and credit points with the YAML file in `data/units/`.
2. Read the `notes` list. It records Handbook text that UnitPath could not express exactly, and how it was approximated.
3. Fix anything that differs, set `verified: true`, and run `pnpm data:check`.

What UnitPath does not model, by design:

- Teaching periods other than S1, S2 and summer (October intake, November teaching period, Monash Indonesia, IBL terms). They are listed in `notes`.
- Attendance mode (on campus, flexible, blended).
- Alternatives outside the catalogue, such as ENG units. They stay in the expression and read as "not in the UnitPath catalogue".
- `replacedBy` is `null` because each 2026 page lists the unit as offered with no replacement. Check whether the [re-enrolment guidance](https://www.monash.edu/it/current-students/courses/re-enrolment/undergraduate) changes FIT3047/FIT3048 for your cohort.

## Course units (C2000 applied cybersecurity)

| Unit | Title | Status | Interpretation in notes | Source |
| ---- | ----- | ------ | ----------------------- | ------ |
| FIT1045 | Introduction to programming | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT1045) |
| FIT1047 | Introduction to computer systems, networks and security | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT1047) |
| FIT1049 | IT professional practice | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT1049) |
| FIT1057 | Introduction to cybersecurity | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT1057) |
| FIT1093 | Cybersecurity tools and techniques | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT1093) |
| FIT2001 | Systems development | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT2001) |
| FIT2002 | IT project management | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT2002) |
| FIT2094 | Databases | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT2094) |
| FIT2100 | Operating systems | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2100) |
| FIT2165 | Computer networks | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2165) |
| FIT2173 | Software security | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2173) |
| FIT3031 | Network security | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT3031) |
| FIT3045 | Industry-based learning | TODO: offerings, prerequisite | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT3045) |
| FIT3047 | Industry experience studio project 1 | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT3047) |
| FIT3048 | Industry experience studio project 2 | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT3048) |
| FIT3168 | IT forensics | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT3168) |
| FIT3186 | Vulnerability analysis, response and mitigation | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT3186) |

## Electives

These eleven units come from the free elective studies listed on the [C2000 2026 Handbook course page](https://handbook.monash.edu/2026/courses/C2000): FIT1059, FIT3195, and units of the cybersecurity, data science, mobile apps development and human computer interaction minors that are not already in the major. They include four level 3 units so the 36-point level 3 rule can be met.

| Unit | Title | Status | Interpretation in notes | Source |
| ---- | ----- | ------ | ----------------------- | ------ |
| FIT1043 | Introduction to data science | TODO: prerequisite | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT1043) |
| FIT1059 | AI for everyone | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT1059) |
| FIT1060 | Pervasive computing | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT1060) |
| FIT2081 | Mobile application development | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2081) |
| FIT2086 | Modelling for data analysis | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2086) |
| FIT2175 | Usability | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT2175) |
| FIT2179 | Data visualisation | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT2179) |
| FIT3146 | Maker lab | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT3146) |
| FIT3152 | Data analytics | Read, needs check |  | [Handbook](https://handbook.monash.edu/2026/units/FIT3152) |
| FIT3178 | iOS app development | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT3178) |
| FIT3195 | Deep tech entrepreneurship | Read, needs check | Yes | [Handbook](https://handbook.monash.edu/2026/units/FIT3195) |
