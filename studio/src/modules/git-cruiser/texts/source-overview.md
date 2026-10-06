---
title: Source Overview
---

# Source Overview

Use this page to see what changed in your project before you commit, what your branch changed compared with its base, and what happened on the branch so far. It has three tabs: **Uncommitted changes**, **Current Branch** and **Current vs. base**. Nothing here changes your files unless you press a button that says so.

---

## Step by step

1. **Review** your uncommitted changes in the list.
2. **Click** a file to see its two versions side by side.
3. **Stage** the files in the Git pane (click a file there to see its changes) and **commit** them. The magic wand next to the commit button suggests a title from your staged BPMN and DMN changes.
4. **Push** them to the server from the Git pane.

&nbsp;

## Uncommitted changes

Every changed file is one row, BPMN and DMN files first. A row shows whether the file is a process, a decision or another file, what happened to it, and its name. For processes and decisions a second line says how many elements were added, changed or removed. Click a row to see the two versions side by side; the arrow button at the end opens the file itself. When nothing changed since the last commit, the tab says so.

| Word     | Meaning                                            |
| -------- | -------------------------------------------------- |
| New      | The file did not exist before                      |
| Modified | The file was changed                               |
| Deleted  | The file was removed                               |
| Renamed  | The file has a new name or location                |
| Conflict | Both sides changed it; click the row to resolve it |

&nbsp;

## Current Branch

The list shows the commits of the branch you are on, newest first, along a line.

- A **dot** is a commit. The dot of the commit you are on is highlighted.
- A **square** is a merge; its tag names the branch that was merged.
- **Not pushed** marks commits that are only on your computer.
- Click a commit to see the files it changed. Right-click it to **Copy Commit Hash**.
- Click a file of the commit to see what the commit changed in it.
- The clock button (**Preview this version**) opens a BPMN or DMN file as it was in that commit. You can restore it from there.

Type in the search field to find commits by their message. The whole history of the branch is searched, not only the commits you can see, and capital letters do not matter. Clear the field to see every commit again.

Press **Show older commits** to load more.

&nbsp;

## Current vs. base

This tab shows everything your branch changed compared with the branch it started from, for example `main`. Use **Base branch** to compare with another branch. It shows committed changes only; uncommitted changes stay on their own tab.

&nbsp;

## Diffs

Clicking a file opens a tab with the two versions side by side.

- For BPMN and DMN files, **Visual** compares the diagrams and **XML** compares the sources line by line.
- **Open File** opens the file itself.
