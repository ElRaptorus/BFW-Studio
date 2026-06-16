# Philosophy

## Divergence and Convergence

The present prototype is exactly that: a prototype.
An evolutionary prototype, to be precise.
But a prototype nonetheless.

For many aspects we don't yet know (as of late 2019) exactly where the journey leads.
Our "research journey" often consists of seeing how "wide" we can go, then consciously narrowing our focus again for the sake of reducing complexity.

Example:

When designing the extension mechanism, a point inevitably arrives where you wonder: "Wait — isn't *everything* just an extension?"
This nicely illustrates the "go wide" phase.
Nonetheless, going *that* wide makes little sense: if we followed "Can't everything be reduced to discrete building blocks?" long enough, nothing of the Bifrost framework would remain.
Take this "technology-driven software poetry" too far and you'll eventually reinvent HTML, CSS, and REST.

During the convergence phase, it is important not to close off possibilities.
During the divergence phase, it is important to consciously identify the smallest *meaningful* building blocks whose maintenance, control, and continued development will be decisive in the long run.

Reducing the complexity of our designs during the convergence phase is regularly difficult for another reason:
complexity sells better than simplicity.

This is almost an axiom of the business world.
For us it means: if we implement many features in a business application, it *tends* to sell better than one with fewer features.

For the code that provides that functionality, the opposite is true: complexity costs us — time, money, and sanity.
And to be able to gauge the consequences of complexity, it seems, you must have experienced them.

<!--
Software design must make things manageable.
Software design is not an end in itself.

The same applies to frameworks: they should help us reduce complexity.
Frameworks are not an end in itself.
-->

## Let Data Be Data

In object-oriented programming there is a tendency to turn absolutely everything into an intelligent object.
Such objects are sometimes very desirable, because they bundle responsibilities and encapsulate mandates for action.

However, many descriptive, static "things" can be modelled very easily as plain data — without a mandate for action of their own and without the responsibilities that objects carry in the OO world.

Such static data, sometimes called "data contracts", have a number of practical advantages:

- easy to validate
- easy to migrate
- well suited for defining tests
- well suited for reproducing bugs
- input data is static, so there's no "flappiness on both sides" regarding behaviour
- static data can be stored/sent (whether to the file system, via WebSocket, or to a WebWorker)

## Let It Crash / Testability of All Components

Errors are an inevitable part of development work.

We must not "swallow" runtime errors or hide them from the user; instead, we must make them noticeable, analysable, and testable.

Regarding "testability", the devil is in the wording:
in future, we don't want to test every last screw — but we want to know that we *can*, wherever it proves necessary.

## Not-Invented-Here vs Nothing-Invented-Here

With respect to open-source components, two extremes can be observed:

- Teams that use no open-source components whatsoever and write everything themselves, including the CSV parser
- Teams that use open-source components exclusively, adopt those components' premises regardless of their own business case, and — despite all evidence to the contrary — keep hammering these components into shape with extension methods or extra CSS until they seemingly fit the use case

Both extremes, as so often with extremes, seem impractical.

## Separation of Business Logic and Presentation Logic

We want to pay greater attention to principles like "Separation of Concerns" and therefore separate our actual "application", in which our business domain is modelled, from our "representation" — the user interface.

We must find and understand the fundamental building blocks of our software.
