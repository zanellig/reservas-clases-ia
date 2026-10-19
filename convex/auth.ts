import type { GenericCtx } from "@convex-dev/better-auth";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env, query } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
	betterAuth({
		baseURL: env.SITE_URL,
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 8,
		},
		// Built-in per-IP limits (sign-in/sign-up: 3 per 10 s). "database" uses the
		// component's rateLimit table; the default memory store isn't shared
		// across Convex isolates.
		rateLimit: { enabled: true, storage: "database" },
		// x-client-ip comes from our TanStack proxy (src/routes/api/auth/$.ts).
		// ponytail: a direct caller of the .convex.site URL can spoof it; production
		// fix is a shared secret between proxy and Convex, or a WAF rate limit.
		advanced: {
			ipAddress: { ipAddressHeaders: ["x-client-ip", "x-forwarded-for"] },
		},
		plugins: [convex({ authConfig })],
	});

// The signed-in Better Auth user (name, email, ...), or null.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => (await authComponent.safeGetAuthUser(ctx)) ?? null,
});
