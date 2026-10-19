import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";

// Icon + text, so the status never depends on color alone.
export function StatusBadge({ status }: { status: "confirmed" | "cancelled" }) {
	return status === "confirmed" ? (
		<Badge>
			<CheckIcon data-icon="inline-start" aria-hidden />
			Confirmada
		</Badge>
	) : (
		<Badge variant="secondary">
			<XIcon data-icon="inline-start" aria-hidden />
			Cancelada
		</Badge>
	);
}
