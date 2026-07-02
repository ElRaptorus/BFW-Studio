---
title: Error Boundary Event
---

# Error Boundary Event

![Error Boundary Event](ErrorBoundaryEvent.svg)

An `Error Boundary Event` is attached to an activity and reacts when that activity raises an error. It always interrupts: the activity is stopped and the flow continues from the boundary event.

You can attach several Error Boundary Events to the same activity to handle different errors on separate paths. If more than one could match the same error, design their criteria so they do not overlap.

## Match all errors

Turn on **`Match all errors`** to catch every error the activity can raise, whatever its code or message.

![Match all errors](MatchAllErrorsScreen.png)

## Match a specific error

Leave **`Match all errors`** off and fill in **`Error Code`**, **`Error Message`**, or both:

- Only **`Error Code`** set — matches any error with that code.
- Only **`Error Message`** set — matches any error with that message.
- Both set — the error must match the code **and** the message.

### Example

An activity fails with Error Code `404` and Error Message `NotFoundTestError`:

![Match Specific Error](MatchSpecificErrorWithMessage.png)

With the configuration shown above, the event would **not** catch this error, because the `Error Code` does not match. Change the `Error Code` to `404` and it will be caught.
