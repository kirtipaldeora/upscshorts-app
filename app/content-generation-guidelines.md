# Penni Current Affairs Generation Guidelines

Use this standard whenever creating new daily news JSON for Penni.

## Prelims Questions

Prelims questions must match UPSC CSE Prelims depth. Do not create one-word recall prompts such as "X is:", "Y is headquartered at:", or "Z is associated with:" unless the options test conceptual discrimination.

Each article should preferably include two prelims questions:

- One question based directly on the verified news development but testing its mechanism, implication or institutional setting rather than headline recall.
- One applied/static-linkage question connecting the development to a constitutional provision, institution, geography, economy concept, science principle, environment convention or international organisation.
- The two questions must use different formats from the approved patterns below.

### Approved UPSC question patterns

Use the English style and logical structure seen in actual UPSC General Studies Paper I questions. Correct obvious OCR or printing errors in source papers; never reproduce them.

1. **Count-based statements**
   - Stem: `Consider the following ... I. ... II. ... III. ... How many of the above are correct?`
   - Options should count correct statements: `Only one`, `Only two`, `All three`, `None` (or the corresponding four-statement pattern).
2. **Statement combinations**
   - Stem: `With reference to [topic], consider the following statements: ... Which of the statements given above is/are correct?`
   - Options must be complete, non-duplicative combinations such as `I and II only`, `II and III only`, `I and III only`, `I, II and III`.
3. **Statement I–II–III reasoning**
   - Statement I gives the development or conclusion. Statements II and III give possible reasons.
   - Ask which reasons are correct and whether they explain Statement I. Use the four-option UPSC explanation pattern accurately.
4. **Correctly matched pairs**
   - Give 3-5 pairs of institutions and functions, places and features, laws and provisions, species and habitats, or concepts and descriptions.
   - Ask how many pairs are correctly matched. Every pair must be independently testable.
5. **Applied one-best-answer**
   - Use sparingly for a mechanism, common characteristic, institutional responsibility or best description.
   - All four options must belong to the same conceptual category and be genuinely plausible.

### Statement and option construction

- Use 2-4 independently testable statements of similar length and difficulty. Each statement should test one proposition.
- Build false statements by changing one precise element—a jurisdiction, mechanism, condition, institution, location or scope. Do not make them silly or obviously unrelated.
- Use words such as `all`, `only`, `always`, `never` and `binding` only when the underlying rule genuinely turns on that qualifier. Never use absolutes as a cheap clue.
- Distractors should come from realistic confusions: a related institution, neighbouring location, similar treaty, adjacent constitutional Article, reversed cause and effect, or an over-broad version of a true rule.
- Keep all options grammatically parallel, mutually exclusive and at the same level of specificity. There must be exactly one defensible best answer.
- Do not let option length, detail, repetition from the stem or odd wording reveal the answer.
- Use Roman statement numbers consistently (`I`, `II`, `III`, `IV`) and four options labelled by the app. Do not include `(a)`, `(b)`, `(c)`, `(d)` inside option text.
- Every factual premise must be supported by the verified article or reliable static knowledge. If a claim is uncertain, do not use it as a statement or distractor.

Question quality rules:

- Test concepts, provisions, mechanisms, exceptions, chronology, pairs, implications, or static-current linkage.
- Use 2-4 numbered statements where appropriate.
- Keep statements precise and independently evaluable.
- Avoid trivia that can be answered by memorising one phrase from the headline.
- Options should follow UPSC patterns: `1 only`, `2 only`, `Both 1 and 2`, `Neither 1 nor 2`, or meaningful combinations.
- Explanations should normally be 80-160 words. State the correct option, assess every statement or pair separately, explain why each incorrect one is wrong, and end with the static-current connection where useful.
- References should name the static hook, for example `Article 262`, `Disaster Management Act, 2005`, `MTCR`, `IN-SPACe`, or `Article 21`.

## Deep Dive Articles

Every Deep Dive is a short UPSC study note. It must use exactly these five fields and no additional content headings:

1. `syllabusLinkage` — the relevant GS paper and exact syllabus topic.
2. `context` — 2-3 direct sentences explaining what happened and why it is significant.
3. `keyHighlights` — 4-6 one-sentence factual bullets covering the most important provisions, effects, opportunities, concerns or institutional details.
4. `keyConcepts` — 3-6 `{ term, definition }` items. Expand abbreviations and explain each term in plain English.
5. `wayForward` — 3-6 practical, issue-specific actions.

`explanation` is supporting detail for narration and compatibility with older content. Keep it to simple `<p>` paragraphs without headings, labels, tables or decorative HTML. The app does not show it as extra study-note sections.

Reference shape:

