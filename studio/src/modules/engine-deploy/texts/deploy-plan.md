---
title: Deploy
---

# Deploy

Use this page to put your BPMN and DMN files on the Engine. You collect the files in a **plan**, check what will change, and press **Deploy**. Your local files are never modified.

---

## Step by step

1. **Add files.** In the Deploy Explorer on the left, select files or folders and press Enter, double-click, or use _Add to Deployment_ in the context menu.
2. **Add what is missing.** The _tree_ button adds local files your plan depends on, such as called processes or decisions.
3. **Choose what to deploy.** Only **checked** rows are sent. Unchecked rows stay in the plan but are skipped.
4. **Check the status.** The _Status_ column tells you whether a file is new, changed or already on the Engine.
5. **Press Deploy.** Deploying is only possible with a connected Engine. If the button is greyed out, its tooltip tells you why.

&nbsp;

## Status

| Status                       | Meaning                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| New / New version            | Not on the Engine yet, or newer than the deployed version             |
| Unchanged                    | Identical to what the Engine has                                      |
| Changed without version bump | Content differs, but the version is the same. Raise the version first |
| Version missing              | Deploy will ask you for a version                                     |
| Unknown                      | The Engine could not be reached                                       |

The _Linter_ column shows the quality scores of a file. The Engine may reject a file whose score is too low; the reason is shown in the details on the right.

&nbsp;

## Tidying up the plan

None of these touch your files or the Engine.

- **Minus button on a row:** removes that entry from the plan.
- **Remove selected files:** removes all checked rows.
- **Broom:** empties the whole plan.
- **Group by folders:** shows one row per folder instead of one per file.

&nbsp;

## Packages

A package is a saved list of files you deploy together. Use the **package menu** to load one, save the current plan as a package, or delete a package. Packages belong to the solution, so your team shares them.

&nbsp;

## Details

Click a row to see its details on the right: status, linter scores, problems that block it, dependencies, and the result of the last deployment.
