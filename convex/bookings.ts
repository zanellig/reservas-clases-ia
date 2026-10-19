import { RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	MAX_UPCOMING_BOOKINGS,
	TOPIC_MAX_LENGTH,
	TOPIC_MIN_LENGTH,
} from "./lib/constants";
import { getStudentId, requireStudentId } from "./lib/student";

const MINUTE = 60_000;
// ponytail: overlap/upcoming scans assume no class lasts longer than this.
const MAX_CLASS_MS = 24 * 60 * MINUTE;

const rateLimiter = new RateLimiter(components.rateLimiter, {
	// ponytail: per-student token bucket for create + cancel; tune with real traffic.
	bookingWrites: {
		kind: "token bucket",
		rate: 10,
		period: MINUTE,
		capacity: 5,
	},
});

// Runs inside the mutation's transaction, so a mutation that later throws
// (e.g. slot taken) rolls the token back: only successful writes are counted.
async function limitBookingWrites(ctx: MutationCtx, studentId: string) {
	const { ok, retryAfter } = await rateLimiter.limit(ctx, "bookingWrites", {
		key: studentId,
	});
	if (!ok) {
		throw new ConvexError(
			`Hiciste muchos cambios seguidos. Probá de nuevo en ${Math.ceil(retryAfter / 1000)} s.`,
		);
	}
}

export async function confirmedBookingForSlot(
	ctx: QueryCtx | MutationCtx,
	slotId: Id<"slots">,
) {
	return await ctx.db
		.query("bookings")
		.withIndex("by_slotId_and_status", (q) =>
			q.eq("slotId", slotId).eq("status", "confirmed"),
		)
		.first();
}

async function toView(ctx: QueryCtx, booking: Doc<"bookings">) {
	const teacher = await ctx.db.get("teachers", booking.teacherId);
	if (!teacher) throw new Error(`Teacher ${booking.teacherId} not found`);
	return {
		_id: booking._id,
		startsAt: booking.startsAt,
		durationMin: booking.durationMin,
		topic: booking.topic,
		status: booking.status,
		teacher: {
			name: teacher.name,
			slug: teacher.slug,
			headline: teacher.headline,
			photoUrl: teacher.photoUrl,
		},
	};
}

export type BookingView = Awaited<ReturnType<typeof toView>>;

export const create = mutation({
	args: { slotId: v.id("slots"), topic: v.string() },
	handler: async (ctx, args) => {
		const studentId = await requireStudentId(ctx);
		await limitBookingWrites(ctx, studentId);

		const topic = args.topic.trim();
		if (topic.length < TOPIC_MIN_LENGTH || topic.length > TOPIC_MAX_LENGTH) {
			throw new ConvexError(
				`Contanos qué querés trabajar en la clase (entre ${TOPIC_MIN_LENGTH} y ${TOPIC_MAX_LENGTH} caracteres).`,
			);
		}

		const slot = await ctx.db.get("slots", args.slotId);
		if (!slot) throw new ConvexError("Ese horario no existe.");
		if (slot.startsAt <= Date.now()) {
			throw new ConvexError("Ese horario ya pasó. Elegí otro.");
		}

		// Race-safe: Convex mutations are serializable transactions with OCC. This
		// index range read conflicts with any concurrent insert of a confirmed
		// booking for the same slot, so the losing mutation is retried, sees the
		// winner's booking here and fails. The same holds for the overlap read below.
		if (await confirmedBookingForSlot(ctx, slot._id)) {
			throw new ConvexError("Ese horario ya fue reservado. Elegí otro.");
		}

		const endsAt = slot.startsAt + slot.durationMin * MINUTE;
		const nearby = await ctx.db
			.query("bookings")
			.withIndex("by_studentId_and_startsAt", (q) =>
				q
					.eq("studentId", studentId)
					.gt("startsAt", slot.startsAt - MAX_CLASS_MS)
					.lt("startsAt", endsAt),
			)
			.take(100);
		const overlaps = nearby.some(
			(b) =>
				b.status === "confirmed" &&
				b.startsAt + b.durationMin * MINUTE > slot.startsAt,
		);
		if (overlaps) {
			throw new ConvexError("Ya tenés otra clase reservada en ese horario.");
		}

		const upcoming = await ctx.db
			.query("bookings")
			.withIndex("by_studentId_and_startsAt", (q) =>
				q.eq("studentId", studentId).gt("startsAt", Date.now()),
			)
			.take(100);
		const confirmedUpcoming = upcoming.filter((b) => b.status === "confirmed");
		if (confirmedUpcoming.length >= MAX_UPCOMING_BOOKINGS) {
			throw new ConvexError(
				`Ya tenés ${MAX_UPCOMING_BOOKINGS} clases reservadas. Cancelá alguna para reservar otra.`,
			);
		}

		return await ctx.db.insert("bookings", {
			slotId: slot._id,
			teacherId: slot.teacherId,
			studentId,
			startsAt: slot.startsAt,
			durationMin: slot.durationMin,
			topic,
			status: "confirmed",
		});
	},
});

export const get = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const studentId = await getStudentId(ctx);
		if (!studentId) return null;
		const booking = await ctx.db.get("bookings", args.bookingId);
		if (!booking || booking.studentId !== studentId) return null;
		return await toView(ctx, booking);
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const studentId = await getStudentId(ctx);
		if (!studentId) return [];
		// ponytail: Date.now() in a query is not reactive to time passing; a class
		// that ends stays listed until the next data change. Fine for a demo.
		const now = Date.now();
		const bookings = await ctx.db
			.query("bookings")
			.withIndex("by_studentId_and_startsAt", (q) =>
				q.eq("studentId", studentId).gt("startsAt", now - MAX_CLASS_MS),
			)
			.take(100);
		const upcoming = bookings.filter(
			(b) => b.startsAt + b.durationMin * MINUTE > now,
		);
		return await Promise.all(upcoming.map((b) => toView(ctx, b)));
	},
});

export const cancel = mutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const studentId = await requireStudentId(ctx);
		await limitBookingWrites(ctx, studentId);
		const booking = await ctx.db.get("bookings", args.bookingId);
		if (!booking || booking.studentId !== studentId) {
			throw new ConvexError("No encontramos esa reserva.");
		}
		if (booking.status === "cancelled") {
			throw new ConvexError("La reserva ya estaba cancelada.");
		}
		if (booking.startsAt <= Date.now()) {
			throw new ConvexError("No se puede cancelar una clase que ya empezó.");
		}
		// The slot is free again because it no longer has a confirmed booking.
		await ctx.db.patch("bookings", booking._id, { status: "cancelled" });
		return null;
	},
});
