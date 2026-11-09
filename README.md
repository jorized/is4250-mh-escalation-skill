# IS4250: Student Support Escalation Skill

An AI **skill** that triages distress in Singapore university students and connects them to the nearest, least intimidating human support. It never diagnoses or treats. Built from the team's *Escalation Skill: Gap Analysis and Must-Have Requirements* (M1–M11).

Two deliverables share one source of truth (`skill/`):

| | What | For |
|---|---|---|
| **White-label skill** | `skill/` → `student-support-escalation.zip` | A school admin uploads it to ChatGPT Edu (or a Claude workspace) |
| **Web MVP** | `web/` (React + Vite) → GitHub Pages | Our own demo chatbot running the same skill, with the parts a skill can't do on its own built in code |

> **TEST MODE is on everywhere.** Escalation to a school is simulated and labelled. Nothing is sent to anyone. Calls and emails the student starts themselves are real.

## Repo layout

```
skill/
  SKILL.md                 core rules: tiers, routing, consent, tone
  references/
    scripts.md             disclosure, consent prompt, summary template, bridges
    tier3.md               the "No" at Tier 3 rule (pending clinician sign-off)
    thresholds.md          mood and dependency thresholds (placeholders)
    risk-cues.md           C-SSRS / PHQ-9 cues and the rules that set the tier
    routing/*.json         the ONLY contacts the bot may name
web/                       React MVP (loads skill/ at build time)
evals/personas.md          persona scripts, rubric, automatic fails
poc/                       proof of concept: engine vs labelled vignettes
proxy/                     Cloudflare Worker: holds the API key, checks the password
scripts/package-skill.sh   builds the white-label zip
```

## The escalation engine (deck slides 5–7)

```
student message
  → 1. LLM extracts C-SSRS / PHQ-9 cues from the last ~20 messages   web/src/engine/extract.ts
  → 2. fixed rules turn cues into a tier (deck level 1–4)            web/src/engine/rules.ts
  → 3. session floor: the tier never goes down                       web/src/components/Chat.tsx
  → 4. LLM writes the reply, acting on that tier                     web/src/lib/llm.ts
```

The cue definitions and rules are in `skill/references/risk-cues.md`, so the white-label skill follows the same rules. In test mode, the **Engine** button in the web app shows the cues, rules and tier for every message.

| Tier (requirements doc) | Deck level (focus-group slides) | Example |
|---|---|---|
| 0 Everyday stress | 1 Routine | "barely slept this week", figurative "want to shoot myself" |
| 1 Persistent strain | 2 Watch | weeks of low mood, not eating |
| 2 Ideation / self-harm | 2 Watch | "wish I could not wake up", self-harm to cope |
| 2 Ideation / self-harm | 3 Escalate | "thinking about how I'd do it" |
| 3 Imminent | 4 Urgent | intent, plan, recent attempt, can't stay safe |

**Proof of concept:** `poc/` runs the same engine over 25 labelled vignettes several times each and reports misses, over-escalations and consistency. See `poc/README.md`.

## What the web MVP enforces in code

A skill is only instructions. The web app adds hard guarantees:

- **M1** Contacts render only from `routing/*.json`; any id the model invents is dropped.
- **M2** The opening disclosure is fixed text, not generated.
- **M3/M4** Real Yes / Not now / Tell me more buttons; an editable summary preview; `tel:` and `mailto:` links with the approved summary pre-filled.
- **M6** The tier can only go up within a session ("forget it, I'm fine" can't reset it).
- **M7/M8** Opt-in weekly mood check-in and message-time counters (no content) kept in the browser, visible and deletable under "Your data".
- **M9** The hotline card is shown once.
- **M10** The TEST MODE label is rendered by the app on every simulated handoff.

## Run locally

```bash
cd web
npm install
npm run dev
```

Sign in with the shared course credentials, then paste an Anthropic API key (use one with a low spend limit). The key stays in your browser and goes only to Anthropic.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `web/` and publishes it to GitHub Pages. Repo settings → Pages → Source must be **GitHub Actions**.

### Sign-in and the API key

GitHub Pages only serves static files, so it can't keep a secret. The key lives in a **Cloudflare Worker** (`proxy/`): visitors sign in with the shared password, the Worker checks it server-side and calls Claude Haiku 5.5 with its own key. **No API key is ever built into the site.** Setup: `proxy/README.md`.

If `PROXY_URL` isn't set, the site falls back to "bring your own API key" with a browser-only password gate (not real security). Team members can still pick that option on the sign-in screen.

## White-label install

```bash
./scripts/package-skill.sh   # → student-support-escalation.zip
```

ChatGPT Edu: skills are off by default. The workspace admin turns them on, uploads the zip, and sets who can use it. Before that, replace `{DATA_NOTE}` for that deployment in `skill/references/scripts.md` with what the school's admins can actually see.

## Open items before any real use

Copied from the requirements doc (section 10). None of these are settled by this repo:

- Clinicians confirm the Tier 3 definition and the rule for a "No" at Tier 3.
- Confirm what ChatGPT Edu admins can see; fix the disclosure wording.
- Verify every NUS contact (several `"verified": false`), add the UCS booking URL, and build NTU / SMU / SUSS / SUTD / SIT tables (currently empty stubs).
- Replace placeholder thresholds with clinician-backed numbers.
- PDPA review with the school's data protection officer.
- Blind re-score of the persona transcripts; add the proportionality dimension.
- Check with the instructor about NUS IRB before any user testing.
