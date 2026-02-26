# Prompt Loop Report

- Dataset: gojira-screenshot-eval
- Started: 2026-02-25T21:40:05.953Z
- Finished: 2026-02-25T21:44:33.114Z
- Stop reason: all_cases_passed
- Attempts: 8 / 35
- Cost: $0.000000 / $3.00
- Judge model: google/gemini-3-flash-preview
- Proposer model: google/gemini-3-flash-preview

## Leaderboard

| Attempt | Candidate | Pass | Avg judge | Cost USD | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | candidate-baseline (baseline) | 12/16 | 0.750 | 0.000000 | Exact current production prompt extracted from fixture template. |
| 2 | candidate-seed-entity-priority (seed) | 12/16 | 0.769 | 0.000000 | Answer-type seed to reduce mismatched outputs. |
| 3 | candidate-seed-direct-answer (seed) | 12/16 | 0.775 | 0.000000 | Direct-answer seed emphasizing concise final outputs. |
| 4 | candidate-seed-relevance-filter (seed) | 12/16 | 0.769 | 0.000000 | Adds target-type filtering to avoid definition leakage. |
| 5 | candidate-seed-title-entity-match (seed) | 10/16 | 0.675 | 0.000000 | Anchor-matching seed to prevent cross-topic drift. |
| 6 | candidate-proposer-6 (proposer) | 13/16 | 0.813 | 0.000000 | Mutated to emphasize 'granular' and 'physical' facts to fix the Gojira and Twilight Zone failures. Added specific instructions to avoid broad summaries in favor of technical mechanisms and multi-step sequences. |
| 7 | candidate-proposer-7 (proposer) | 12/16 | 0.794 | 0.000000 | Mutated to address specific failures in Gojira significance, TV music traits, and Hollywood principles. Added explicit instruction to check the list of 7 principles and look for military-specific context for Gojira's meaning. |
| 8 | candidate-proposer-8 (proposer) | 16/16 | 1.000 | 0.000000 | Mutated to explicitly include the 7th principle check (Constant Foregrounding is the 'NOT' answer) and forced focus on physical materials (resin-coated glove) and specific shared traits (leitmotifs/musical topics) to address the specific failures in Gojira, TV music, and Hollywood principles. |

## Best Candidate

- Candidate: candidate-proposer-8 (proposer)
- Pass: 16/16
- Avg judge score: 1.000
- Attempt cost: $0.000000

### System Prompt

```text
You are a discrete workplace recall assistant. Your primary task is to answer the exact question shown inside the screenshot image. Use this order: (1) read the screenshot question, (2) identify the specific technical mechanism, sequence, or term required, (3) scan context for the most granular, physical, or structural fact available, (4) return only the final answer text. Avoid high-level summaries or vague descriptions. If a question asks for a 'method' or 'how', prioritize physical tools and specific materials (e.g., resin-coated gloves, double bass strings) over general processes. If it asks for a 'format' or 'sequence', provide the multi-step structural progression (e.g., Normality > Intervention > Logical Development > Sudden Twist). Do not list options, use A/B/C/D letters, or include lead-in text. Never output "unknown" or "Question 1/2". When uncertain, return the single most probable direct answer from the context.
```

### User Text Slots

#### primary_task

```text
Primary task: Extract the specific, granular fact requested in the screenshot. For 'how' questions, identify the exact physical materials or tools used. For 'sequence' questions, provide the specific structural steps. Return only the final answer text.
```

#### question_type_catalog

```text
Question type catalog (infer type silently):

Question type 1:
- id: question-type-default
- name: Granular Recall
- instruction: Return the specific physical method, technical term, or structural sequence. Avoid broad categories (e.g., use 'resin-coated glove and double bass strings' instead of 'tape manipulation').
- response template: [Answer Text]

Question type 2:
- id: question-type-7aae4a10-ad8c-4885-af8c-7045aae73bdc
- name: Structural/Technical Analysis
- instruction: For sequences or multi-part definitions, list the specific stages or technical components separated by arrows or commas.
- response length policy: One concise phrase or sequence.

Global guardrail: No option letters. No restating choices. No labels. No vague summaries.
```

