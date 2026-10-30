## Landscape Map Diff

The Landscape Map Diff shows two versions of a landscape map side by side.

### Map Comparison

Both versions are drawn as read-only maps. Elements, connectors and groups are highlighted to show what has changed:

- **Green**: Added
- **Red**: Removed
- **Yellow**: Modified (label, process, colours, parent and other properties)
- **Blue**: Moved or resized (layout changes)

Relation lines are not shown. Calls, messages and signals are inferred from the solution's BPMN files at runtime, so they cannot be compared reliably between versions. Process names and missing-process warnings come from the solution as it is now.

Use **XML** in the toolbar to compare the map files line by line, and **Show Summary** for a list of all changes that you can copy.

### Change Navigation

Use the arrows in the title bar to jump between changes. The Change Overview pane on the right lists the changed map properties and all added, removed, modified and moved items; click an item to show it in both maps.

### History Preview

When opened from the file history, you can toggle between:

- **Diff mode**: the current and the historical version side by side
- **Preview mode**: the historical version on its own

Use the **Restore** button to replace the file with the selected historical version.
