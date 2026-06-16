---
title: BPMN Linter Score
---

# BPMN Linter Score

The **Linter Score** measures how closely the current diagram matches the **active lint ruleset**. It is a **percentage** derived from per-element penalties. **Info-level** findings do not affect the score.

## When scores are calculated

While the BPMN linter is **enabled**, scores are recomputed after each debounced lint run (after you edit the diagram). The **Linter Score** pane and the floating issue badge show the latest result for the **active ruleset** only.

## How the percentage is built

1. **Score points (denominator)** — Each “scorable” diagram element (BPMN shapes and flows on the canvas, excluding the diagram root and label artifacts) contributes **one** point. If any finding cannot be tied to a canvas element, it is grouped into a single **diagram-level** bucket; when that bucket is used, it adds **one** extra point so process-wide issues are not free.

2. **Penalties (per element / bucket)** — For each element (or the diagram bucket), at most **one** penalty applies:
   - **1 point** if there is at least one **error**-severity finding on that element.
   - **0.5 points** if there is at least one **warning** and **no** errors on that element.
   - Multiple findings on the same element still count as **one** penalty (errors beat warnings).

3. **Formula** — `remainingPoints = maxPoints − sum(penalties)`, then  
   `scorePercent = max(0, (remainingPoints / maxPoints) × 100)`  
   Display uses **one decimal** (e.g. `95.5%`).

### Example

With **100** scorable elements and **no** diagram-level bucket: `maxPoints = 100`. Five distinct elements each have an error → penalty **5** → **95%**.

## Compliance bands (valid / risky / failed)

Each ruleset carries a **score policy**:

- **Valid (green)** — score **≥** `validMinPercent` (unless an instant rule overrides).
- **Risky (orange)** — score **≥** `riskyMinPercent` but **below** `validMinPercent`, or **instant risk** when enabled.
- **Failed (red)** — score **below** `riskyMinPercent`, **instant fail** when enabled, or any other failing rule.

**Instant fail** — if enabled, **any** error-level finding forces **failed**, regardless of percentage.

**Instant risk** — if enabled, **any** warning with **zero** errors forces **risky**, regardless of percentage.

Built-in profiles ship with defaults (Development is more lenient; Production Ready is stricter). Custom rulesets can override `scorePolicy` in settings JSON.

## Engine and deployment

Scores are written into the **BPMN file** under the `definitions` element so the diagram remains the **single source of truth** when you deploy or upload it to an **execution engine** (any vendor).

A deployment gateway can read those values and combine them with **engine configuration** to **accept or reject** uploads—for example: “require **100%** score on the **bpmn-production-ready** profile with **zero** errors.”

Scores are **not** stored only in Studio settings: sidecar files or local app storage would **not** travel with the artifact the engine receives.

### Trust and verification

Embedded scores reflect the **last Studio lint** for each persisted ruleset entry. A security-conscious engine may still **re-run linting** server-side if it does not trust client-supplied metadata.

### XML location (integrators)

- **Namespace URI:** `https://evil.studio/schema/bpmn/platform/1.0`
- **Prefix:** `evil`
- **Under** `bpmn:definitions` → `bpmn:extensionElements` → `evil:properties`
- **Children:** repeating `evil:linterRulesetScore` elements with attributes:
  - `rulesetId`, `scorePercent`, `complianceStatus`, `computedAtIso`, `schemaVersion`, `maxPoints`, `penaltyPoints`, `rawErrorFindings`, `rawWarningFindings`

Values are plain XML attributes (no nested JSON). See `docs/architecture/bpmn-linter.md` for the full technical contract.

## Dirty document

Persisting scores updates the BPMN model through the command stack, so the editor may show **unsaved changes** after lint even if you only “fixed” findings indirectly—those updates are intentional diagram content.

## Non-active rulesets

Only the **active** ruleset is recomputed on each lint. Other rulesets keep their **last persisted** XML entry until you switch the profile and lint again.
