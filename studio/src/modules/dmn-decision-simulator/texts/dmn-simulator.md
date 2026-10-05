---
title: Decision Simulator
---

# Decision Simulator

The Decision Simulator evaluates a decision or decision service of the open DMN diagram directly in the Studio. It needs no connection to an Engine and never deploys anything. The Engine stays authoritative: if the simulator and a deployed evaluation ever disagree, trust the Engine.

## Using it

1. Open the DRD and click the play-circle entry in the palette (or run **Editor: Toggle Decision Simulator**).
2. Click the wrench under every input data shape and enter a FEEL value, for example `42`, `"gold"` or `{ age: 17 }`. An empty value is `null`.
3. Press the play button on a decision or decision service.

An input you leave untouched is not sent, and the evaluation fails with `missing_required_input`. An input you clear to an empty field is sent as `null`. This is how the Engine treats absent and empty inputs.

## Reading the result

Each evaluated element shows its value or error next to its shape, evaluated requirement edges are highlighted, and the element you started from has a dashed outline. The control pad at the top of the canvas shows the result of the run in one line and offers:

- **Run** and **Run again** repeat the last run with the current inputs.
- **Reset** clears the result but keeps your inputs.
- The step buttons move through the evaluation.
- **Details** opens the full result, the list of steps, inputs of imported models and import notices. A dot on the button means there is something to look at.
- **Help** opens this text.

After a run the pad replays the evaluation step by step. Click any step button, or a step under Details, to stop the animation and inspect a single step.

If you edit the model after a run, the pad says so. The badges stay as a reference, but rule highlights in decision tables are hidden, because rule ids may have changed. Run again to refresh.

## Decision tables

Open the decision table of an evaluated decision to see which rules matched (green) and which did not (grey). A legend in the table's corner confirms that the highlighting comes from the last simulator run.

## Imported models

Decisions that require elements of an imported model are resolved through the solution's DMN files. Inputs of imported models appear under **Details**. Steps from an imported model have an **Open** link that jumps to the element in its file. An import that cannot be found is listed under Details as a notice and the evaluation stops with an error. If several files share one namespace, Details names the file that was used.

## Differences from the Engine

The simulator mirrors the Engine's evaluation rules (hit policies, boxed expressions, business knowledge models, decision services). Imported models are read from disk, not from unsaved editor tabs. Evaluation runs in a worker and is cancelled after five seconds.
