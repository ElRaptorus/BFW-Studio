---
title: Correlation Retrieval Expression
---

# Correlation Retrieval Expression

When one process sends a message and another is waiting for it, correlation makes sure the message reaches the **right** waiting case — not every process that happens to listen for that message.

The `Correlation Retrieval Expression` is set on the **sending** element (a [Message End Event](help://bpmn/properties/message_end_event), a [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event), or a [Send Task](help://bpmn/properties/send_task)). It is a small [formula](help://bpmn/runtime_expressions) that reads a value from the message you are about to send — for example an order number — and attaches it to the message as its correlation value.

> On the receiving side there is no such field. A waiting element listens using the process-level [Correlation Key](help://bpmn/properties/process). The message is delivered to the waiting case whose Correlation Key matches the value attached by the sender.

## How it fits together

1. The receiving process declares a [Correlation Key](help://bpmn/properties/process) — the value each waiting case listens for.
2. A waiting element remembers its Correlation Key value while it waits.
3. The sending element uses its Correlation Retrieval Expression to attach a matching value to the outgoing message.
4. The message is delivered to the waiting case whose value matches.

If you leave this field empty, the sender falls back to its own process [Correlation Key](help://bpmn/properties/process). If neither side sets a value, the message is matched by name only and reaches every waiting element.

## Writing the formula

The formula reads from the data available where the message is sent. Address the value you want to correlate on, for example:

```feel
token.orderId
```

A nested value:

```feel
token.customer.accountNumber
```

A combined value:

```feel
token.region + "-" + string(token.orderId)
```

See [FEEL Expressions](help://bpmn/runtime_expressions) for the full formula reference.
