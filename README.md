# Product pipeline

An AI pipeline for a one-person Shopify store. It does three things, and you approve each step:

1. **Find the product.** Claude searches the web for products trending right now, then scores each one on margin, demand, competition, shipping and risk, and picks a niche.
2. **Build the store.** For the product you pick, Claude writes the brand, product page, price and store pages (About, Shipping, Returns, FAQ). It then creates them in Shopify as **drafts**, so shoppers see nothing until you publish.
3. **Make the content.** Claude writes ads, short video scripts, social posts, emails and image prompts, saved as `content.md`.

## Setup

1. Install Node.js 20 or newer.
2. `npm install`
3. Copy `.env.example` to `.env` and add your Anthropic API key (from console.anthropic.com).
4. Optional: add Shopify details. Without them, the store step is a dry run and saves the store to `runs/` only.
   - In Shopify, create an app in the Dev Dashboard with the `write_products` and `write_content` scopes and install it on your store. Put its client id and secret in `.env`. If you already have an Admin API access token, use `SHOPIFY_ACCESS_TOKEN` instead.

## Use

```bash
npm run discover          # research and score products (a few minutes)
npm run store             # pick a product, write the store, optionally push to Shopify
npm run content           # write the launch content pack
npm run run-all           # all three in a row
```

Every run is saved in `runs/<time>/` (`research.md`, `shortlist.json`, `store.json`, `content.md`).

## Cost

Each run prints what it spent on Claude. `MAX_RUN_COST_USD` (default $3) stops a run that goes over. A full run is expected to cost roughly $1 to $2 on Claude Opus 5.5, mostly from web research. To make product scoring cheaper, set `MODEL_SCORING=claude-haiku-5-5`.
