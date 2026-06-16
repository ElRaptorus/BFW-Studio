# Start Page

The Start Page (Welcome tab) is an editor document (`about:start`) that serves as the Studio's landing page. It highlights the Studio's core creative entry points and provides quick access to common actions.

## Layout

The start page uses a vertically stacked, single-column layout (max-width 900px, centered):

1. **Header** — Product name + release channel via `ProductNameHeadline`
2. **Hero card grid** — Large cards for primary actions (BPMN, DMN, Solution) + injected hero cards
3. **Recent section** — Recently opened solutions and files
4. **Action card grid** — Smaller cards for secondary actions (Open File, Open Folder, Pick a Theme, Search Files, Search Commands, Visit Machine Sanctum) + injected action cards + legacy extra renderers
5. **Footer** — "Show Welcome Page at startup" checkbox + "Did you know?" tip
6. **Flavor text** — Three hardcoded lore strings placed between sections

## File Structure

| File | Role |
|------|------|
| `modules/std/startpage/StartpageRenderer.tsx` | React renderer |
| `modules/std/startpage/index.ts` | Document type registration, contribution commands, settings, `StartpageCardDescriptor` type |
| `modules/std/startpage/styles/startpage.scss` | Styles and module-owned theme tokens |

## Contribution API

External modules can inject cards into the start page via commands. The API uses typed descriptors so the renderer owns the visual presentation.

### `StartpageCardDescriptor`

```typescript
type StartpageCardDescriptor = {
  key: string;          // Unique key for React rendering
  icon: string;         // Phosphor icon class (e.g. 'ph-fill ph-plus-square')
  title: string;        // Card title
  description: string;  // Card description text
  command: string;      // Command to execute on click
  commandArgs?: any[];  // Optional command arguments
  testId?: string;      // Generates data-test--{testId} attribute
};
```

### Commands

| Command | Purpose | Accepts |
|---------|---------|---------|
| `startpage.registerHeroCard` | Add a card to the hero grid (row 1) | `StartpageCardDescriptor` |
| `startpage.registerActionCard` | Add a card to the action grid (row 2) | `StartpageCardDescriptor` |
| `startpage.getHeroCards` | Retrieve all registered hero card descriptors | — |
| `startpage.getActionCards` | Retrieve all registered action card descriptors | — |

### Legacy API (backward compatibility)

| Command | Purpose | Accepts |
|---------|---------|---------|
| `startpage.setExtraRenderer` | Append a raw `React.JSX.Element` to the action grid | `React.JSX.Element` |
| `startpage.getExtraRenderer` | Retrieve legacy elements | — |

Legacy elements are rendered verbatim at the end of the action card grid. New code should use the descriptor-based API.

### Usage Example

```typescript
if (bifrost.commands.isRegistered('startpage.registerHeroCard')) {
  bifrost.commands.executeCommand('startpage.registerHeroCard', [{
    key: 'my-feature',
    icon: 'ph-fill ph-plus-square',
    title: 'My Feature',
    description: 'Description of what this creates',
    command: 'myModule.doSomething',
    testId: 'startpage-my-feature',
  }]);
}
```

### Current Consumers

| Module | API | Card |
|--------|-----|------|
| `git-cruiser` | `startpage.registerHeroCard` | "Git Repo" — clone a repository |

## Theme Tokens

### Module-owned (defined in `startpage.scss`)

| Token | Purpose |
|-------|---------|
| `--color-startpage-icon-primary` | Hero card icon accent color |
| `--color-startpage-link-bg` | Action card background |
| `--color-startpage-link-hover-bg` | Action card hover background |

### Core tokens (defined in `theme.light.scss` / `theme.dark.scss` + all extra themes)

| Token | Purpose |
|-------|---------|
| `--theme-startpage-hero-hover-bg` | Hero card hover background |
| `--theme-startpage-hero-hover-border` | Hero card hover border color |
| `--theme-startpage-hero-icon-bg` | Background of the icon container in hero cards |
| `--theme-startpage-flavor-fg` | Flavor text (lore strings) color |
| `--theme-startpage-separator` | Horizontal separator color |

Hero cards also use the general `--theme-card-bg` and `--theme-card-border` tokens for their default state.

## Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `startpage.general.openOnStartupIfEmpty` | `boolean` | `true` | Auto-open the start page when the Studio launches with no open documents |

## Test Attributes

| Attribute | Element |
|-----------|---------|
| `data-test--startpage` | Root container |
| `data-test--startpage-hero-grid` | Hero card grid |
| `data-test--startpage-action-grid` | Action card grid |
| `data-test--startpage-hero-bpmn` | BPMN hero card |
| `data-test--startpage-hero-dmn` | DMN hero card |
| `data-test--startpage-hero-solution` | Solution hero card |
| `data-test--startpage-clone-repository` | Git Repo hero card (from git-cruiser) |
