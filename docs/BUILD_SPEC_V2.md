# Voicewell build spec v2: accounts, more topics, better feedback

This extends `docs/BUILD_SPEC.md`. Everything in v1 still holds unless this file changes it. It is written for coding agents working in parallel; each section names its owner.

Owners: **backend** = `backend/app/**` except `backend/app/content/`; **frontend** = `frontend/**`; **content** = `backend/app/content/**` only.

## 1. Accounts (JWT login and signup)

Product rule: an account holds only an email, a display name and a password hash. No age, date of birth, health content, lesson state or transcript is ever written to disk or linked to an account. Practice data stays in the in-memory session exactly as in v1.

### 1.1 Backend (owner: backend)
- Storage: SQLite via the standard library `sqlite3`, file `backend/data/voicewell.db` (folder already gitignored; create it on startup). One table:
  `users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL)`.
- Passwords: `bcrypt` (add the `bcrypt` package). Minimum 8 characters, maximum 128. Email trimmed, lowercased, basic format check. Display name 1–40 characters, trimmed; default to the part of the email before `@`.
- Tokens: `PyJWT`, HS256, secret `JWT_SECRET` from `.env` (already there). Claims: `sub` (user id), `email`, `name`, `iat`, `exp` = 7 days. Sent only as cookie `vw_token`: httpOnly, SameSite=Lax, path `/`, max-age 7 days, not Secure (localhost).
- Routes (all JSON, errors as v1 `{error, message}`):

| Route | Body | Success | Errors |
| --- | --- | --- | --- |
| `POST /api/auth/signup` | `{email, password, displayName?}` | 201 `{user}` + sets `vw_token` | 400 `invalid_input` (message says which field), 409 `email_taken` |
| `POST /api/auth/login` | `{email, password}` | 200 `{user}` + sets `vw_token` | 401 `invalid_credentials` (same message for unknown email and wrong password) |
| `POST /api/auth/logout` | – | 200 `{ok:true}`; clears `vw_token` and `vw_sid`, deletes the in-memory session | – |
| `GET /api/auth/me` | – | 200 `{user}` | 401 `not_authenticated` |

  `user` = `{id, email, displayName}`.
