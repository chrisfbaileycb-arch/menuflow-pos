import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

/**
 * Universal trigger endpoint — port of POST /api/trigger/:connectorId from the
 * original Express server: forwards a JSON payload to the connector's target
 * URL with an optional Bearer token and 15s timeout, and normalizes errors.
 */

type ConnectorDoc = Doc<"connectors">;

/** Response envelope returned by triggerConnector (mirrors the original server.js API). */
export type TriggerResponse = {
  success: boolean;
  connectorName?: string;
  status: number;
  data: unknown;
  error?: string;
};

/** Lookup a connector by publicId, including its secret (internal use only). */
export const getConnectorInternal = internalQuery({
  args: { publicId: v.string() },
  handler: async (ctx, args): Promise<ConnectorDoc | null> => {
    return await ctx.db
      .query("connectors")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.publicId))
      .unique();
  },
});

/** Mirror of the original axios error normalization from server.js. */
function normalizeAxiosError(error: unknown): {
  statusCode: number;
  errorMessage: string;
  errorData: unknown;
} {
  const err = error as {
    response?: { status?: number; data?: unknown };
    request?: unknown;
    code?: string;
    message?: string;
  };

  if (err?.response) {
    // Target responded with a non-2xx status
    return {
      statusCode: err.response.status ?? 500,
      errorMessage: `Target endpoint returned status ${err.response.status}`,
      errorData: err.response.data ?? null,
    };
  }
  if (err?.request) {
    // Request sent but no response received (network error / timeout)
    return {
      statusCode: 504,
      errorMessage: `No response from target endpoint (${err.code ?? "network error"}). It may be down or unreachable.`,
      errorData: null,
    };
  }
  // Setup or other errors
  return {
    statusCode: 500,
    errorMessage: err?.message ?? "Unknown error occurred",
    errorData: null,
  };
}

/**
 * Trigger a connector by publicId. The payload must be JSON-serializable.
 * Returns the same envelope as the original server.js:
 * { success, connectorName, status, data } on success,
 * { success: false, error, status, data } on failure.
 */
export const triggerConnector = action({
  args: {
    publicId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args): Promise<TriggerResponse> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { success: false as const, error: "Not authenticated.", status: 401, data: null };
    }

    const connector: ConnectorDoc | null = await ctx.runQuery(
      internal.connectorsTrigger.getConnectorInternal,
      {
        publicId: args.publicId,
      },
    );

    if (!connector) {
      return { success: false as const, error: "Connector not found", status: 404, data: null };
    }
    if (connector.userId !== userId) {
      // Do not leak existence of other users' connectors
      return { success: false as const, error: "Connector not found", status: 404, data: null };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MenuFlow-Platform/1.0",
    };
    if (connector.apiKey) {
      headers["Authorization"] = `Bearer ${connector.apiKey}`;
    }

    try {
      const response = await fetch(connector.targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(args.payload ?? {}),
        signal: AbortSignal.timeout(15_000),
      });

      const responseText = await response.text();
      let data: unknown = responseText;
      try {
        data = JSON.parse(responseText);
      } catch {
        // keep as text
      }

      return {
        success: true as const,
        connectorName: connector.name,
        status: response.status,
        data,
      };
    } catch (error) {
      const normalized = normalizeAxiosError(error);
      return {
        success: false as const,
        connectorName: connector.name,
        error: normalized.errorMessage,
        status: normalized.statusCode,
        data: normalized.errorData,
      };
    }
  },
});
