import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const env = (name: string, fallback = "") => process.env[name]?.trim() || fallback;

export const config = {
  models: {
    main: env("MODEL_MAIN", "claude-opus-5-5"),
    scoring: env("MODEL_SCORING", "claude-opus-5-5"),
  },
  // Where the store sells and the currency its prices are in.
  market: env("MARKET", "United Kingdom"),
  currency: env("CURRENCY", "GBP"),
  maxRunCostUsd: Number(env("MAX_RUN_COST_USD", "3")),
  shopify: {
    store: env("SHOPIFY_STORE"),
    accessToken: env("SHOPIFY_ACCESS_TOKEN"),
    clientId: env("SHOPIFY_CLIENT_ID"),
    clientSecret: env("SHOPIFY_CLIENT_SECRET"),
    apiVersion: env("SHOPIFY_API_VERSION", "2026-07"),
  },
};

export const money = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: config.currency }).format(amount);

export const shopifyConfigured = () =>
  Boolean(
    config.shopify.store &&
      !config.shopify.store.startsWith("your-store") &&
      (config.shopify.accessToken || (config.shopify.clientId && config.shopify.clientSecret)),
  );
