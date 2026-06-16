---
title: DMN Sanitizer
---

# DMN Sanitizer

The DMN Sanitizer is an always-on structural integrity scanner. It detects invisible artifacts in the DMN XML that typically arise from messy merges, incomplete edits, or copy-paste errors. These "ghost" artifacts can cause unpredictable behavior at runtime, even though they are invisible on the DRD canvas.

The Sanitizer runs automatically after every model change. When issues are detected, a colored badge appears in the bottom-left corner of the DRD editor. Click it to open the full report in the Editor Document Inspector.

The Sanitizer always scans from the root definitions level, regardless of which view (DRD, Decision Table, Literal Expression) is currently active. Switching back to the DRD view triggers a fresh re-analysis.

---

## Detectable Issues

### Poltergeists — Shapeless DRG Elements (Severity: Error)

DRG elements that exist in the semantic model but have no DMNShape on the DRD canvas. They are completely invisible in the editor yet still participate in the decision graph. This is the most dangerous category — a shapeless Decision will still be evaluated by the engine at runtime without ever being visible to the modeler.

- **Shapeless Decision** — A Decision without diagram coordinates. Invisible in the DRD but the engine evaluates it.
- **Shapeless Input Data** — An Input Data element without a DMNShape. Invisible but still referenced by decisions.
- **Shapeless BKM** — A Business Knowledge Model without a DMNShape. Can still be invoked via knowledge requirements.
- **Shapeless Knowledge Source** — A Knowledge Source without a DMNShape. Documentation element that cannot be inspected.
- **Shapeless Decision Service** — A Decision Service without a DMNShape. Defines a reusable DRG subset that cannot be managed.

&nbsp;

### Zombies — Orphaned DI Elements (Severity: Warning)

Diagram shapes or edges whose semantic elements have been removed from the definitions. They are visible on the DRD canvas but represent nothing in the decision model.

- **Zombie Shape** — A DMNShape whose `dmnElementRef` points to a non-existent element or is null.
- **Zombie Edge** — A DMNEdge whose `dmnElementRef` points to a non-existent element or is null.

&nbsp;

### Dangling References (Severity: Warning)

References that point to elements which no longer exist. These occur when a DRG element is deleted but requirements pointing to it are not cleaned up.

- **Dangling Requirement** — An information, knowledge, or authority requirement whose target element no longer exists.
- **Dangling dmnElementRef** — A DI element with a broken element reference from parse-time warnings.

&nbsp;

### Empty Containers (Severity: Warning)

Extension element wrappers left behind after their content was cleared — typically from a merge.

- **Empty extensionElements** — An `<extensionElements>` container with no child elements.

&nbsp;

### Orphaned Definitions (Severity: Info)

Top-level definitions that are not referenced by any element in the model. They are harmless at runtime but add noise to the XML.

- **Orphaned ItemDefinition** — An `itemDefinition` not referenced by any `typeRef` or `itemComponent`.
- **Orphaned Import** — An `import` not referenced by any requirement `href`.

---

## Fixing Issues

Every detected issue can be fixed individually (Broom icon per row) or in bulk ("Fix All" button). All fixes are executed as a single operation on the command stack and can be undone with **Ctrl+Z**.

- **Shapeless DRG elements** — Removed from `definitions.drgElement`. Requirements on other elements that reference the removed element are also cleaned up (cascading).
- **Zombie DI elements** — Removed from the DMNDI diagram elements.
- **Dangling references** — The broken requirement is removed from the owning DRG element.
- **Empty containers** — The empty wrapper element is removed.
- **Orphaned definitions** — The unused definition is removed from the definitions level.