- Auth guard: every `/api/*` route except `/api/health` and `/api/auth/{signup,login,logout,me}` requires a valid `vw_token`, else 401 `not_authenticated`. This check runs before the v1 session check, so a request with no token never sees `no_session`. `WS /api/practice/voice` checks it on connect (accept, send `{"type":"error","code":"not_authenticated"}`, close 4401).
- Session binding (FR-7, no access to another person's data): store `user_id` on the in-memory session when `/api/kid/claim` creates or upgrades it. Every session-bound route treats a session whose `user_id` differs from the token's `sub` as missing (`no_session`). Logging in as another user therefore never reaches the previous user's session.
- Logging: never log emails, passwords, tokens or hashes. The access log already hashes the sid; do the same for user id if logged at all.
- Tests (no network): signup → me → logout → me 401; duplicate email 409; wrong password 401; short password 400; guarded route without token 401 `not_authenticated`; session of user A not reachable with user B's token; password stored as bcrypt hash, not plain text.

### 1.2 Frontend (owner: frontend)
- New screens `/login` and `/signup` in the design's style: centered `flow-shell` card, brand at top, fields with labels, primary button, link to switch between them, plain error text from the API message. Signup fields: display name, email, password (show the 8-character rule). A one-line note under the form: "We only keep your email and name. Your practice is never saved to your account."
- Routing: `/login` and `/signup` are public. Every other screen requires a signed-in user: on app start call `GET /api/auth/me`; a 401 sends the user to `/login?next=<path>`. Any API call returning 401 `not_authenticated` does the same. Keep v1's `no_session` → `/age` behaviour for the other 401.
- After login or signup, go to `next` or `/`.
- Header: show the display name and a "Log out" button (calls logout, clears `kid.*` and `vw.*` localStorage keys, goes to `/login`). Keep the "Permissions" link.

## 2. Topics (owners: backend + content)

The MVP ships three topics. A topic is one JSON file in `backend/app/content/`: `stress.json`, `menopause.json`, `appointment.json`.

### 2.1 Topic file schema (owner: content)
v1's `stress.json` schema plus these top-level fields:
```json
{
  "topic": "menopause",
  "title": "Understanding menopause",
  "summary": "One sentence for the topic card.",
  "icon": "heart",
  "order": 2,
  "practice_goal": {
    "myself": "One sentence describing the scenario the user rehearses, written to the persona.",
    "someone-else": "Same, for supporting someone else."
  },
  "persona_rules": {
    "myself": [{"minAge": 65, "persona": "doctor"}, {"persona": "doctor"}],
    "someone-else": [{"persona": "relative"}]
  },
  "key_questions": {
    "myself": ["3 to 5 questions a person in this conversation would usefully ask"],
    "someone-else": ["..."]
  },
  "concepts": [ "...exactly 7, as in v1..." ]
}
```
- `icon` is one of `calendar`, `heart`, `book`, `spark`.
- `persona_rules[intent]` is checked in order; the first rule whose `minAge`/`maxAge` (both optional, inclusive) match the user's age wins. The last rule has no bounds.
- `practice_goal` is our own text and is appended to the persona's system prompt; it never contains user text.
- `key_questions` feed the feedback's "questions you could ask".

Topics and personas:

| Topic | myself | someone-else |
| --- | --- | --- |
| `stress` (order 1) | under 65 `trusted-adult`, 65+ `doctor` | `guarded-teen` |
| `menopause` (order 2) | `doctor` | `relative` (a parent going through menopause, e.g. "Linda, your mum") |
| `appointment` (order 3, "Preparing for a doctor's appointment") | `doctor` | `older-parent` (an older parent preparing for their appointment, e.g. "Frank, your dad") |

New personas appended to `personas.json`, same schema as v1: `relative` (voice `Wendy`), `older-parent` (voice `Theodore`). Both keep every v1 guardrail line in their system prompt.

### 2.2 Backend changes (owner: backend)
- `GET /api/topics` (auth only, no k-ID session needed) → `{topics: [{id, title, summary, icon, intents: ["myself","someone-else"]}]}` sorted by `order`, built from every `*.json` in content that has a `concepts` key. Load lazily; skip files that fail to parse and log the file name.
- `POST /api/onboarding` accepts any topic id from that list (400 `invalid_input` otherwise).
- Lesson routes become `GET /api/lesson/{topic}/next` and `GET /api/lesson/{topic}/simpler`; 409 `topic_mismatch` if `{topic}` differs from the session's topic. Changing topic in onboarding resets lesson state and practice turns.
- `SessionConfig.topic` becomes `string | null`; add `topicTitle: string | null`.
- Persona resolution uses the topic's `persona_rules` (v1's hard-coded stress mapping moves into `stress.json` via content). If a topic file lacks `persona_rules`, fall back to v1 behaviour.
- Persona system prompt = `persona.system_prompt` + `"\n\nScenario: " + topic.practice_goal[intent]` + `"\n\nStyle: " + band_style[band]`. Use this for both typed and voice practice.
- `GET /api/practice/starters` returns the persona's starters (unchanged).

## 3. Better feedback

### 3.1 Feedback v2 shape (owner: backend; frontend renders it)
```ts
interface FeedbackItem { point: string; quote?: string }          // quote = the user's own words, verbatim
interface PhraseSwap { instead?: string; try: string }              // instead = user's words, verbatim
interface Skill { name: 'Opening' | 'Listening' | 'Clarity' | 'Questions'; level: 'Strong' | 'Growing' | 'Try next'; note: string }
interface Feedback {
  summary: string                 // one warm, specific sentence about this conversation
  skills: Skill[]                 // exactly the four names, in that order
  strengths: FeedbackItem[]       // 1–3
  improvements: FeedbackItem[]    // 1–3
  missingQuestions: string[]      // 1–3, prefer the topic's key_questions not yet asked
  suggestedPhrases: PhraseSwap[]  // 1–3, rewrites of the user's own lines where possible
  tone?: string                   // v1 rule, adults with voice only
  turnsPracticed: number
}
```
No numeric score anywhere (PRD: not a score).

