# Penni Current Affairs Generation Guidelines

Use this standard whenever creating new daily news JSON for Penni.

## Prelims Questions

Prelims questions must match UPSC CSE Prelims depth. Do not create one-word recall prompts such as "X is:", "Y is headquartered at:", or "Z is associated with:" unless the options test conceptual discrimination.

Each article should preferably include two prelims questions:

- One statement-based question using UPSC formats such as "Consider the following statements", "With reference to...", "Which of the statements given above is/are correct?", or "How many of the above statements are correct?"
- One applied/static-linkage question connecting the news item to a constitutional provision, institution, geography, economy concept, science principle, environment convention, or international organisation.

Question quality rules:

- Test concepts, provisions, mechanisms, exceptions, chronology, pairs, implications, or static-current linkage.
- Use 2-3 numbered statements where possible.
- Keep statements precise and independently evaluable.
- Avoid trivia that can be answered by memorising one phrase from the headline.
- Options should follow UPSC patterns: `1 only`, `2 only`, `Both 1 and 2`, `Neither 1 nor 2`, or meaningful combinations.
- Explanations must be detailed. For statement questions, explain each statement separately and mention why wrong statements are wrong. Avoid one-line explanations.
- References should name the static hook, for example `Article 262`, `Disaster Management Act, 2005`, `MTCR`, `IN-SPACe`, or `Article 21`.

## Deep Dive Articles

Deep Dive content is not a summary. It is a premium UPSC learning module.

Write like an excellent classroom mentor who is teaching the news item to a serious aspirant. The student should finish the Deep Dive understanding:

- What happened?
- Why did it happen?
- So what?
- What should I remember?
- How can UPSC ask this?

Never simply rewrite the article. Expand beyond it wherever useful using accurate UPSC-relevant knowledge: static concepts, history, constitutional provisions, geography, economy, environment, international relations, science, previous UPSC trends, and future examination possibilities. Do not invent facts.

Each `deepDive.explanation` must use HTML-safe section labels with `<strong>...</strong>` and should include these sections in this order:

1. `<strong>1. One-Line Summary:</strong>` — one simple sentence.
2. `<strong>2. Explain Like I'm a UPSC Aspirant:</strong>` — simple classroom-style explanation from first principles.
3. `<strong>3. What Actually Happened?</strong>` — sequence/timeline of events.
4. `<strong>4. Why Is This Important?</strong>` — national, international, economic, social, environmental, constitutional, or security significance.
5. `<strong>5. Background You Must Know:</strong>` — history, Acts, committees, treaties, schemes, organisations, reports, geography, personalities, and concepts the article assumes.
6. `<strong>6. Connect With Static UPSC Syllabus:</strong>` — GS paper, syllabus topic, optional links, NCERT/static concepts.
7. `<strong>7. Things NOT Mentioned In The Article:</strong>` — directly related extra knowledge such as judgments, committees, reports, initiatives, international examples, exceptions, or important concepts.
8. `<strong>8. UPSC Perspective:</strong>` — at least five possible Prelims, Mains, Essay, or Interview angles.
9. `<strong>9. Prelims Nuggets:</strong>` — crisp factual points: years, Articles, reports, locations, organisations, species, Acts, committees, numbers, treaties, definitions.
10. `<strong>10. Mains Analysis:</strong>` — issue, challenges, arguments, counterarguments, way forward, conclusion.
11. `<strong>11. Interlinkages:</strong>` — connect the topic across UPSC subjects.
12. `<strong>12. Maps:</strong>` — important locations and whether they should appear on the interactive map.
13. `<strong>13. Previous UPSC Questions:</strong>` — similar PYQs or close themes and why UPSC likes this area.
14. `<strong>14. Memory Tricks:</strong>` — mnemonics, analogies, real-life examples, simple comparisons.
15. `<strong>15. Common Mistakes Students Make:</strong>` — misconceptions and confusing areas.
16. `<strong>16. Revision Notes:</strong>` — 10-15 fast revision bullets.

Deep Dive writing rules:

