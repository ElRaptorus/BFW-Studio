---
# This is a comment, which might be helpful to explain the concept of help texts
title: Duration Timer Boundary Event
---

# Duration Timer Boundary Events

A `Duration Timer Boundary Event` will trigger the connected path, after the configured duration timer has expired.

The duration must be supplied in [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601).

Example: `P1Y2M4DT5H6M7S`

The `P` stands for `period` and marks the beginning of the duration.

Note that each value must be stated as a `value` - `unit` Combination; i.e. `1Y` for `One Year` and so forth.

The following parameters are allowed:

- `Y` - Year
- `M` - Month
- `D` - Day
- `T` - Seperates the `Date` and `Time` Parts of the duration. No value must be supplied
- `H` - Hour
- `M` - Minute
- `S` - Second
