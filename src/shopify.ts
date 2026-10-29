import { config } from "./config.js";
import type { StoreDraft } from "./schemas.js";

let token = config.shopify.accessToken;

// Dev Dashboard apps get a short-lived token through the client credentials grant.
async function accessToken(): Promise<string> {
  if (token) return token;
  const res = await fetch(`https://${config.shopify.store}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.shopify.clientId,
      client_secret: config.shopify.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Shopify sign-in failed (${res.status}): ${await res.text()}`);
  token = ((await res.json()) as { access_token: string }).access_token;
  return token;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url = `https://${config.shopify.store}/admin/api/${config.shopify.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (body.errors || !body.data) throw new Error(`Shopify API error: ${JSON.stringify(body.errors)}`);
  return body.data;
}

type UserErrors = { userErrors: { field: string[] | null; message: string }[] };
function assertNoUserErrors(step: string, result: UserErrors) {
  if (result.userErrors.length) {
    throw new Error(`Shopify ${step} failed: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
}

export type PublishResult = { productId: string; productHandle: string; pageIds: string[]; adminUrl: string };

/** Creates the product and pages as drafts, so nothing is visible to shoppers until the owner publishes. */
export async function publishDraft(draft: StoreDraft): Promise<PublishResult> {
  const p = draft.product;
  const created = await gql<{
    productCreate: UserErrors & {
      product: { id: string; handle: string; variants: { nodes: { id: string }[] } } | null;
    };
  }>(
    `mutation CreateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id handle variants(first: 1) { nodes { id } } }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: p.title,
        descriptionHtml: p.descriptionHtml,
        vendor: draft.brandName,
        productType: p.productType,
        tags: p.tags,
        status: "DRAFT",
        seo: { title: p.seoTitle, description: p.seoDescription },
      },
    },
  );
  assertNoUserErrors("product create", created.productCreate);
  const product = created.productCreate.product!;

  const priced = await gql<{ productVariantsBulkUpdate: UserErrors }>(
    `mutation SetPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    {
      productId: product.id,
      variants: [
        {
          id: product.variants.nodes[0].id,
          price: p.priceUsd.toFixed(2),
          compareAtPrice: p.compareAtPriceUsd ? p.compareAtPriceUsd.toFixed(2) : null,
        },
      ],
    },
  );
  assertNoUserErrors("price update", priced.productVariantsBulkUpdate);

  const pageIds: string[] = [];
  for (const page of draft.pages) {
    const result = await gql<{ pageCreate: UserErrors & { page: { id: string } | null } }>(
      `mutation CreatePage($page: PageCreateInput!) {
        pageCreate(page: $page) { page { id } userErrors { field message } }
      }`,
      { page: { title: page.title, body: page.bodyHtml, isPublished: false } },
    );
    assertNoUserErrors(`page "${page.title}"`, result.pageCreate);
    pageIds.push(result.pageCreate.page!.id);
  }

  const numericId = product.id.split("/").pop();
  return {
    productId: product.id,
    productHandle: product.handle,
    pageIds,
    adminUrl: `https://${config.shopify.store}/admin/products/${numericId}`,
  };
}
