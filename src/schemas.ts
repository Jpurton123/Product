import { z } from "zod";

export const Candidate = z.object({
  name: z.string(),
  niche: z.string(),
  whyTrending: z.string(),
  supplierCost: z.number().describe("Typical landed cost per unit from a supplier, including shipping, in the store currency"),
  retailPrice: z.number().describe("Price we would sell it for, in the store currency, including VAT"),
  suppliers: z.array(z.string()).describe("Where to source it, e.g. CJ Dropshipping, AliExpress, Zendrop"),
  scores: z.object({
    margin: z.number().describe("1-10, higher is better"),
    demand: z.number().describe("1-10, higher is better"),
    competition: z.number().describe("1-10, higher means LESS competition"),
    shipping: z.number().describe("1-10, higher means small, light, hard to break"),
    risk: z.number().describe("1-10, higher means LOWER risk (no regulation, IP, sizing or safety issues)"),
  }),
  reasoning: z.string(),
});
export type Candidate = z.infer<typeof Candidate>;

export const Shortlist = z.object({
  recommendedNiche: z.string(),
  nicheReasoning: z.string(),
  candidates: z.array(Candidate),
});
export type Shortlist = z.infer<typeof Shortlist>;

export const StoreDraft = z.object({
  brandName: z.string(),
  tagline: z.string(),
  brandVoice: z.string().describe("Two or three sentences other writers can follow"),
  product: z.object({
    title: z.string(),
    descriptionHtml: z.string().describe("Product page body as simple HTML: <p>, <ul>, <li>, <strong>"),
    price: z.number().describe("In the store currency, including VAT"),
    compareAtPrice: z.number().nullable(),
    productType: z.string(),
    tags: z.array(z.string()),
    seoTitle: z.string(),
    seoDescription: z.string(),
  }),
  pages: z.array(
    z.object({
      title: z.string().describe("For example About us, Shipping policy, Returns and refunds, FAQ"),
      bodyHtml: z.string(),
    }),
  ),
});
export type StoreDraft = z.infer<typeof StoreDraft>;

export const ContentPack = z.object({
  ads: z.array(
    z.object({
      platform: z.enum(["Meta", "TikTok", "Google"]),
      angle: z.string(),
      headline: z.string(),
      primaryText: z.string(),
      callToAction: z.string(),
    }),
  ),
  videoScripts: z.array(
    z.object({
      title: z.string(),
      hook: z.string().describe("First 2 seconds, on screen and spoken"),
      script: z.string(),
      shotList: z.array(z.string()),
      caption: z.string(),
    }),
  ),
  socialPosts: z.array(
    z.object({
      platform: z.enum(["Instagram", "TikTok", "Facebook", "Pinterest", "X"]),
      text: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
  emails: z.array(
    z.object({
      purpose: z.string().describe("For example welcome, abandoned cart, post-purchase"),
      subject: z.string(),
      previewText: z.string(),
      body: z.string(),
    }),
  ),
  imagePrompts: z
    .array(z.string())
    .describe("Prompts for an image model: product shots, lifestyle shots and ad creatives"),
});
export type ContentPack = z.infer<typeof ContentPack>;
