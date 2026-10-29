import { structured } from "../llm.js";
import { StoreDraft, type Candidate } from "../schemas.js";

const SYSTEM = `You are a Shopify store builder and conversion copywriter. You turn one product into a
small, trustworthy single-product brand. Copy is specific, benefit-led and honest: no fake reviews,
no invented certifications, no medical or guaranteed-results claims, and shipping times that
match dropshipping reality (typically 7 to 15 days).`;

export async function draftStore(product: Candidate, niche: string): Promise<StoreDraft> {
  return structured({
    schema: StoreDraft,
    effort: "high",
    system: SYSTEM,
    prompt: `Build the store for this product in the "${niche}" niche:

<product>
${JSON.stringify(product, null, 2)}
</product>

Create a brand name (short, easy to spell, not an existing brand), tagline, brand voice, the
product page, and these pages: About us, Shipping policy, Returns and refunds, FAQ. Price it for a
healthy margin over the supplier cost; use a compare-at price only if it is realistic.`,
  });
}
