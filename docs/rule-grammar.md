# Kanji Shift Rule Grammar (Pre-Sprint 2)

This document defines the current rule grammar, parsing pipeline, and role semantics used by the simulation engine.

## Goals

- Keep rule parsing deterministic and grid-based
- Allow object kanji to participate in rule noun slots (emergent behavior)
- Make it straightforward to add new operators/verbs before Sprint 2

## Terminology

- **Noun carrier**: any entity with a `nounKey`
  - object noun (example: `obj-human`)
  - noun text tile (example: `txt-human`)
- **Connector**: grammar bridge (currently `は`)
- **Operator**: chaining token (currently `と`)
- **Property term**: text property token (example: `遊`, `勝`)
- **Transform term**: noun carrier used on the right side of `は`

## Current Formal Grammar (EBNF-style)

Parsing is performed independently on each axis (`horizontal`, `vertical`).

```ebnf
RuleLine      ::= NounTerm Connector TailTerms
TailTerms     ::= TailTerm (And TailTerm)*
TailTerm      ::= PropertyTerm | NounTerm

NounTerm      ::= NounCarrier
Connector     ::= "は"
And           ::= "と"

PropertyTerm  ::= "遊" | "押" | "引" | "止" | "勝" | "浮" | "沈" | "熱" | "溶"
```

## Grid Interpretation Rules

- Tokens are read from **adjacent cells only** (no gaps).
- A valid rule must occupy at least 3 cells:
  - noun slot
  - connector slot (`は`)
  - one term slot (property or noun)
- Chaining requires an alternating pattern:
  - `term`, `と`, `term`, `と`, `term`, ...

Example:

```text
門 は 勝 と 止
```

Parses as:

- `門 は 勝`
- `門 は 止`

## Important Semantic Choice: Object Nouns Can Fill Noun Slots

The parser accepts **either** noun text or object tiles in noun positions.

This enables emergent behaviors like:

- moving `obj-human` into the noun slot of `人 は 遊`
- moving `obj-gate` into the noun slot of `門 は 勝`

This applies to both left-hand nouns and noun terms on the right-hand side (`NOUN は NOUN`).

## Parsed Rule Outputs

The parser emits normalized rules:

- **Property rule**
  - `NOUN は PROPERTY`
- **Transform rule**
  - `NOUN は NOUN`

Each parsed rule stores:

- noun / property (or target noun)
- axis (`horizontal` or `vertical`)
- source cells used for the rule

The source cell list is important for:

- UI highlighting
- rule-change effects
- noun-slot-trigger role transfer logic

## Property Application Hierarchy

Property queries (`hasProp`) resolve in this order:

1. `defaultProps` on the entity definition
2. Rule-derived properties for matching object nouns
3. Text tiles do **not** receive noun-rule properties (v1 rule semantic)

This prevents `人 は 遊` from making the `txt-human` text tile controllable while still allowing text tiles to remain pushable through `defaultPushable`.

## Role Semantics (`遊` / `勝`)

The simulation uses a **focused** player and goal:

- `focusYouId`
- `focusWinId`

This differs from classic Baba semantics and is intentional for this prototype.

### Role assignment triggers

- Rule creation capture (new `... は 遊` or `... は 勝`)
- Noun-slot trigger capture:
  - when a moved noun carrier enters the noun slot (left of `は`) for an active rule

### Noun-slot trigger behavior (current)

- `... は 遊`: control transfers to another matching noun carrier if available
- fallback can use the moved-in carrier
- selection prefers the candidate nearest the current player anchor

### Win special case

- Touching the focused goal should win even if the goal would otherwise be pushable/blocking
- Self-win (same entity as focused player and focused goal) is prevented

## Extension Plan for Sprint 2+ (Verbs/Operators)

The parser is now split into:

1. **Tokenization pass**
   - classifies per-cell noun/property/connector/operator tokens
2. **Grammar matcher**
   - matches `Noun + は + tail-terms` along each axis

To add more grammar cleanly, the next step is to introduce:

- explicit connector/operator registries (instead of `hasTopic` / `hasAnd` booleans)
- rule AST nodes (beyond current normalized rules)
- evaluator registry (property, transform, conditional, interaction rules)

Suggested next grammar extensions:

- additional connectors/verbs (new semantics after `は`)
- grouped/typed tail terms
- conditionals (context-sensitive rules)
- directional or relation operators

## Current Scope (Intentionally Limited)

- No parentheses/grouping
- No negation
- No precedence beyond left-to-right chained `と`
- No free-form language parsing (curated symbolic grammar only)

This keeps the system readable and deterministic while still enabling emergent interactions through spatial play.
