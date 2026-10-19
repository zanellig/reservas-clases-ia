// Two students book the same slot at the same time; exactly one must succeed.
// Usage: with `bun run dev` running, `bun scripts/race-check.ts`.
const APP = "http://localhost:3000";
// Bun loads .env.local, so this is the same deployment the app uses.
const CONVEX = import.meta.env.VITE_CONVEX_URL;

async function student(tag: string) {
	const email = `race-${tag}-${Date.now()}@example.com`;
	const headers = { "content-type": "application/json", origin: APP };
	const res = await fetch(`${APP}/api/auth/sign-up/email`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			name: `Race ${tag}`,
			email,
			password: "password123",
		}),
	});
	if (!res.ok) throw new Error(`sign-up ${res.status} ${await res.text()}`);
	const cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	const tok = await fetch(`${APP}/api/auth/convex/token`, {
		headers: { cookie, origin: APP },
	});
	return ((await tok.json()) as { token: string }).token;
}

async function call(
	kind: "query" | "mutation",
	path: string,
	args: object,
	jwt?: string,
) {
	const res = await fetch(`${CONVEX}/api/${kind}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(jwt && { authorization: `Bearer ${jwt}` }),
		},
		body: JSON.stringify({ path, args, format: "json" }),
	});
	return res.json() as Promise<{
		status: string;
		value?: unknown;
		errorMessage?: string;
		errorData?: unknown;
	}>;
}

const [a, b] = await Promise.all([student("a"), student("b")]);
const profile = await call("query", "teachers:getBySlug", {
	slug: "diego-herrera",
});
const slot = (
	profile.value as {
		slots: { _id: string; available: boolean; startsAt: number }[];
	}
).slots.find((s) => s.available);
if (!slot) throw new Error("No available slot to race on");
console.log("slot", slot._id, new Date(slot.startsAt).toISOString());

const results = await Promise.all(
	[a, b].map((jwt, i) =>
		call(
			"mutation",
			"bookings:create",
			{ slotId: slot._id, topic: `Prueba de concurrencia ${i}` },
			jwt,
		),
	),
);
for (const r of results)
	console.log(r.status, r.status === "success" ? r.value : r.errorData);

const after = await call("query", "teachers:getBySlug", {
	slug: "diego-herrera",
});
const s = (
	after.value as { slots: { _id: string; available: boolean }[] }
).slots.find((x) => x._id === slot._id);
console.log("slot available after race:", s?.available);
const ok = results.filter((r) => r.status === "success").length;
if (ok !== 1) throw new Error(`FAIL: ${ok} successes`);
console.log("PASS: exactly one booking confirmed");

export {};
