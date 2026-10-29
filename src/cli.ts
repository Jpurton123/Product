import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { shopifyConfigured } from "./config.js";
import { spent } from "./llm.js";
import type { Candidate, ContentPack, Shortlist, StoreDraft } from "./schemas.js";
import { publishDraft } from "./shopify.js";
import { contentToMarkdown, makeContent } from "./stages/content.js";
import { discover, overallScore } from "./stages/discover.js";
import { draftStore } from "./stages/store.js";

const RUNS = "runs";
// The brand currently live in Shopify. Scheduled runs write new content for it.
const BRAND = "brand";

const save = (run: string, file: string, data: unknown) =>
  writeFileSync(join(RUNS, run, file), typeof data === "string" ? data : JSON.stringify(data, null, 2));
const load = <T>(run: string, file: string): T | undefined =>
  existsSync(join(RUNS, run, file)) ? (JSON.parse(readFileSync(join(RUNS, run, file), "utf8")) as T) : undefined;

function latestRun(): string {
  const runs = existsSync(RUNS) ? readdirSync(RUNS).sort() : [];
  if (!runs.length) throw new Error("No runs yet. Start with: npm run discover");
  return runs[runs.length - 1];
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function printShortlist(shortlist: Shortlist) {
  console.log(`\nRecommended niche: ${shortlist.recommendedNiche}\n${shortlist.nicheReasoning}\n`);
  shortlist.candidates.forEach((c, i) => {
    const margin = c.retailPriceUsd - c.supplierCostUsd;
    console.log(
      `${String(i + 1).padStart(2)}. [${overallScore(c).toFixed(1)}] ${c.name} (${c.niche}) ` +
        `cost $${c.supplierCostUsd.toFixed(2)} -> sell $${c.retailPriceUsd.toFixed(2)}, margin $${margin.toFixed(2)}`,
    );
    console.log(`    ${c.reasoning}`);
  });
}

async function runDiscover(): Promise<string> {
  const run = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(join(RUNS, run), { recursive: true });
  console.log("Researching trending products with web search (takes a few minutes)...");
  const { notes, shortlist } = await discover();
  save(run, "research.md", notes);
  save(run, "shortlist.json", shortlist);
  printShortlist(shortlist);
  console.log(`\nSaved to ${join(RUNS, run)}`);
  return run;
}

async function runStore(run: string, pick?: number, yes = false): Promise<void> {
  const shortlist = load<Shortlist>(run, "shortlist.json");
  if (!shortlist) throw new Error(`Run ${run} has no shortlist. Run discover first.`);
  if (!pick) {
    printShortlist(shortlist);
    pick = Number(await ask("\nWhich product number should I build the store for? "));
  }
  const picked = shortlist.candidates[pick - 1];
  if (!picked) throw new Error(`There is no product number ${pick}.`);
  save(run, "picked.json", picked);

  console.log(`\nWriting the store for "${picked.name}"...`);
  const store = await draftStore(picked, shortlist.recommendedNiche);
  save(run, "store.json", store);
  mkdirSync(BRAND, { recursive: true });
  writeFileSync(join(BRAND, "store.json"), JSON.stringify(store, null, 2));
  writeFileSync(join(BRAND, "product.json"), JSON.stringify(picked, null, 2));
  console.log(`Brand: ${store.brandName} - ${store.tagline}`);
  console.log(`Product: ${store.product.title} at $${store.product.priceUsd.toFixed(2)}`);
  console.log(`Pages: ${store.pages.map((p) => p.title).join(", ")}`);

  if (!shopifyConfigured()) {
    console.log("\nShopify is not set up in .env, so this is a dry run. The store is saved in store.json.");
    return;
  }
  const go = yes ? "y" : await ask("\nCreate this in Shopify as a draft (not visible to shoppers)? [y/N] ");
  if (go.toLowerCase() !== "y") return;
  const result = await publishDraft(store);
  save(run, "shopify.json", result);
  console.log(`Created as draft. Review it here: ${result.adminUrl}`);
}

async function runContent(run: string, fromBrand = false): Promise<void> {
  const dir = fromBrand ? BRAND : join(RUNS, run);
  const read = <T>(file: string) =>
    existsSync(join(dir, file)) ? (JSON.parse(readFileSync(join(dir, file), "utf8")) as T) : undefined;
  const picked = read<Candidate>(fromBrand ? "product.json" : "picked.json");
  const store = read<StoreDraft>("store.json");
  if (!picked || !store) throw new Error(`Run ${run} has no store yet. Run the store step first.`);
  console.log(`\nWriting launch content for ${store.brandName}...`);
  const pack: ContentPack = await makeContent(picked, store);
  save(run, "content.json", pack);
  save(run, "content.md", contentToMarkdown(store, pack));
  console.log(
    `Made ${pack.ads.length} ads, ${pack.videoScripts.length} video scripts, ${pack.socialPosts.length} posts, ` +
      `${pack.emails.length} emails and ${pack.imagePrompts.length} image prompts. Read ${join(RUNS, run, "content.md")}`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const runArg = args.find((a) => !a.startsWith("--"));
  const pickArg = args.find((a) => a.startsWith("--pick="))?.split("=")[1];
  const pick = pickArg ? Number(pickArg) : undefined;
  const yes = args.includes("--yes");
  if (["discover", "store", "content", "weekly", "run"].includes(command) && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env (or as a GitHub secret for the scheduled runs).");
  }

  switch (command) {
    case "discover":
      await runDiscover();
      break;
    case "store":
      await runStore(runArg ?? latestRun(), pick, yes);
      break;
    case "content":
      await runContent(runArg ?? latestRun());
      break;
    case "weekly": {
      // Unattended: new product research, plus fresh content for the live brand. Never touches Shopify.
      const run = await runDiscover();
      if (existsSync(join(BRAND, "store.json"))) await runContent(run, true);
      else console.log("\nNo brand saved yet (run the store step once), so no content this week.");
      break;
    }
    case "run": {
      const run = await runDiscover();
      await runStore(run, pick, yes);
      await runContent(run);
      break;
    }
    default:
      console.log(
        "Usage: npm run discover | npm run store [-- <run>] [--pick=N] | npm run content [-- <run>] | npm run run-all | npm run weekly",
      );
      return;
  }
  console.log(`\nClaude usage this run: about $${spent().toFixed(2)}`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  console.error(`Claude usage before the error: about $${spent().toFixed(2)}`);
  process.exit(1);
});
