import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { config } from "./config.js";

const client = new Anthropic();

// US dollars per million tokens (input, output). Unknown models are priced as Opus.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const WEB_SEARCH_USD = 0.01;

// Server-side fallback: if a model declines, the API reroutes by refusal category.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let spentUsd = 0;
export const spent = () => spentUsd;

function track(model: string, usage: Anthropic.Beta.BetaUsage) {
  const [inPrice, outPrice] = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const input =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.1;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  spentUsd += (input * inPrice + usage.output_tokens * outPrice) / 1e6 + searches * WEB_SEARCH_USD;
  if (spentUsd > config.maxRunCostUsd) {
    throw new Error(
      `Stopped: this run has spent $${spentUsd.toFixed(2)}, over MAX_RUN_COST_USD=$${config.maxRunCostUsd}.`,
    );
  }
}

function checkStop(message: { stop_reason: string | null; stop_details?: { explanation?: string | null } | null }) {
  if (message.stop_reason === "refusal") {
    throw new Error(`Claude declined this request: ${message.stop_details?.explanation ?? "no details"}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Claude's answer was cut off (max_tokens). Try again or narrow the request.");
  }
}

/** Ask Claude for JSON that matches a Zod schema. */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  model?: string;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const model = opts.model ?? config.models.main;
  const response = await client.beta.messages.parse({
    ...FALLBACK,
    model,
    max_tokens: 16000,
    cache_control: { type: "ephemeral" },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
  });
  track(response.model, response.usage);
  checkStop(response);
  if (!response.parsed_output) throw new Error("Claude's answer did not match the expected format.");
  return response.parsed_output as z.infer<S>;
}

/** Research a question with live web search and return Claude's written notes. */
export async function research(opts: { system: string; prompt: string; maxSearches?: number }): Promise<string> {
  const model = config.models.main;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches ?? 8 },
  ];

  for (let turn = 0; turn < 5; turn++) {
    const stream = client.beta.messages.stream({
      ...FALLBACK,
      model,
      max_tokens: 32000,
      system: opts.system,
      tools,
      messages,
      output_config: { effort: "medium" },
    });
    const response = await stream.finalMessage();
    track(response.model, response.usage);

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    checkStop(response);
    return response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
  throw new Error("Web research did not finish after 5 turns.");
}