- Teach, do not summarize.
- Explain in conversational language, not newspaper or Wikipedia style.
- Avoid jargon; if a technical word is necessary, explain it naturally.
- Prefer bullets, short paragraphs, simple tables, cause-effect chains, comparison tables, or flow text.
- Answer WHY, HOW, and SO WHAT more than WHAT.
- Add directly relevant external UPSC knowledge, but never hallucinate.
- Do not add facts you are uncertain about.
- The `possibleMainsQuestion` must ask the student to analyse, examine, discuss, evaluate, or critically comment.

## Audio Narration

When converting a PDF or any source document into daily JSON, automatically generate an `audioScript` field for every article using [penni-narration-prompt.md](./penni-narration-prompt.md). This should be a full Penni Explain narration script, not a short feed summary.

The narration system must transform robotic text-to-speech into a premium Indian editorial listening experience. Never send raw article text to the speech engine. First rewrite it as a spoken script, as if an experienced Indian news anchor or documentary narrator is explaining an important UPSC news item. Think DD News, All India Radio News, Rajya Sabha TV discussions, BBC World Service, and The Economist audio edition. Do not sound like Google Translate, robotic TTS, monotone AI, YouTube clickbait, or theatrical drama.

Audio script requirements:

- Write in natural Indian-English news-reader style, as if a calm reporter is explaining the story to a UPSC aspirant.
- The tone should be calm, confident, intelligent, natural, professional, conversational, authoritative, and educational.
- Rewrite newspaper grammar into spoken English before reading. Break long sentences and use commas, pauses, paragraph breaks, and sentence rhythm.
- Use pacing intentionally. Short pauses are encouraged before important facts or transitions.
- Use emphasis sparingly for important words such as Constitution, Supreme Court, Article twenty one, UNESCO, BrahMos, Reserve Bank of India, or climate change.
- Pronounce Indian names, States, districts, schemes, committees, scientific terms, and foreign names carefully.
- Expand abbreviations naturally on first mention. Prefer "Reserve Bank of India" before "RBI", "National Investigation Agency" before "NIA", and "Unlawful Activities Prevention Act" before "UAPA".
- Shape the narration like a story: what happened, why it happened, why it matters, and what UPSC students should remember.
- Teach while speaking. If a concept is necessary, add a short bridge such as "Before we move ahead, remember what this term means..."
- Begin with the news itself after a simple "Hello" only when needed. Avoid robotic phrases, app labels, repeated templates, and raw HTML.
- Explain abbreviations naturally where useful, for example "U P S C", "G S 2", "N D M A".
- The normal feed page should not show a front-page "read shorts" control. Reading belongs inside the article/Deep Dive experience.
- Deep Dive reading should use the article's prewritten Penni Explain `audioScript` wherever available. It should usually be 450-900 spoken words for major articles and must sound like a UPSC mentor/news-anchor case study.
- Include: what the news is, why it matters for mains, what facts/concepts the student should learn, and what the issue reveals in real governance, economy, society, environment, security or diplomacy.
- Do not tell the student how to write an answer. Give the actual information and understanding that would help them answer: causes, consequences, institutions involved, legal principles, data, stakeholder impact, risks, reforms or trade-offs.
- Do not merely announce a syllabus tag. Never say only "this links to GS 2" or "this is polity". Explain the substance of the issue naturally.
- Avoid jargon while speaking. Prefer "people affected" over "stakeholders", "balance" over "trade-off", "how it is carried out" over "implementation", and "public bodies" over "institutions".
- Avoid labelled dictation such as "Why this matters colon" or "What you should learn colon". The script should flow as one seamless explanation.
- Avoid filler like "this is Penni", "here is the gist", "not the whole article", "read the full Deep Dive", "story one", or generic outros.
- Use varied spoken transitions only where they sound human: "The important part is...", "For UPSC preparation...", "Keep this linked with...".
- Do not add facts not present in the article/deep dive.

The app's article reader auto-builds a short spoken script from headline, summary, why-it-matters, key terms and selected Deep Dive points so that the spoken version stays UPSC-focused and does not become a mechanical full-article readout.

## Mains Questions

Mains questions should ask the student to analyse, examine, discuss, evaluate, or critically comment. They should connect the article to GS syllabus themes and avoid asking for mere summaries.
