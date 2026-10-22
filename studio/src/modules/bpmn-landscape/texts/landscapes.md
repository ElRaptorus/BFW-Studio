---
title: Landscapes
---

# Landscapes

A landscape map shows how the processes of your solution belong together. A map is a `.bfwmap` file in your solution; the BPMN files are never changed.

---

## Step by step

1. **Create a map.** Press the _New Map_ button in the Processes pane. The map is saved in the `landscapes` folder of the first project unless you choose another place.
2. **Add processes.** Drag a process from the Processes pane onto the map. A process appears at most once on a map; dragging it again selects it.
3. **Structure the map.** Use the palette on the left of the map for groups, placeholders for processes that are not modelled yet, and notes. Drop elements into a group to nest them. A group holds every element it fully encloses: draw, resize or move it around elements and they become part of it; an element it only partly covers stays outside and in front of it.
4. **Label elements.** Double-click a group, placeholder or note to edit its text.
5. **Save.** Press Cmd/Ctrl+S. Undo and redo work as in every editor.

&nbsp;

## Keys

| Key                                        | Action                         |
| ------------------------------------------ | ------------------------------ |
| Backspace (macOS), Delete (Windows, Linux) | Delete the selection           |
| Cmd/Ctrl+C, Cmd/Ctrl+V                     | Copy and paste (not processes) |
| Arrow keys, Shift+arrows                   | Move the selection             |
| Cmd/Ctrl+Z, Cmd/Ctrl+Y                     | Undo and redo                  |

&nbsp;

## A map that cannot be read

If a map file is damaged, for example by a merge, the Studio shows what is wrong and does not save over the file. Fix the file in a text editor; the map opens again as soon as the file can be read.