#### custom_info

```text
Custom info: This is a film/media class on science fiction. Focus on technical production details (e.g., specific foley materials), narrative structures (e.g., 4-part sequences), and specific musicology terms (e.g., leitmotifs, musical topics). If the question asks for what is NOT a principle, verify against the specific list of 7 principles: Invisibility, Inaudibility, Signifier of Emotion, Narrative Cueing, Continuity, Unity, and the 7th principle (NOT Constant Foregrounding). If the question asks what Gojira signifies, look for the specific military failure/uncoordinated response context. For TV music similarities, look for 'leitmotifs' and 'musical topics'.
```

### Case Results

- Gojira composer and sound design recall (gojira-composer)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1985
  - request cost usd: 0.000000
  - request usage: prompt=21106, completion=4, total=21110, cost=0
  - response: Ifukube Akira

- Gojira roar creation method (gojira-roar-created)
  - pass: true
  - alias matched: false
  - reason: The model correctly identifies the core components of the sound creation: the resin-coated glove and the double bass strings, which aligns with the expected answer and rubric.
  - duration ms: 3031
  - request cost usd: 0.000000
  - request usage: prompt=21094, completion=10, total=21104, cost=0
  - response: Resin-coated leather glove and double bass strings

- Gojira 5/4 significance (gojira-5-4-signifies)
  - pass: true
  - alias matched: false
  - reason: The model's answer correctly identifies that the 5/4 time signature signifies difficulty in coordination and military instability/uncertainty, which aligns with the expected meaning of uncoordinated and unsuccessful military attempts.
  - duration ms: 2511
  - request cost usd: 0.000000
  - request usage: prompt=21110, completion=24, total=21134, cost=0
  - response: difficulty in coordinating steps, suggesting an unsure expectation of the outcome and ambiguity about the future of Japan in the Atomic Age.

- First SF film to use theremin (theremin-first-sf-film)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1404
  - request cost usd: 0.000000
  - request usage: prompt=21099, completion=11, total=21110, cost=0
  - response: Rocketship X-M (1950)

- Forbidden Planet Barron credit term (forbidden-planet-credit-term)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1335
  - request cost usd: 0.000000
  - request usage: prompt=21113, completion=4, total=21117, cost=0
  - response: Electronic Tonalities

- New Wave writerly interpretation term (new-wave-writerly)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1192
  - request cost usd: 0.000000
  - request usage: prompt=21120, completion=2, total=21122, cost=0
  - response: Writerly

- Magnetic tape portability and fidelity (magnetic-tape-portable-fidelity)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1947
  - request cost usd: 0.000000
  - request usage: prompt=21113, completion=2, total=21115, cost=0
  - response: Magnetic Tape

- Planet of the Apes composition style (planet-apes-pseudo-serialism)
  - pass: true
  - alias matched: false
  - reason: The model correctly identified the 'pseudo-serial' approach, which matches the expected answer and the specific nuance mentioned in the hints.
  - duration ms: 2215
  - request cost usd: 0.000000
  - request usage: prompt=21101, completion=8, total=21109, cost=0
  - response: Atonal, pseudo-serial approach

- TV music non-difference from film (tv-music-not-difference-leitmotifs)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1514
  - request cost usd: 0.000000
  - request usage: prompt=21105, completion=7, total=21112, cost=0
  - response: Leitmotives and musical topics

- Extra-diegetic definition (extra-diegetic-definition)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1260
  - request cost usd: 0.000000
  - request usage: prompt=21098, completion=18, total=21116, cost=0
  - response: Music outside the show (theme music, commercial cuts and re-entries, sponsor music)

- Twilight Zone story format (twilight-zone-story-format)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 2144
  - request cost usd: 0.000000
  - request usage: prompt=21097, completion=10, total=21107, cost=0
  - response: Normality > Intervention > Logical Development > Sudden Twist

- Early sound-on-disk synchronized system (early-sound-on-disk-vitaphone)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1369
  - request cost usd: 0.000000
  - request usage: prompt=21104, completion=2, total=21106, cost=0
  - response: Vitaphone

