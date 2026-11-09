import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { SKILL_PROMPT } from "./skill";

export const TurnSchema = z.object({
  reply: z.string(),
  tier: z.number().int().describe("Internal tier, 0 to 3"),
  institution: z.string().nullable(),
  faculty: z.string().nullable(),
  situation: z.enum(["general", "lgbtq", "sexual_misconduct", "cost", "emergency"]),
  route_ids: z.array(z.string()),
  show_hotline: z.boolean(),
  consent_offer: z.string().nullable(),
  summary: z
    .object({
      safety_status: z.string(),
      main_concerns: z.string(),
      how_long: z.string().nullable(),
      already_tried: z.string().nullable(),
      asking_for: z.string().nullable(),
      contact_preference: z.string().nullable(),
    })
    .nullable(),
});
export type Turn = z.infer<typeof TurnSchema>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class RefusalError extends Error {}

/**
 * One chat turn. Runs in the browser with the student's own API key (GitHub
 * Pages has no server). `sessionState` changes every turn, so it sits after the
 * cached skill prompt to keep the cache valid.
 */
export async function runTurn(opts: {
  apiKey: string;
  model: string;
  history: ChatMessage[];
  sessionState: string;
}): Promise<Turn> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });

  const response = await client.beta.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    // Server-side fallback if a safety classifier declines a turn.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SKILL_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: opts.sessionState },
    ],
    output_config: { effort: "medium", format: betaZodOutputFormat(TurnSchema) },
    messages: opts.history,
  });

  if (response.stop_reason === "refusal") {
    throw new RefusalError("The model declined this turn.");
  }
  if (!response.parsed_output) {
    throw new Error(`No structured reply (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}

/**
 * Prior assistant turns go back as their JSON, so the model sees what it
 * already offered (routes, consent, hotline). History stays append-only.
 */
export function assistantText(t: Turn): string {
  return JSON.stringify(t);
}