```json
{
  "syllabusLinkage": "GS II: Bilateral Relations; GS III: International Trade",
  "context": "The India-United Kingdom trade agreement and Double Contribution Convention have entered into force, marking a major step in bilateral economic relations.",
  "keyHighlights": [
    "The agreement reduces tariffs and expands access for goods and services in both markets.",
    "The Double Contribution Convention prevents eligible professionals from paying social-security contributions in both countries.",
    "The agreement covers digital trade, financial services, investment, innovation and sustainable infrastructure.",
    "Its benefits will depend on whether Indian exporters can meet standards and use the new market access."
  ],
  "keyConcepts": [
    { "term": "Free Trade Agreement", "definition": "An agreement between countries to reduce or remove barriers to trade." },
    { "term": "Tariff liberalisation", "definition": "The gradual reduction or removal of customs duties on traded goods." },
    { "term": "Non-tariff barriers", "definition": "Rules, standards and procedures that can restrict trade even when customs duties are low." }
  ],
  "wayForward": [
    "Ensure effective implementation through regular coordination between both governments.",
    "Help small exporters understand and use the new market opportunities.",
    "Improve product standards, logistics and trade-finance access.",
    "Review the agreement regularly as technology and regulations change."
  ]
}
```

Deep Dive writing rules:

- Write direct facts, not essay-like commentary.
- Avoid jargon. If a technical term is necessary, define it under `keyConcepts`.
- Do not create headings such as "UPSC lens", "editorial briefing", "interlinkages", "prelims nuggets", "mains framework", "memory aid" or "things not mentioned".
- Do not repeat the same sentence across Context, Key Highlights and Way Forward.
- Add only directly relevant static knowledge and never invent facts.
- The `possibleMainsQuestion` must ask the student to analyse, examine, discuss, evaluate, or critically comment.

### Hindi Deep Dive

Every new Deep Dive must also include `deepDive.hindi`, a reviewed Hindi version of the same five-part note and Mains question:

```json
{
  "hindi": {
    "syllabusLinkage": "GS II: द्विपक्षीय संबंध; GS III: अंतरराष्ट्रीय व्यापार",
    "context": "भारत–यूनाइटेड किंगडम व्यापार समझौता और Double Contribution Convention लागू हो गए हैं, जिससे दोनों देशों के आर्थिक संबंधों में एक महत्वपूर्ण नया चरण शुरू हुआ है।",
    "keyHighlights": [
      "यह समझौता शुल्क घटाता है और दोनों बाजारों में वस्तुओं तथा सेवाओं की पहुंच बढ़ाता है।"
    ],
    "keyConcepts": [
      { "term": "Free Trade Agreement", "definition": "देशों के बीच ऐसा समझौता, जिसके तहत व्यापार से जुड़ी बाधाओं को कम या समाप्त किया जाता है।" }
    ],
    "wayForward": [
      "दोनों सरकारों के नियमित समन्वय के माध्यम से समझौते का प्रभावी क्रियान्वयन सुनिश्चित करें।"
    ],
    "possibleMainsQuestion": "भारत–यूनाइटेड किंगडम व्यापार समझौते से भारत को मिलने वाले अवसरों और उससे जुड़ी चुनौतियों का विश्लेषण कीजिए।"
  }
}
```

Hindi fidelity rules:

- Use natural, clear Devanagari Hindi. Avoid literal, awkward translation and do not change the context.
- Translate only the final verified English fields. Never add a fact, example, interpretation or recommendation.
- Preserve names, dates, figures, percentages and Arabic-number tokens exactly.
- Keep `keyHighlights`, `keyConcepts` and `wayForward` in the same order and with exactly the same item counts as English.
- Keep each `keyConcepts.term` exactly the same as English and translate its definition naturally. Official or technical English terms may remain in English where that improves accuracy.
- Translate `possibleMainsQuestion` without changing its command, scope or analytical demand.
- `audioScriptHi` remains a natural spoken Hinglish script; it is not copied from the Devanagari study note.
- If a reviewed Hindi version is unavailable, omit `deepDive.hindi`. The app must never construct or display a mixed-language fallback.

## Audio Narration

Generate both `audioScript` and `audioScriptHi` using [explain-script-prompt.md](./content/explain-script-prompt.md).

- Target 300-450 words for each version.
- Use calm, natural speech and short paragraphs.
- Explain the main development, likely benefits, one balanced concern, what effective action requires, and a simple final takeaway.
- Include the examination perspective in one short paragraph without coaching-language filler.
- Expand abbreviations on first use and define necessary technical terms plainly.
- Do not use headings, bullets, labels, markdown or raw HTML.
- Do not say `ask yourself`, `UPSC expects`, `one level deeper`, `value addition`, `Mains framework`, `stakeholder`, `interlinkages` or `case study`.
- The Hinglish version must sound naturally spoken and must not be a literal translation.
- Never add facts not supported by the article or its verified study-note fields.

## Mains Questions

Mains questions should ask the student to analyse, examine, discuss, evaluate, or critically comment. They should connect the article to GS syllabus themes and avoid asking for mere summaries.
