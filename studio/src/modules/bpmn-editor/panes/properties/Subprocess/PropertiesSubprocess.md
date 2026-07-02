---
title: Subprocess
---

# Subprocess

![Subprocess](Subprocess.svg)

A `Subprocess` is a group of steps — activities, gateways, events, and the flows between them — drawn directly inside the parent process. It runs as part of the **same** process run; it does not start a separate one. To run a whole separate process instead, use a [Call Activity](help://bpmn/properties/call_activity).

A Subprocess begins when the flow reaches it and finishes once everything inside it has completed. It is a handy way to keep a busy diagram tidy by tucking related steps into one collapsible box, while still sharing the same data as the surrounding process.