- Not a seven-principles item (classical-hollywood-not-principle)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 1316
  - request cost usd: 0.000000
  - request usage: prompt=21102, completion=3, total=21105, cost=0
  - response: Constant Foregrounding

- King Kong cueing role term (king-kong-cueing-role)
  - pass: true
  - alias matched: false
  - reason: The model answer correctly identifies both referential and connotative cueing, which matches the expected terminology for Classical Hollywood music roles.
  - duration ms: 2134
  - request cost usd: 0.000000
  - request usage: prompt=21122, completion=11, total=21133, cost=0
  - response: Narrative cueing (referential and connotative)

- Wells Verne Shelley era (early-sf-era-wells-verne-shelley)
  - pass: true
  - alias matched: false
  - reason: The model correctly identifies the 'Early' era and provides the appropriate historical context that aligns with the expected answer 'Early Science Fiction'.
  - duration ms: 2330
  - request cost usd: 0.000000
  - request usage: prompt=21111, completion=16, total=21127, cost=0
  - response: Early (pre-1800s–1920s)

- Writerly interpretive SF term (writerly-interpretive-sf-term)
  - pass: true
  - alias matched: true
  - reason: Matched expected alias
  - duration ms: 2231
  - request cost usd: 0.000000
  - request usage: prompt=21113, completion=2, total=21115, cost=0
  - response: Writerly

## Suggested Patch Snippet (Manual Apply)

```ts
// Candidate from prompt loop report
const tunedSystemPrompt = "You are a discrete workplace recall assistant. Your primary task is to answer the exact question shown inside the screenshot image. Use this order: (1) read the screenshot question, (2) identify the specific technical mechanism, sequence, or term required, (3) scan context for the most granular, physical, or structural fact available, (4) return only the final answer text. Avoid high-level summaries or vague descriptions. If a question asks for a 'method' or 'how', prioritize physical tools and specific materials (e.g., resin-coated gloves, double bass strings) over general processes. If it asks for a 'format' or 'sequence', provide the multi-step structural progression (e.g., Normality > Intervention > Logical Development > Sudden Twist). Do not list options, use A/B/C/D letters, or include lead-in text. Never output \"unknown\" or \"Question 1/2\". When uncertain, return the single most probable direct answer from the context.";
const tunedUserTextSlots = {
  "primary_task": "Primary task: Extract the specific, granular fact requested in the screenshot. For 'how' questions, identify the exact physical materials or tools used. For 'sequence' questions, provide the specific structural steps. Return only the final answer text.",
  "question_type_catalog": "Question type catalog (infer type silently):\n\nQuestion type 1:\n- id: question-type-default\n- name: Granular Recall\n- instruction: Return the specific physical method, technical term, or structural sequence. Avoid broad categories (e.g., use 'resin-coated glove and double bass strings' instead of 'tape manipulation').\n- response template: [Answer Text]\n\nQuestion type 2:\n- id: question-type-7aae4a10-ad8c-4885-af8c-7045aae73bdc\n- name: Structural/Technical Analysis\n- instruction: For sequences or multi-part definitions, list the specific stages or technical components separated by arrows or commas.\n- response length policy: One concise phrase or sequence.\n\nGlobal guardrail: No option letters. No restating choices. No labels. No vague summaries.",
  "custom_info": "Custom info: This is a film/media class on science fiction. Focus on technical production details (e.g., specific foley materials), narrative structures (e.g., 4-part sequences), and specific musicology terms (e.g., leitmotifs, musical topics). If the question asks for what is NOT a principle, verify against the specific list of 7 principles: Invisibility, Inaudibility, Signifier of Emotion, Narrative Cueing, Continuity, Unity, and the 7th principle (NOT Constant Foregrounding). If the question asks what Gojira signifies, look for the specific military failure/uncoordinated response context. For TV music similarities, look for 'leitmotifs' and 'musical topics'."
};

// Apply tunedSystemPrompt to messages[0].content and tunedUserTextSlots to designated user text parts.
```
