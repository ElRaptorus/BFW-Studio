# Bifrost Forge World Studio

> Toll the great Bell once! Pull the lever forward, to engage the Piston and Pump!\
> Toll the great Bell twice! With the push of the Button, fire the Engine and spark the Turbine into life!\
> Toll the great Bell Thrice! Sing praise to the God of all Machines!
>
> Ave Deus Mechanicus

## What is this?

A BPMN 2.0 modeling Environment, built with ReactJS and Electron and the holy greases, cogs and oils sanctioned by the [Cult Mechanicus](https://wh40k.lexicanum.com/wiki/Cult_Mechanicus). Used to model BPMN and DMN diagrams, which can be run with [BFW-Engine](https://github.com/ElRaptorus/BFW-Engine).

> Current Status: Beta. The [Omnissiah's](https://wh40k.lexicanum.com/wiki/Omnissiah) great work is never done.

## Key Features

- Full BPMN 2.0 and DMN 1.5 Coverage
- Extensive BPMN Tooling, including a fully featured Linter, Token Simulator, FEEL Expression Builder, Visual User Task Form Builders and much more
- Integrated Git Support
- Visual Merge Conflict Resolver for BPMN and DMN
- Guided BPMN Version Management, in conjunction with the Engine
- Integrated Engine Workspace, tailored to the [BFW-Engine](https://github.com/ElRaptorus/BFW-Engine)
- Extensive Plugin Capabilities

See [here](./CHANGELOG.md) to get a better picture of what's in store for v1.

## Prerequisites

- Node `>= 24.20.0`
- NPM `>= 12.0.0`
- Binary Cant
- A Noospheric Connection

## Installation

```sh
npm ci --allow-remote=all
```

`--allow-remote=all` is required for the extract-zip override (I use a [drop-in replacement](https://github.com/ElRaptorus/zippogryph)).
Will be removed, as soon as the vulnerabilities are fixed (which is unlikely, given extract-zip is pretty much dead), or other libs have replaced it.

### Development Build

Build local dev version:

```sh
npm run build
```

Start as electron dev app:

```sh
npm start
```

### OS Specific Prod Build

Builds ready-to-use packaged apps:

```sh
npm run build-prod:electron:linux   # .AppImage
npm run build-prod:electron:macos   # .dmg
npm run build-prod:electron:windows # .exe
```

These are placed in the `./studio/dist` folder.

## Documentation

See [here](./docs/introduction.md).

## License

MIT
