---
title: Interactions
---

# Interactions

The **Interactions** view on Discover builds a read-only diagram of how your BPMN processes talk to each other through **messages** and **signals** across the whole open solution. You pick processes, press **Generate**, and explore the links. Nothing on the diagram is edited here.

---

## Step by step

1. **Open a solution** that contains BPMN files, then open **Discover › Interactions**. Without a solution, the page offers _Open Solution…_.
2. **Tick processes** in the **Processes** pane on the left: one row per process, a tri-state checkbox per file, or the master checkbox beside the filter to check everything currently listed.
3. **Press Generate** (play icon in the centre of the toolbar). Until you do, the canvas shows a short hint.
4. **Explore** the diagram. When the play button’s tooltip says _Regenerate_, the BPMN files or your selection changed since the last generation — press it again.

&nbsp;

## Reading the diagram

| Symbol                | Meaning                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Process box**       | One selected process, labelled with its name (or its id when it has no name).                                                                             |
| **Port**              | One message or signal event or send/receive task on the border of a box (throw versus catch).                                                             |
| **Line**              | A link between matching message or signal names in the view.                                                                                              |
| **Stub**              | A partner process is not in the view (for example **→ N outside the view**). You can add those partners from the Properties pane or a stub on the canvas. |
| **Orange "!" marker** | **Unconnected:** no process in the solution has a partner for this event. Hover the marker for the full tooltip.                                          |

&nbsp;

## Direct versus Stations layout

Use the **Direct** (flow arrow) or **Stations** (train) icons in the centre of the toolbar.

| Mode         | Behaviour                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Direct**   | One line per throw/catch pair with the same name in the view.                                                          |
| **Stations** | Lines run through a shared **station** node per message or signal name — useful when many processes use the same name. |

A **station** is only a shared message or signal name on the diagram. **It is not a process.**

The title bar shows how many processes are selected and whether the diagram is up to date, stale, or still generating.

&nbsp;

## Toolbar toggles and zoom

| Control                                        | Effect                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| **Hide** (eye slash)                           | Omits selected processes that have no line in the current view. |
| **Focus** (crosshair, **F**)                   | Dims elements unrelated to what you select on the diagram.      |
| **Find** (magnifying glass, **Ctrl+F**)        | Opens search on the diagram.                                    |
| **Zoom to viewport** / **Zoom to actual size** | In the centre of the toolbar, after the layout icons.           |

Toggles such as Hide, layout mode, and Focus show as pressed when they are on.

&nbsp;

## What is saved

| Item                                         | Stored where                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Layout mode (Direct / Stations) and **Hide** | In the solution file (`.bfwsln`), or in your user settings when no solution file is open. |
| Process selection (checkboxes)               | Session only — not saved.                                                                 |
| The diagram itself                           | Never saved — press **Generate** again after reopening the view.                          |

&nbsp;

## Properties pane summary

When a diagram exists, the summary offers two actions:

- **Ports with partners outside the view** — adds all those partners to the selection and regenerates.
- **Unconnected ports** — steps through ports that carry the orange "!" marker.

Select a process, port, line, or station for read-only details (event type, correlation, partners, **Open**). On an unconnected port, **Next unconnected port** steps to the next orange "!" marker the same way as the summary button.

&nbsp;

## Navigation and export

- **Double-click** a process in the **Processes** pane, or use **Open** in port details, to jump to the element in its BPMN file in the Designer.
- **Export** (left of the toolbar) saves the diagram as PNG, JPEG, WebP, or SVG.
- Press the **help** button (question mark, right of the toolbar) to open this page beside the editor.

&nbsp;

## Compared to Landscapes

A Landscape map is a `.bfwmap` file that you arrange and save; it can start from an automatically created layout, but you edit it on the canvas. Interactions is **generated** from the process definitions every time, cannot be edited, and is never saved. See the Landscapes help text for maps.
