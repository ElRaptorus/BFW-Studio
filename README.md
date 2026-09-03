# Bifrost Forge World

> Toll the great Bell once! Pull the lever forward, to engage the Piston and Pump!\
> Toll the great Bell twice! With the push of the Button, fire the Engine and spark the Turbine into life!\
> Toll the great Bell Thrice! Sing praise to the God of all Machines!
>
> Ave Deus Mechanicus

## What is this?

A BPMN 2.0 modeling Environment, built with ReactJS and Electron. Used to model BPMN and DMN diagrams, which can be run with the [Daemon Engine](https://github.com/ElRaptorus/ThomasTheDaemonEngine).

## Prerequisites

- Node `>= 24.20.0`
- NPM `>= 12.0.0`

## Installation

```sh
# --allow-remote=all is required for the extract-zip override.
# Will be removed, as soon as electron-chromedriver and webdriverio have replaced it or extract-zip's maintainer ever fixes the vulnerabilities (which is unlikely).
npm ci --allow-remote=all 
```

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

### Documentation

See [here](./docs/introduction.md).
