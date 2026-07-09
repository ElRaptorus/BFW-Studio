# Bifrost Forge World

> Toll the great Bell once! Pull the lever forward, to engage the Piston and Pump!\
> Toll the great Bell twice! With the push of the Button, fire the Engine and spark the Turbine into life!\
> Toll the great Bell Thrice! Sing praise to the God of all Machines!
>
> Ave Deus Mechanicus

## Prerequisites

- Node `>= 24.18.0`
- NPM `>= 12.0.0`

## Installation

```sh
npm ci
```

### Development Build

Build the development version with:

```sh
npm run build # Builds RSPack Bundle and Electron App
```

Then start it with:

```sh
npm start
```

### OS Specific Prod Build

Build fully fledged Electron App

```sh
npm run build-prod:electron:linux   # .AppImage
npm run build-prod:electron:macos   # .dmg
npm run build-prod:electron:windows # .exe
```

These will be placed in the `./studio/dist` folder.

### Engine

The Studio is built on top of the fearsome [Daemon Engine](https://github.com/ElRaptorus/ThomasTheDaemonEngine).

### Documentation

See [here](./docs/introduction.md).
