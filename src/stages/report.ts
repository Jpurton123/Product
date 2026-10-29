import { z } from "zod";
import { config, money, shopifyConfigured } from "../config.js";
import { structured } from "../llm.js";
import type { Candidate, Shortlist, StoreDraft } from "../schemas.js";
import { fetchOrders, type Order } from "../shopify.js";

// The "When to invest more" rules from the growth plan. Keep in step with the plan doc.
const INVEST_RULES = `Phases: 1 Launch (Nov-Dec 2026, organic video only, 80/month total budget),
2 Find the winner (Jan-Mar 2027), 3 Scale (Apr-Jun 2027), 4 Expand (Jul-Oct 2027). Goal: 5,000-10,000 profit a month.
Triggers and actions:
- A product gets 20+ videos over 3 weeks and no sales: drop it and test the next product from the shortlist.
- First 120 of profit in a month: order one sample to check quality and film it.
- 30 orders in a month, or a video over 50,000 views: start ads at 8 a day on that product, paid from profit.
- An ad returns 2+ in sales per 1 spent for 7 days: raise its budget 20% every 3 days while it holds.
- An ad returns under 1.30 per 1 spent for 3 days: turn it off.
- 2,000 profit in a month: pay a freelance creator for 10 videos a month, add bundles and reviews.
- 5,000 profit in a month: add a second product and a second ad channel, start paying yourself.
- Only spend money the store has already made. Reinvest all profit for the first 3 months, then 60%.
- Register for VAT once sales pass 90,000 in any 12 months. Register as self-employed once income passes 1,000 in a tax year.`;

const SYSTEM = `You are a blunt, practical e-commerce coach for a one-person Shopify dropshipping store in the
${config.market}. Each week you read the real numbers and tell the owner exactly what to do this week, in
order, and whether it is time to invest more money. Follow the owner's plan rules below; never suggest
spending money the store has not made. Money is in ${config.currency}. Be concrete: amounts, days, counts.

${INVEST_RULES}`;

export const WeeklyReport = z.object({
  headline: z.string().describe("One sentence: where the store stands this week"),
  investNow: z.boolean().describe("True only if a plan trigger says to put more money in now"),
  investAdvice: z.string().describe("What to invest, how much, where and why; or why not yet"),
  triggersHit: z.array(z.string()).describe("Plan triggers that were hit this week, if any"),
  actions: z
    .array(z.object({ when: z.string().describe("For example Today, Monday, Every day"), task: z.string() }))
    .describe("3 to 7 tasks for this week, most important first"),
  watchNext: z.string().describe("The one number to watch next week and the target for it"),
});
export type WeeklyReport = z.infer<typeof WeeklyReport>;

type Window = { days: number; orders: number; revenue: number; estProfitBeforeAds: number };

function summarise(orders: Order[], days: number, product: Candidate): Window {
  const since = Date.now() - days * 86_400_000;
  const inWindow = orders.filter((o) => Date.parse(o.createdAt) >= since);
  const revenue = inWindow.reduce((sum, o) => sum + o.total, 0);
  const units = inWindow.reduce((sum, o) => sum + o.units, 0);
  // Supplier cost per unit, plus about 2% + 0.25 card fees per order. Ad spend is not known here.
  const costs = units * product.supplierCost + revenue * 0.02 + inWindow.length * 0.25;
  return { days, orders: inWindow.length, revenue, estProfitBeforeAds: revenue - costs };
}

export async function weeklyReport(opts: {
  store?: StoreDraft;
  product?: Candidate;
  shortlist?: Shortlist;
}): Promise<{ report: WeeklyReport; sales: Window[] | null }> {
  let sales: Window[] | null = null;
  if (shopifyConfigured() && opts.product) {
    const orders = await fetchOrders(new Date(Date.now() - 30 * 86_400_000));
    sales = [summarise(orders, 7, opts.product), summarise(orders, 30, opts.product)];
  }

  const today = new Date().toISOString().slice(0, 10);
  const report = await structured({
    schema: WeeklyReport,
    effort: "medium",
    system: SYSTEM,
    prompt: `Today is ${today}.

<store>
${opts.store ? `${opts.store.brandName}: ${opts.store.product.title} at ${money(opts.store.product.price)}` : "No store built yet."}
${opts.product ? `Supplier cost per unit: ${money(opts.product.supplierCost)}` : ""}
</store>

<sales>
${sales ? JSON.stringify(sales, null, 2) : "No sales data yet (Shopify not connected or store not built)."}
</sales>

<new_product_research>
${opts.shortlist ? opts.shortlist.candidates.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} (${c.niche}): ${c.reasoning}`).join("\n") : "None this week."}
</new_product_research>

Write this week's report. Ad spend and video views are not in the data: if a decision depends on them, tell the
owner which number to check and what to do for each answer.`,
  });
  return { report, sales };
}

export function reportToMarkdown(report: WeeklyReport, sales: Window[] | null): string {
  const lines = [`# ${report.headline}`, ""];
  lines.push(`## ${report.investNow ? "Invest now" : "Hold spending"}`, "", report.investAdvice, "");
  if (report.triggersHit.length) lines.push("**Plan triggers hit:**", ...report.triggersHit.map((t) => `- ${t}`), "");
  lines.push("## This week", "", ...report.actions.map((a) => `- [ ] **${a.when}:** ${a.task}`), "");
  if (sales) {
    lines.push("## Numbers", "", "| Period | Orders | Revenue | Profit before ads (est.) |", "| --- | --- | --- | --- |");
    for (const w of sales) {
      lines.push(`| Last ${w.days} days | ${w.orders} | ${money(w.revenue)} | ${money(w.estProfitBeforeAds)} |`);
    }
    lines.push("");
  }
  lines.push(`**Watch next week:** ${report.watchNext}`, "");
  return lines.join("\n");
}
