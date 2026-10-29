import { config } from "../config.js";
import { structured } from "../llm.js";
import { ContentPack, type Candidate, type StoreDraft } from "../schemas.js";

const SYSTEM = `You are a direct-response marketer for small Shopify brands that grow through short-form
video and low-budget ads, writing for customers in the ${config.market} (local spelling, prices in
${config.currency}, ads that follow local advertising rules such as the UK CAP Code). Write in the brand's voice. Every hook must earn attention in two seconds.
Be honest: no fake testimonials, no invented stats, no claims the product page does not support.`;

export async function makeContent(product: Candidate, store: StoreDraft): Promise<ContentPack> {
  return structured({
    schema: ContentPack,
    effort: "high",
    system: SYSTEM,
    prompt: `Brand and product:

<store>
${JSON.stringify({ brandName: store.brandName, tagline: store.tagline, brandVoice: store.brandVoice, product: store.product }, null, 2)}
</store>

<research>
${JSON.stringify({ niche: product.niche, whyTrending: product.whyTrending }, null, 2)}
</research>

Make a launch content pack: 6 ads (mix of Meta and TikTok, each with a different angle), 5 short
video scripts (UGC style, 15 to 30 seconds), 8 social posts across platforms, a 3-email welcome
series plus 1 abandoned-cart email, and 6 image prompts (product shots, lifestyle, ad creatives).`,
  });
}

export function contentToMarkdown(store: StoreDraft, pack: ContentPack): string {
  const lines = [`# ${store.brandName} launch content`, "", `_${store.tagline}_`, ""];
  lines.push("## Ads", "");
  for (const ad of pack.ads) {
    lines.push(`### ${ad.platform}: ${ad.angle}`, `**${ad.headline}**`, "", ad.primaryText, "", `CTA: ${ad.callToAction}`, "");
  }
  lines.push("## Video scripts", "");
  for (const v of pack.videoScripts) {
    lines.push(`### ${v.title}`, `**Hook:** ${v.hook}`, "", v.script, "", "Shots:", ...v.shotList.map((s) => `- ${s}`), "", `Caption: ${v.caption}`, "");
  }
  lines.push("## Social posts", "");
  for (const post of pack.socialPosts) {
    lines.push(`### ${post.platform}`, post.text, "", post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "), "");
  }
  lines.push("## Emails", "");
  for (const email of pack.emails) {
    lines.push(`### ${email.purpose}`, `**Subject:** ${email.subject}`, `**Preview:** ${email.previewText}`, "", email.body, "");
  }
  lines.push("## Image prompts", "", ...pack.imagePrompts.map((p, i) => `${i + 1}. ${p}`), "");
  return lines.join("\n");
}
