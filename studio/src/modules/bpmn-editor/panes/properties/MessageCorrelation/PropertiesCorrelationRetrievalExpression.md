---
title: Correlation Retrieval Expression
---

# Correlation Retrieval Expression

The **Correlation Retrieval Expression** is a [FEEL expression](help://bpmn/runtime_expressions) evaluated against the incoming message payload to extract a correlation value. The engine compares this extracted value against the process-level [Correlation Key](help://bpmn/properties/process) to determine whether a message matches a waiting subscription.

This property is available on catch-side message elements: Message Intermediate Catch Events, Message Boundary Events, and Receive Tasks.

## How correlation works

1. A process declares a **Correlation Key** (process-level property) — a FEEL expression evaluated against the process instance's token to produce a correlation value.
2. When a catch-side message element subscribes for a message, the engine stores the evaluated correlation key alongside the subscription.
3. When a message arrives, the engine evaluates the **Correlation Retrieval Expression** against the message payload and compares the result to each subscription's stored correlation value.
4. Only subscriptions whose correlation value matches are delivered the message.

## Examples

**Extract an order ID from the message payload:**

```
payload.orderId
```

**Use a nested field:**

```
payload.customer.accountNumber
```

**Composite correlation value:**

```
payload.region + "-" + string(payload.orderId)
```

## Behavior

- If no correlation retrieval expression is set and the process has no correlation key, the message is matched by name only.
- The expression has access to `payload` — the incoming message data — as its evaluation context.
- The result is compared for equality against the process's evaluated correlation key.
