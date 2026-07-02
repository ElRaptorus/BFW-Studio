---
title: Assignees
---

# Assignees

Assignees are the people or groups allowed to see, reserve, and finish a [User Task](help://bpmn/properties/user_task). When a task has assignees, only they can work on it.

The `Assignees` field is a [formula](help://bpmn/runtime_expressions) that must resolve to a single name or a list of names. Because it is a formula, you can name people directly or work them out from the process data.

> Assignees can open the task even without the usual lane permission.

## Examples

A single person, named directly:

```feel
"UserIdA"
```

Taken from the process data:

```feel
token.assignedUser
```

Several people at once:

```feel
["UserIdA", "User@Email.com"]
```

The person who started the process:

```feel
[identity.id]
```

Different people depending on the situation:

```feel
if token.priority > 5 then ["admin"] else ["standard"]
```
