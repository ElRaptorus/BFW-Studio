---
title: Landscapes
---

# Landscapes

A landscape map shows how the processes of your solution belong together. A map is a `.bfwmap` file in the landscape folder of your solution; the BPMN files are never changed.

&nbsp;

## The landscape folder

Landscape maps need a saved solution (a `.bfwsln` file), because a map looks up its processes in the whole solution. The solution names one folder for its maps, the landscape folder. By default it is `landscapes` next to the solution file.

- **Set it up:** open the Landscapes page and press _Set Up Landscape Folder_ in the Maps explorer, or choose another folder with _Choose Folder…_. Both are also in the command search.
- **Change it later:** _Landscapes: Choose Landscape Folder_. Maps in the old folder stay where they are; move them yourself.
- **Shape it in the Designer:** the Maps explorer only shows maps. Create, rename or move its subfolders in the Designer explorer, where the landscape folder appears greyed. Renaming or moving a folder that contains it updates the solution file; deleting it asks first.

Maps outside the landscape folder do not open.

---

## Step by step

1. **Create a map.** Press the _New Landscape Map_ button in the Maps explorer, or right-click a folder there and choose _New Landscape Map…_. The map is saved in the landscape folder or one of its subfolders.
2. **Add processes.** Drag a process from the Processes pane onto the map. A process appears at most once on a map; dragging it again selects it.
3. **Structure the map.** Use the palette on the left of the map for groups, placeholders for processes that are not modelled yet, and notes. Drop elements into a group to nest them. A group holds every element it fully encloses: draw, resize or move it around elements and they become part of it; an element it only partly covers stays outside and in front of it.
4. **Label elements.** Double-click a group, placeholder, note or connector to edit its text.
5. **Connect elements.** Select an element and drag or click _Connect_ in its context pad, then click the target. Connectors are saved with the map; bands cannot be connected.
6. **Save.** Press Cmd/Ctrl+S. Undo and redo work as in every editor.

&nbsp;

## Relations

The map draws the relations between the processes on it, read from the saved BPMN files: call activities as solid lines, messages as dashed lines and signals as dotted lines, labelled with the message or signal names. Relations are never saved; they update when a BPMN file is saved.

- **Hide a relation:** select its line and press _Hide_ in the context pad or in the Properties pane. A process's relations can also be shown or hidden from its properties.
- **Hide a relation type:** with nothing selected, switch call activities, messages or signals off in the Properties pane. _Show hidden relations_ brings back every hidden one.

&nbsp;

## Properties

The Properties pane on the right edits the selected element: label, shape (box or chevron), colour. For a process it shows the file, version, relations and decisions; _Open_ opens a decision. With nothing selected it edits the map name and the relation types.

Double-click a process to open it in the Designer.

&nbsp;

## Focus mode

Press F or the _Focus_ button in the toolbar. Everything that is not related to the selection is dimmed: the selected elements, their relations and the processes at the other end stay clear.

&nbsp;

## Keys

| Key                                        | Action                         |
| ------------------------------------------ | ------------------------------ |
| Backspace (macOS), Delete (Windows, Linux) | Delete the selection           |
| Cmd/Ctrl+C, Cmd/Ctrl+V                     | Copy and paste (not processes) |
| Arrow keys, Shift+arrows                   | Move the selection             |
| F                                          | Focus mode on and off          |
| Cmd/Ctrl+Z, Cmd/Ctrl+Y                     | Undo and redo                  |

&nbsp;

## A map that cannot be read

If a map file is damaged, for example by a merge, the Studio shows what is wrong and does not save over the file. Fix the file in a text editor; the map opens again as soon as the file can be read.
