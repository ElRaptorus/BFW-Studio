---
# This is a comment, which might be helpful to explain the concept of help texts
title: Assigned Users
---

# Assigned Users

Assigning Users to a `User Task` ensures that only these specific Users can read, reserve and finish the `User Task`.

Assignees are configured via a single `evil:assignees` FEEL expression. The expression must resolve to a string or a list of strings.

**Note:**
Assignees do not require the Lane Claim for accessing the `User Task`.

## Examples

Single assignee:

```
"UserIdA"
```

From token:

```
token.assignedUser
```

List of assignees:

```
["UserIdA", "User@Email.com"]
```

From identity:

```
[identity.id]
```

Conditional assignees:

```
if token.priority > 5 then ["admin"] else ["standard"]
```
