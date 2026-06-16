---
title: BPMN Sanitizer
---

# BPMN Sanitizer

The BPMN Sanitizer is an always-on structural integrity scanner. It detects invisible artifacts in the BPMN XML that typically arise from messy merges, incomplete edits, or copy-paste errors. These "ghost" artifacts can cause unpredictable behavior at runtime, even though they are invisible on the diagram canvas.

The Sanitizer runs automatically after every model change. When issues are detected, a colored badge appears in the bottom-left corner of the BPMN editor. Click it to open the full report in the Editor Document Inspector.

---

## Detectable Issues

### Poltergeists — Shapeless Elements (Severity: Error)

Elements that exist in the BPMN XML but have no diagram coordinates. They are completely invisible on the canvas yet still participate in the process flow. This is the most dangerous category — a shapeless task connected via sequence flow will execute at runtime without ever being visible to the modeler.

- **Shapeless Flow Node** — A task, event, or gateway without diagram coordinates. It exists in the XML, is wired into the flow, but cannot be seen.
- **Shapeless Participant** — A pool or lane defined in the collaboration but missing from the diagram.
- **Shapeless Sequence Flow** — An invisible wire connecting two elements. The connection exists in the process flow but has no visual representation.
- **Shapeless Message Flow** — An invisible cross-pool message wire. The message flow exists in the collaboration but cannot be seen.

&nbsp;

### Dangling References (Severity: Warning)

References that point to definitions which no longer exist. These occur when a Message, Error, Signal, or Escalation definition is deleted or renamed, but the event referencing it is not updated.

- **Dangling messageRef** — An event's `messageRef` points to a Message that no longer exists.
- **Dangling errorRef** — An event's `errorRef` points to an Error that no longer exists.
- **Dangling signalRef** — An event's `signalRef` points to a Signal that no longer exists.
- **Dangling escalationRef** — An event's `escalationRef` points to an Escalation that no longer exists.

&nbsp;

### Empty Containers (Severity: Warning)

Extension element wrappers left behind after their content was cleared — typically from a merge or from clearing linter scores.

- **Empty extensionElements** — An `<extensionElements>` container with no child elements.
- **Empty evil:Properties** — An `<evil:Properties>` container with no content (e.g. after linter scores were cleared).

&nbsp;

### Unreferenced Globals (Severity: Info)

Top-level definitions (Messages, Errors, Signals, Escalations) that are not referenced by any element in the diagram. They are harmless at runtime but add noise to the XML.

- **Unreferenced Message** — A `bpmn:Message` in `rootElements` not used by any event or task.
- **Unreferenced Error** — A `bpmn:Error` in `rootElements` not used by any event.
- **Unreferenced Signal** — A `bpmn:Signal` in `rootElements` not used by any event.
- **Unreferenced Escalation** — An `bpmn:Escalation` in `rootElements` not used by any event.

---

## Fixing Issues

Every detected issue can be fixed individually (Broom icon per row) or in bulk ("Fix All" button). All fixes are executed as a single operation on the command stack and can be undone with **Ctrl+Z**.

- **Shapeless elements** — Removed from the process/collaboration XML.
- **Dangling references** — The broken reference is cleared from the event definition.
- **Empty containers** — The empty wrapper element is removed. If the parent also becomes empty, it is cleaned up too.
- **Unreferenced globals** — The unused definition is removed from `rootElements`.
