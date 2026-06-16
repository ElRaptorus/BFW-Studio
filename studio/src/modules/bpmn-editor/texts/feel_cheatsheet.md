---
title: FEEL Cheatsheet
---

# FEEL Cheatsheet

A quick reference for the most commonly used FEEL expressions and operators. For the full expression guide, see [FEEL Expressions](help://bpmn/runtime_expressions).

## Data Types

| Type                    | Example                                |
| ----------------------- | -------------------------------------- |
| Number                  | `42`, `3.14`, `-7`                     |
| String                  | `"hello"`, `"world"`                   |
| Boolean                 | `true`, `false`                        |
| Date                    | `date("2026-01-15")`                   |
| Time                    | `time("14:30:00")`                     |
| Date and Time           | `date and time("2026-01-15T14:30:00")` |
| Duration (years/months) | `duration("P1Y6M")`                    |
| Duration (days/time)    | `duration("P2DT3H")`                   |
| List                    | `[1, 2, 3]`                            |
| Context                 | `{ name: "Alice", age: 30 }`           |
| Null                    | `null`                                 |

## Arithmetic

| Expression | Result   |
| ---------- | -------- |
| `4 + 3`    | `7`      |
| `10 - 4`   | `6`      |
| `3 * 5`    | `15`     |
| `10 / 3`   | `3.333…` |
| `2 ** 3`   | `8`      |

## Comparison

| Expression | Result  |
| ---------- | ------- |
| `5 = 5`    | `true`  |
| `5 != 3`   | `true`  |
| `3 < 5`    | `true`  |
| `5 <= 5`   | `true`  |
| `7 > 3`    | `true`  |
| `7 >= 8`   | `false` |

## Boolean Logic

FEEL uses three-valued logic (`true`, `false`, `null`):

| Expression       | Result  |
| ---------------- | ------- |
| `true and true`  | `true`  |
| `true and false` | `false` |
| `true or false`  | `true`  |
| `not(true)`      | `false` |
| `null and true`  | `null`  |

## Strings

| Expression                   | Result          |
| ---------------------------- | --------------- |
| `"hello" + " world"`         | `"hello world"` |
| `contains("foobar", "bar")`  | `true`          |
| `starts with("hello", "he")` | `true`          |
| `ends with("hello", "lo")`   | `true`          |
| `substring("hello", 2, 3)`   | `ell`           |
| `string length("hello")`     | `5`             |
| `upper case("hello")`        | `"HELLO"`       |
| `lower case("HELLO")`        | `"hello"`       |
| `replace("foo", "o", "a")`   | `"faa"`         |
| `matches("abc", "a.*c")`     | `true`          |

## If / Then / Else

```
if token.amount > 1000 then "high" else "normal"
```

## Ranges

| Expression | Meaning                    |
| ---------- | -------------------------- |
| `[1..10]`  | 1 to 10, inclusive         |
| `(0..100)` | 0 to 100, exclusive        |
| `[0..100)` | 0 inclusive, 100 exclusive |

**Usage in conditions:**

```
if token.score in [80..100] then "pass" else "fail"
```

## Lists

| Expression                    | Result              |
| ----------------------------- | ------------------- |
| `[1, 2, 3][1]`                | `1` (1-based index) |
| `list contains([1, 2, 3], 2)` | `true`              |
| `count([1, 2, 3])`            | `3`                 |
| `sum([1, 2, 3])`              | `6`                 |
| `min([3, 1, 2])`              | `1`                 |
| `max([3, 1, 2])`              | `3`                 |
| `mean([2, 4, 6])`             | `4`                 |
| `flatten([[1, 2], [3]])`      | `[1, 2, 3]`         |
| `distinct values([1, 2, 1])`  | `[1, 2]`            |
| `append([1, 2], 3)`           | `[1, 2, 3]`         |
| `sublist([1, 2, 3, 4], 2, 2)` | `[2, 3]`            |

## Iteration

```
for x in [1, 2, 3] return x * 2
```

Result: `[2, 4, 6]`

## Filtering

```
token.items[status = "active"]
```

Returns only items where `status` equals `"active"`.

## Quantified Expressions

**Some (existential):**

```
some x in token.items satisfies x.amount > 100
```

**Every (universal):**

```
every x in token.items satisfies x.status = "approved"
```

## Contexts (Objects)

```
{ name: "Order", total: token.price * token.quantity }
```

**Property access:**

```
token.customer.address.city
```

## Date and Time

| Expression                          | Description           |
| ----------------------------------- | --------------------- |
| `now()`                             | Current date and time |
| `today()`                           | Current date          |
| `day of week(date("2026-01-15"))`   | Day name              |
| `month of year(date("2026-03-01"))` | Month name            |
| `duration("P1D")`                   | One day duration      |
| `duration("PT2H30M")`               | 2 hours 30 minutes    |

**Date arithmetic:**

```
today() + duration("P7D")
```

## Type Checking

```
token.value instance of number
```

## Null Handling

FEEL propagates `null` through most operations. Guard with:

```
if token.optionalField != null then token.optionalField else "default"
```

---

## External Resources

- [Learn DMN in 15 Minutes — The FEEL Language](https://learn-dmn-in-15-minutes.com/learn/the-feel-language) — community-driven, example-guided introduction
- [DMN FEEL Handbook](https://kiegroup.github.io/dmn-feel-handbook/) — comprehensive pocket reference (KIE open-source community)
- [OMG DMN Specification — FEEL (Clause 10)](https://github.com/omg-dmn-taskforce/plain-text-spec/blob/main/10-expression-language-FEEL.adoc) — formal grammar and semantics
