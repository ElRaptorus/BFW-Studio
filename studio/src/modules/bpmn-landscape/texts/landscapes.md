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
3. **Structure the map.** Use the palette on the left of the map for bands, groups, placeholders for processes that are not modelled yet, and notes. Drop elements into a group to nest them. A group holds every element it fully encloses: draw, resize or move it around elements and they become part of it; an element it only partly covers stays outside and in front of it.
4. **Label elements.** Double-click a group, placeholder, note or connector to edit its text.
5. **Connect elements.** Select an element and drag or click _Connect_ in its context pad, then click the target. Connectors are saved with the map; bands cannot be connected.
6. **Collapse a group.** Select a group and press _Collapse_ in its context pad; see _Groups, levels and planes_ below.
7. **Save.** Press Cmd/Ctrl+S. Undo and redo work as in every editor.

&nbsp;

## Creating a map automatically

Let the Studio place the processes for you. Right-click one or more processes or BPMN files in the Processes pane and choose _Create Map from Process…_ (or _…from File…_, _…from Selection…_). For a map of the whole solution use _Landscapes: Create Map from Processes…_ in the command search.

A dialog asks for:

- **Name** of the map.
- **Add related processes:** none, or the processes linked to the selection by a call, message or signal in either direction, up to three steps away.
- **Group processes:** none, by the folder or by the file of each process.
- **Arrange by call hierarchy:** on, a process sits above the processes it calls; off, all relations (messages and signals too) count.

Then you choose where to save the map. The result is an ordinary map: move, regroup or delete anything. Relation lines are drawn from the BPMN files as usual.

&nbsp;

## Groups, levels and planes

- **Bands** are wide strips at the top level of a map, for example one per business area. A band holds groups and elements, but a band can be created only on the map itself, not inside a group; the palette shows the band only while the map itself is open.
- **Collapse a group** with _Collapse_ in its context pad. The group becomes one box and its contents move to a plane of their own. _Expand_ puts them back. A collapsed group cannot be resized and holds nothing until it is expanded.
- **Open a collapsed group** by double-clicking it or pressing the arrows button on its box. Its contents appear alone on the canvas, with breadcrumbs at the top left; press a crumb to go back. A collapsed group's label is edited in the Properties pane.
- **Connectors and relations** keep working across a collapsed group: a connector into a group is drawn to the group's box and returns to the process when the group is expanded. A relation line that ends at a group counts the relations it stands for; relations inside one collapsed group are not drawn. A connector that crosses a group border keeps its bends when the group is collapsed or expanded, and they are saved with the map; if you moved a shape meanwhile, the line is adjusted at that end. Expanding moves the contents back into the group's size when they fit; the group grows to the right and down only when the contents are wider or higher than that.
- **Levels** name the depths of nested groups. Add them in the Properties pane with nothing selected: the first name is for top-level groups, the second for groups inside them, and so on. A selected group shows the name of its depth.

&nbsp;

## Relations

The map draws the relations between the processes on it, read from the saved BPMN files: call activities as solid lines, messages as dashed lines and signals as dotted lines, labelled with the message or signal names. Relations are never saved; they update when a BPMN file is saved.

- **Hide a relation:** select its line and press _Hide_ in the context pad or in the Properties pane. A process's relations can also be shown or hidden from its properties.
- **Hide a relation type:** with nothing selected, switch call activities, messages or signals off in the Properties pane. _Show hidden relations_ brings back every hidden one.

&nbsp;

## Properties

The Properties pane on the right edits the selected element: label, shape (box or chevron), colour. For a process it shows the file, version, relations and decisions; _Open_ opens a decision. With nothing selected it edits the map name and the relation types.

Double-click a process to open it in the Designer, or a collapsed group to open its plane. The Processes pane shows on how many maps each process appears.

&nbsp;

## When processes change

A map stores the process id and the file of every process on it. If a BPMN file is renamed, moved or edited, the map follows as long as the process id is still defined in exactly one file of the solution. When it is not, the process is drawn faded with a warning mark, and the Maps explorer shows a yellow number on the map.

- **Not found:** the id exists in no file. Select the shape and choose _Replace with_ to point it at another process, _Drop reference_ to turn it into a placeholder with the same label and connectors, or _Keep_ to leave it as it is until the map is closed.
- **In several files:** the id is defined more than once. Choose the file in _Replace with_.
- **Review:** when a map with such processes opens, a notice offers _Review_, which selects the first of them.

&nbsp;

## Linking maps

Drag a map from the Maps explorer onto another map to add a link to it. Double-click the link to open the target; its label is edited in the Properties pane. If the target map is renamed or deleted, the link is faded and can be pointed at another map in the Properties pane.

&nbsp;

## Export

The _Export_ button in the toolbar saves what the canvas shows, the map or the open group, as SVG, PNG, JPEG or WebP, depending on the file extension you choose.

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
