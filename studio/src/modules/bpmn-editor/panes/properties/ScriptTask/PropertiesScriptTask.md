---
# This is a comment, which might be helpful to explain the concept of help texts
title: Script Task
---

# Script Tasks

![Script Task](ScriptTask.svg)

The `Script Task` contains a script that will be executed by the connected business process engine. After the execution is completed the task is also completed.

The script must be a [FEEL expression](help://bpmn/runtime_expressions). The evaluated result becomes the activity output.

Optionally, you can set **Script Ref** (`evil:scriptRef`) to a plugin dispatch key. When set, the engine delegates script execution to the registered named-script plugin instead of evaluating the inline FEEL script.

## Using values from the current token

You can use values from the current token with the `token` binding:

```feel
{ myValue: token.myValue }
```

## Modifying the current token

It is not possible to manipulate existing token values directly. But what you _can_ do is create a new context _derived_ from the token using FEEL context syntax:

```feel
{ ...token, someValue: 7 }
```

## Script Ref

When **Script Ref** is set, the inline script editor is hidden and the engine dispatches to the plugin registered under that key. Use this when script logic is implemented as an engine plugin rather than an inline FEEL expression.
