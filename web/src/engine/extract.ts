import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CueSchema, type Cues } from "./cues.ts";

export interface Line {
  role: "student" | "assistant";
  text: string;
}

/** The slide-5 window: the engine reads the last ~20 messages. Older risk is kept by the tier floor. */
export const WINDOW = 20;

export function makeClient(apiKey: string, browser: boolean): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: browser });
}

export function formatTranscript(lines: Line[]): string {
  return lines
    .slice(-WINDOW)
    .map((l) => `${l.role === "student" ? "Student" : "Assistant"}: ${l.text}`)
    .join("\n");
}

export class ExtractionRefused extends Error {}

/**
 * Step 1 of the engine: read the transcript, return screener cues.
 * `cuesPrompt` is skill/references/risk-cues.md (loaded by the caller, so the
 * same function runs in the browser and in the Node proof-of-concept script).
 */
export async function extractCues(opts: {
  client: Anthropic;
  model: string;
  cuesPrompt: string;
  lines: Line[];
  effort?: "low" | "medium" | "high";
}): Promise<Cues> {
  const response = await opts.client.beta.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text:
          "You are the risk-cue extractor behind a student support chatbot. You do not reply to the student. " +
          "Read the transcript and return the cues defined below, following part A exactly. Do not decide a tier.\n\n" +
          opts.cuesPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(CueSchema) },
    messages: [{ role: "user", content: `Transcript (oldest first):\n\n${formatTranscript(opts.lines)}` }],
  });

  if (response.stop_reason === "refusal") throw new ExtractionRefused("Cue extraction was declined.");
  if (!response.parsed_output) throw new Error(`No cues returned (stop_reason: ${response.stop_reason}).`);
  return response.parsed_output;
}
