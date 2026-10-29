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
   - In Shopify, create an app in the Dev Dashboard with the `write_products`, `write_content` and `read_orders` scopes and install it on your store. Put its client id and secret in `.env`. If you already have an Admin API access token, use `SHOPIFY_ACCESS_TOKEN` instead.

## Use

```bash
npm run discover          # research and score products (a few minutes)
npm run store             # pick a product, write the store, optionally push to Shopify
npm run content           # write the launch content pack
npm run run-all           # all three in a row
npm run report            # this week's action report from your Shopify sales
```

Every run is saved in `runs/<time>/` (`research.md`, `shortlist.json`, `store.json`, `content.md`).

## Run it on GitHub (no computer needed)

Two workflows in the **Actions** tab do the same work on GitHub's servers and save results to `runs/` in this repo.

- **Build store** (run by hand): leave "pick" blank to research products. Open the new `runs/<time>/shortlist.json`, choose a product, then run it again with that product's number in "pick". It writes the store, creates it in Shopify as drafts, and writes the launch content.
- **Weekly product research and content** (automatic): every Sunday from 1 November 2026, it researches new products, writes fresh content for your live brand, and opens a GitHub issue called "This week's plan". That issue lists what to do this week and says when it's time to invest more, based on your real Shopify sales. Turn on GitHub notifications (or the GitHub app) to get it on your phone. It reads orders but never changes your Shopify store.

Add these under **Settings → Secrets and variables → Actions**: `ANTHROPIC_API_KEY`, `SHOPIFY_STORE`, and either `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` or `SHOPIFY_ACCESS_TOKEN`.

## Launch day (1 November)

1. Add credit to your Anthropic account and create an API key. Add it as the `ANTHROPIC_API_KEY` secret.
2. Start your Shopify plan, create the Dev Dashboard app (see Setup), and add the Shopify secrets.
3. Run **Build store** with "pick" blank, choose a product, and run it again with the number.
4. In Shopify admin, review the draft product and pages, add product photos, set them to active, and remove the store password.
5. Post the content from `runs/<time>/content.md`. From then on, new research, content and your action plan arrive every Sunday evening.

## Cost

Each run prints what it spent on Claude (Anthropic bills in US dollars, so your card is charged in USD). `MAX_RUN_COST_USD` (default $3) stops a run that goes over. A full run is expected to cost roughly $1 to $2 on Claude Opus 5.5, mostly from web research. To make product scoring cheaper, set `MODEL_SCORING=claude-haiku-5-5`.
