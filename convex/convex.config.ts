import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// Required here so a deploy fails loudly if `convex env set` was skipped.
// Better Auth reads BETTER_AUTH_SECRET itself; SITE_URL is read via `env`.
const app = defineApp({
	env: {
		SITE_URL: v.string(),
		BETTER_AUTH_SECRET: v.string(),
	},
});
app.use(betterAuth);

export default app;
