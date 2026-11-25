# Decisions

## 2026-11-25: Unknown Handbook facts remain unknown

The 2026 course map confirms the degree structure, fixed units, titles, recommended sequence, credit totals, and IBL alternative. It does not confirm all unit requisites, prohibitions, replacements, or actual campus-specific offerings. These fields are `TODO` in seed YAML and all unit records are `verified: false`. The engine distinguishes unknown data from a satisfied rule and automatic scheduling reports blocked units rather than silently assuming eligibility.

The requested elective list has not yet been supplied, so the catalog contains only the 16 standard-pathway units plus FIT3045. Elective slots are explicit placeholders, not invented unit codes.

## 2026-11-25: Pathway preference in the plan

The plan schema adds optional `selectedPathway` to retain the user's Standard or IBL choice. Older version 1 plans without it remain valid and default to the first branch. This is required for stable scheduling and progress displays after refresh.

## 2026-11-25: Static routing and CSP

The app uses client routing with a generated `404.html` copy for direct GitHub Pages route access. GitHub Pages does not provide custom response headers, so the Content Security Policy is in an HTML meta tag. It does not replace an HTTP CSP header.

## 2026-11-25: Private source repository, no public deployment

The source repository is private. The Pages workflow has a manual trigger only, so pushing or passing CI does not publish the site. Public deployment remains deferred until the user explicitly authorizes it and the data status is reviewed.
