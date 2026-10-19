import { ConvexError } from "convex/values";

export function errorMessage(err: unknown) {
	return err instanceof ConvexError
		? String(err.data)
		: "Algo salió mal. Probá de nuevo.";
}
