import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { TEACHERS } from "./seedData";

// Argentina (America/Argentina/Buenos_Aires) is fixed UTC-3, no DST.
const ART_OFFSET_H = 3;
const DAYS = 10;
const DURATION_MIN = 60;
// One set of local (ART) start hours per teacher, by TEACHERS index.
const HOURS = [
	[9, 13, 17],
	[10, 14, 18],
	[11, 15, 19],
	[12, 16, 20],
	[9, 12, 15],
];
const SEED_STUDENT = "seed|otro-alumno";
const SEED_TOPICS = [
	"Quiero entender cómo evaluar las respuestas de un modelo.",
	"Revisar mi proyecto de detección de objetos.",
	"Ajustar un modelo de lenguaje a textos legales.",
];

// Idempotent: `convex dev --run seed:run` calls this on every start.
export const run = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now();
		// Calendar day "today" in ART.
		const art = new Date(now - ART_OFFSET_H * 3_600_000);
		const [y, m, d] = [
			art.getUTCFullYear(),
			art.getUTCMonth(),
			art.getUTCDate(),
		];

		const generated: Array<Array<Omit<Doc<"slots">, "_creationTime">>> = [];
		for (const [i, t] of TEACHERS.entries()) {
			const fields = {
				...t,
				specialties: [...t.specialties],
				photoUrl: `/teachers/${t.slug}.webp`,
			};
			const existing = await ctx.db
				.query("teachers")
				.withIndex("by_slug", (q) => q.eq("slug", t.slug))
				.unique();
			let teacherId: Id<"teachers">;
			if (existing) {
				await ctx.db.patch("teachers", existing._id, fields);
				teacherId = existing._id;
			} else {
				teacherId = await ctx.db.insert("teachers", fields);
			}

			const hasFutureSlot = await ctx.db
				.query("slots")
				.withIndex("by_teacher_and_startsAt", (q) =>
					q.eq("teacherId", teacherId).gt("startsAt", now),
				)
				.first();
			const slots: (typeof generated)[number] = [];
			generated.push(slots);
			if (hasFutureSlot) continue;

			for (let day = 0; day < DAYS; day++) {
				const weekday = new Date(Date.UTC(y, m, d + day)).getUTCDay();
				if (weekday === 0 || weekday === 6) continue;
				for (const hour of HOURS[i % HOURS.length]) {
					const startsAt = Date.UTC(y, m, d + day, hour + ART_OFFSET_H);
					if (startsAt <= now) continue;
					const slot = { teacherId, startsAt, durationMin: DURATION_MIN };
					const _id = await ctx.db.insert("slots", slot);
					slots.push({ _id, ...slot });
				}
			}
		}

		// Only when slots were just generated: take a few so the demo shows them
		// as booked. Teacher i gets its i-th slot booked; hours differ per teacher
		// so these never overlap for the seed student.
		for (const [i, topic] of SEED_TOPICS.entries()) {
			const slot = generated[i]?.[i];
			if (!slot) continue;
			await ctx.db.insert("bookings", {
				slotId: slot._id,
				teacherId: slot.teacherId,
				studentId: SEED_STUDENT,
				startsAt: slot.startsAt,
				durationMin: slot.durationMin,
				topic,
				status: "confirmed",
			});
		}
		return null;
	},
});
