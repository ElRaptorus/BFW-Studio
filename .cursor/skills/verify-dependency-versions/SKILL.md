---
name: verify-dependency-versions
description: >-
  Verify package versions from package.json before referencing them in plans,
  code, or architecture docs. Use when a plan, implementation, or analysis
  requires knowledge about specific dependency versions — e.g. Electron,
  React, bpmn-js, TypeScript, or any npm package.
---

# Verify Dependency Versions

## When this applies

Any time your output depends on a **specific package version** — whether you are:

- Writing or reviewing an implementation plan
- Assessing API availability or breaking changes
- Deciding whether a dependency needs to be installed
- Referencing framework-specific behavior that varies across versions

## Rule

**NEVER assume or hallucinate a dependency version.** Always read the
authoritative source before stating a version number or making
version-dependent decisions.

## Steps

1. **Read `studio/package.json`** (for studio-side dependencies):

   ```
   Read studio/package.json
   ```

   Look in both `dependencies` and `devDependencies`.

2. **Read `studio-sdk/package.json`** (for SDK-side dependencies):

   ```
   Read studio-sdk/package.json
   ```

3. If the dependency is **not listed** in either file, state that explicitly
   rather than guessing a version.

4. When the version matters for API compatibility (e.g. Electron, React,
   TypeScript), cross-reference the actual installed version against the
   upstream changelog or breaking-changes doc to verify your assumptions.

## Examples

### Checking Electron version before planning webview usage

```
Read studio/package.json → find "electron": "42.0.1"
→ Check Electron 42 breaking changes for webview-related removals
→ Use correct event names (render-process-gone, not crashed)
```

### Checking whether a library is already installed

```
Read studio/package.json → find "marked": "^18.0.3"
→ Don't list marked as a new dependency to install
```

### Checking TypeScript version for language feature availability

```
Read studio/package.json → find "typescript": "^6.0.3"
→ Confirm that the `using` keyword / explicit resource management is supported
```
