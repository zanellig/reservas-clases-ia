import { v } from "convex/values";
import { query } from "./_generated/server";
import { confirmedBookingForSlot } from "./bookings";

// ponytail: Date.now() in queries is not reactive to time passing; results
// refresh on the next data change. Pass `now` as an arg if that ever matters.

export const list = query({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const teachers = await ctx.db.query("teachers").take(100);
		const rows = await Promise.all(
			teachers.map(async (t) => {
				let nextAvailableAt: number | null = null;
				const slots = ctx.db
					.query("slots")
					.withIndex("by_teacher_and_startsAt", (q) =>
						q.eq("teacherId", t._id).gt("startsAt", now),
					);
				for await (const slot of slots) {
					if (!(await confirmedBookingForSlot(ctx, slot._id))) {
						nextAvailableAt = slot.startsAt;
						break;
					}
				}
				return {
					_id: t._id,
					slug: t.slug,
					name: t.name,
					headline: t.headline,
					specialties: t.specialties,
					photoUrl: t.photoUrl,
					nextAvailableAt,
				};
			}),
		);
		return rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
	},
});

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const teacher = await ctx.db
			.query("teachers")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!teacher) return null;
		const slots = await ctx.db
			.query("slots")
			.withIndex("by_teacher_and_startsAt", (q) =>
				q.eq("teacherId", teacher._id).gt("startsAt", Date.now()),
			)
			.take(200);
		return {
			teacher,
			slots: await Promise.all(
				slots.map(async (s) => ({
					_id: s._id,
					startsAt: s.startsAt,
					durationMin: s.durationMin,
					available: !(await confirmedBookingForSlot(ctx, s._id)),
				})),
			),
		};
	},
});
