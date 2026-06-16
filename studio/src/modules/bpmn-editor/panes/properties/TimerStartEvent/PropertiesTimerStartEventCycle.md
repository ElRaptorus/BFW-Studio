---
# This is a comment, which might be helpful to explain the concept of help texts
title: Cyclic Timer Start Event
---

# Cyclic Timer Start Events

A `Cyclic Timer Start Event` is used to repeatedly trigger a process, using a specific interval.

This interval are configured as [crontabs](https://en.wikipedia.org/wiki/Cron).

In Short, a crontab is made up of 6 values:

- `second` (Optional): 0-59
- `minute`: 0-59
- `Hour`: 0-23
- `day`: 1-31
- `month`: 1-12
- `dayofweek`: (0-7, Sunday is 0 or 7)

The `second` value is optional and can be omitted.

You can use a wildcard `*` to configure the timer to run at every second/minute/hour/day/month/dayofweek.

A few Examples:

- `0 0 * * 1` - Triggers every monday at midnight
- `0,30 3 * * *` - Triggers every day at 3am and 3:30am
- `*/30 * * * * *` - Triggers every 30 seconds

For more information on how to use crontabs, see [this guide](https://en.wikipedia.org/wiki/Cron).
