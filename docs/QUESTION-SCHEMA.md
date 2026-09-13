# Master question schema

Playable items are merged from:

1. `data/master-seed-questions.json` (190 seed rows)
2. The original in-app bank (`src/data/questions.ts` + `moreQuestions.ts`), converted to this schema
3. `src/data/gapQuestions.ts` originals that fill thin categories in `CATEGORIES.md`

The live deck is built in `src/data/bank.ts` (**395** playable after the current merge). A question is **playable** only if `active === true` and `quality_score >= 0.7`. Duplicates are dropped by normalized question text + correct answer. A round shuffles and never reuses a `question_id`.

## Fields

| Field | Meaning |
| --- | --- |
| `question_id` | Stable id (`MATH-001`, `LEGACY-SCI-01`, `GAP-LIT-001`) |
| `category` | One of the 30 master categories |
| `subcategory` | Finer topic (Arithmetic, Toho, …) |
| `difficulty` | Integer **1–10** (easy 1–3, medium 4–6, hard 7–10) |
| `grade_min` / `grade_max` | Suggested grade band (hook for a later adaptive engine) |
| `question_type` | `MULTIPLE_CHOICE` (UI default), `TRUE_FALSE`, `RIDDLE`, `SHORT_ANSWER`, `BOSS` |
| `question` | Prompt text |
| `choices` | Two or more options (TF/riddle/short still present as MC when choices exist) |
| `correct_answer` | Canonical right answer (must match a choice) |
| `accepted_answers` | Extra STT / parser aliases |
| `explanation` | Shown on the round result |
| `time_limit_seconds` | Stored per item; the room timer in Setup still drives the live clock |
| `base_points` | Default 100; boss fillers may use 150 |
| `speed_bonus` | If true, add ~50 / ~30 / ~15 by response time |
| `steal_allowed` | Stored for a future steal mode; unused in scoring today |
| `source_verified` | Editorial flag from the seed |
| `active` | Soft-delete |
| `quality_score` | 0–1; below 0.7 is filtered out |

Legacy easy / medium / hard maps to numeric **2 / 5 / 8**.

`BOSS` items (and the last question of a match) score at **3×**.

Not in this release: full adaptive engine, steal / sudden death, picture or sound prompts, parent-authored questions, 50k generator.
