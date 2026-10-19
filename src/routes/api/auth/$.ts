import { createFileRoute } from "@tanstack/react-router";
import { handler } from "~/lib/auth-server";

// Convex's edge overwrites x-forwarded-for with the caller's IP, which is this
// server's, not the browser's. Forward the browser's IP (set by Vercel's edge)
// in x-client-ip so Better Auth rate-limits per user instead of globally.
async function withClientIp(request: Request) {
	const ip =
		request.headers.get("x-real-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (!ip) return request;
	const headers = new Headers(request.headers);
	headers.set("x-client-ip", ip);
	// Auth bodies are small JSON; reading them avoids streaming-body (duplex) issues.
	const body = request.method === "GET" ? undefined : await request.text();
	return new Request(request.url, { method: request.method, headers, body });
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => handler(await withClientIp(request)),
			POST: async ({ request }) => handler(await withClientIp(request)),
		},
	},
});
