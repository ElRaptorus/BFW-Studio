---
# This is a comment, which might be helpful to explain the concept of help texts
title: Message Flow
---

# Message Flow

![Message Flow](MessageFlow.svg)

The `Message Flow` is a specialized flow that describes the target of a `Message`.
The origin of the `Message Flow` has to be a `Send Task`, a `Message End Event`, a `Message Intermediate Throw Event` or a `Participant` in a `Collaboration`.
The target of the `Message Flow` has to be a `Receive Task`, a `Message Start Event`, a `Message Intermediate Catch Event` or an other `Participant` in the `Collaboration`.
