import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// The student is whoever Better Auth authenticated; never trust an id from args.
export async function getStudentId(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.tokenIdentifier ?? null;
}

export async function requireStudentId(ctx: QueryCtx | MutationCtx) {
	const studentId = await getStudentId(ctx);
	if (!studentId) throw new ConvexError("Iniciá sesión para continuar.");
	return studentId;
}
