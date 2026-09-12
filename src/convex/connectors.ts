import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  mutation,
  query,
} from "./_generated/server";

/**
 * API connector registry.
 * Port of the original Express `connectors` store: each connector has a
 * human-friendly publicId (used by the universal trigger endpoint), a target
 * URL, an optional API key sent as a Bearer token, and a description.
 */

function makePublicId() {
  return `conn_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** List the signed-in user's connectors (never exposes the raw API key). */
export const listMyConnectors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const docs = await ctx.db
      .query("connectors")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return docs.map((doc) => ({
      _id: doc._id,
      publicId: doc.publicId,
      name: doc.name,
      targetUrl: doc.targetUrl,
      description: doc.description ?? "",
      hasApiKey: Boolean(doc.apiKey),
      createdAt: doc.createdAt,
    }));
  },
});

/** Create a connector. Validates name + URL like the original POST /api/connectors. */
export const addConnector = mutation({
  args: {
    name: v.string(),
    targetUrl: v.string(),
    apiKey: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");

    const name = args.name.trim();
    const targetUrl = args.targetUrl.trim();

    if (!name || !targetUrl) {
      throw new Error("Name and Target URL are required.");
    }

    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("bad protocol");
      }
    } catch {
      throw new Error("Invalid Target URL format.");
    }

    const publicId = makePublicId();
    await ctx.db.insert("connectors", {
      userId,
      publicId,
      name,
      targetUrl,
      apiKey: args.apiKey?.trim() ? args.apiKey.trim() : undefined,
      description: args.description?.trim() ? args.description.trim() : undefined,
      createdAt: Date.now(),
    });

    return { publicId };
  },
});

/** Seeds the demo Echo connector (httpbin) once per user, like the original demo data. */
export const addDemoConnector = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");

    const existing = await ctx.db
      .query("connectors")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existing.some((c) => c.name === "Demo Echo Service")) {
      return { publicId: existing.find((c) => c.name === "Demo Echo Service")!.publicId };
    }

    const publicId = makePublicId();
    await ctx.db.insert("connectors", {
      userId,
      publicId,
      name: "Demo Echo Service",
      targetUrl: "https://httpbin.org/post",
      description: "A public test endpoint that echoes your request.",
      createdAt: Date.now(),
    });

    return { publicId };
  },
});

/** Delete one of the current user's connectors by publicId. */
export const deleteConnector = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");

    const doc = await ctx.db
      .query("connectors")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("publicId"), args.publicId))
      .unique();

    if (!doc) throw new Error("Connector not found");
    await ctx.db.delete(doc._id);
    return { success: true };
  },
});
