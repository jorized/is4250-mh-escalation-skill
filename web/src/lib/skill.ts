import skillMd from "../../../skill/SKILL.md?raw";
import scriptsMd from "../../../skill/references/scripts.md?raw";
import tier3Md from "../../../skill/references/tier3.md?raw";
import thresholdsMd from "../../../skill/references/thresholds.md?raw";
import { ROUTING_FILES } from "./routing";
import { TEST_MODE } from "./config";

/** Opening disclosure (M2): rendered by the app, word for word, never generated. */
export const WEB_DATA_NOTE =
  "Your messages go to an AI provider to generate replies. This site keeps no copy of your chat; only message times and any mood check-ins you opt into stay in this browser, and you can delete them.";

export const OPENING_DISCLOSURE =
  "Hi, I'm an AI, not a counsellor, and I can't diagnose anything. " +
  WEB_DATA_NOTE +
  " If you choose to connect with a support service, I'll show you a short summary first and only send it after you say yes. The one exception is if I think your life is in immediate danger: then I may share a short summary to get you help, and I'll tell you before I do." +
  (TEST_MODE ? " [TEST VERSION: nothing is actually sent to anyone.]" : "");

const DEPLOYMENT_NOTES = `
# Deployment notes: IS4250 web MVP

You are running inside a web app that implements parts of this skill in code. Divide the work like this:

- The app already showed the opening disclosure (below). Do not repeat it.
- The app renders contact cards, consent buttons, the summary preview, the TEST MODE label and the hotline card. In \`reply\`, refer to services by name; do not write out phone numbers, emails or the numbered consent list yourself.
- The app enforces: tier never decreasing, contacts only from the routing table, the hotline shown once, and the TEST MODE label. Still follow those rules yourself.
- Session state (tier floor, hotline status, handoffs, mood and usage signals) is given in a separate system block each turn. Treat it as fact.

Opening disclosure the student saw:
> ${OPENING_DISCLOSURE}

## Output fields

- \`reply\`: what the student reads. Short and plain, per section 7 of the skill. One question at most.
- \`tier\`: your current internal tier 0-3 (never mention it in \`reply\`).
- \`institution\` / \`faculty\`: what the student has told you, or null.
- \`situation\`: the routing override that applies, or "general".
- \`route_ids\`: ids from the routing table to show as cards this turn: the top route plus at most one alternative. Empty if no referral this turn. Never repeat sg-sos / sg-mindline after the hotline was shown.
- \`show_hotline\`: true on the turn you first reach Tier 2 or 3 (the app shows SOS and mindline once).
- \`consent_offer\`: the route id you are asking consent for (the app shows Yes / Not now / Tell me more), or null.
- \`summary\`: your current draft of the escalation summary when consent_offer is set or tier is 3, else null. Plain words, no transcript quotes, no names of other people, no sensitive details the student didn't ask to include.
`;

function routingBlock(): string {
  return Object.entries(ROUTING_FILES)
    .map(([name, f]) => `## references/routing/${name}\n\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\``)
    .join("\n\n");
}

/** Stable system prompt: the skill plus references. Cached; never put per-turn data here. */
export const SKILL_PROMPT = [
  skillMd.replace("TEST_MODE: ON", `TEST_MODE: ${TEST_MODE ? "ON" : "OFF"}`),
  "# references/scripts.md\n\n" + scriptsMd,
  "# references/tier3.md\n\n" + tier3Md,
  "# references/thresholds.md\n\n" + thresholdsMd,
  "# Routing tables\n\n" + routingBlock(),
  DEPLOYMENT_NOTES,
].join("\n\n---\n\n");
