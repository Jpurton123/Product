import { config } from "../config.js";
import { research, structured } from "../llm.js";
import { Shortlist, type Candidate } from "../schemas.js";

const RESEARCH_SYSTEM = `You are a product researcher for a new one-person dropshipping store on Shopify,
selling to customers in the ${config.market} with prices in ${config.currency}. The owner has about
40 ${config.currency} a month for ads and tools at first, so the product must be able to sell with small
budgets and organic short-form video. Use web search to find what is selling right now in that market,
and prefer suppliers that ship there quickly (local or regional warehouses).`;

const SCORING_SYSTEM = `You score dropshipping products for a beginner Shopify store with a tiny budget,
selling in the ${config.market}. All money is in ${config.currency}; retail prices include VAT.
Be honest and conservative: a high score must be earned by evidence in the research notes.
Avoid anything regulated (supplements, cosmetics claims, kids' safety items, electronics needing
certification), branded or trademarked designs, sized clothing, and fragile or heavy items.`;

// Weights for the overall score. Margin and demand matter most for a first store.
const WEIGHTS = { margin: 0.3, demand: 0.3, competition: 0.15, shipping: 0.15, risk: 0.1 };

export const overallScore = (c: Candidate) =>
  Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + c.scores[key as keyof typeof WEIGHTS] * weight, 0);

export async function discover(): Promise<{ notes: string; shortlist: Shortlist }> {
  const today = new Date().toISOString().slice(0, 10);
  const notes = await research({
    system: RESEARCH_SYSTEM,
    prompt: `Today is ${today}. Find 15 to 20 products that are trending for dropshipping right now,
across several niches. For each, note: the niche, evidence that it is trending (TikTok, Amazon
movers, Google Trends, ad libraries), typical supplier cost and where to source it, typical retail
price, how crowded the market is, and any shipping or legal concerns. Then say which niche looks
best for a brand-new store and why. Cite where each signal came from.`,
  });

  const shortlist = await structured({
    schema: Shortlist,
    model: config.models.scoring,
    effort: "low",
    system: SCORING_SYSTEM,
    prompt: `Here are today's research notes:\n\n<notes>\n${notes}\n</notes>\n\nPick the best niche
for a new store, then score every product from the notes (only products in the notes; no new ones).`,
  });

  shortlist.candidates.sort((a, b) => overallScore(b) - overallScore(a));
  return { notes, shortlist };
}