### 3.2 Generation (owner: backend)
- Model: `FEEDBACK_MODEL` from `.env` (`anthropic/claude-haiku-5-5`, verified available), falling back to `LLM_MODEL` if the call fails. `max_tokens` 900, temperature 0.3, 15 s timeout.
- Prompt context (system message, our text only): the topic title, the intent, the persona's name and role (`description`), the scenario (`practice_goal`), the learner's age band reading level, the topic's `key_questions[intent]`, and the rules: judge communication only; never name a condition, diagnosis, medicine or dose; never judge anyone's mental health; refer to the other speaker by the persona's name, never "partner" or "the AI"; quotes must be copied exactly from the user's lines; write to the user as "you".
- The transcript goes in a single user message, lines labelled `You:` and `<persona name>:`.
- Validation: parse JSON (strip code fences). Drop any `quote` or `instead` that is not a verbatim substring (case-insensitive, whitespace-normalised) of the user's turns. Run `scan_output` on every string and drop matching items. Clamp list lengths. If `skills` is incomplete, fill missing names with level `Growing` and a generic note. Retry once on failure, then use the fixed fallback (content provides `fallback_feedback` in v2 shape, see 4.2).
- A practice with fewer than 2 user turns still returns feedback, with `summary` saying a longer practice gives richer feedback.
- Keep v1's caching and clearing behaviour.
- Tests: quote not in transcript is dropped; condition word dropped; skills always four in order; fallback has the v2 shape.

### 3.3 Feedback screen (owner: frontend)
Order on the page: summary as the hero subtitle → four skill chips in a row (name, level badge: Strong = teal, Growing = sand, Try next = lavender; note under it) → "What went well" cards, each with the quote in Newsreader italics when present → "Try next" cards with quotes → "Try saying" cards showing `instead` struck through or muted and `try` in Newsreader italics → "Questions you could ask" list → tone line → buttons "Practise again", "Back to lessons", "Pick another topic". The page header keeps the design's "This is feedback on how you communicated, not a score and not a medical assessment."

## 4. Content (owner: content)

### 4.1 Files
- Add the v2 top-level fields (2.1) to `stress.json` without changing its concepts' existing text, except: extend the four `deep` variants that are under 90 words (`why-emotions-shift`, `what-helps-now`, `talking-it-through`, `plan-the-conversation`, both `body` and `body_someone_else`) to 90–140 words.
- Write `menopause.json` and `appointment.json` in full (7 concepts each, first 4 core, three depths, quick checks), same word limits and tone as v1.
- Append the two personas to `personas.json`.

### 4.2 `fallback_feedback` in `safety.json`
Replace only the `fallback_feedback` object with the v2 shape (`summary`, four `skills`, `strengths`/`improvements` as `{point}` objects, `missingQuestions`, `suggestedPhrases` as `{try}` objects). Do not change any other key in `safety.json`, and do not add or edit any self-harm material.

### 4.3 Content rules
- General, accurate, non-diagnostic, warm, plain. No medicine names or doses. Menopause content may name common experiences (hot flushes, sleep changes, mood changes, irregular periods) in everyday words, and always routes medical questions to a doctor.
- Appointment content teaches how to describe what you have noticed (when it started, how often, what makes it better or worse, how it affects daily life), how to bring a list, how to ask questions and check understanding, and how to ask for simpler words. It never suggests what a symptom might mean.
- Before finishing, validate with a throwaway Python script: JSON parses, schema and counts, word limits, every persona referenced by a `persona_rules` exists in `personas.json`, every regex in `safety.json` still compiles.
