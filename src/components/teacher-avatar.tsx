import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

function initials(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

export function TeacherAvatar({
	name,
	photoUrl,
	className,
}: {
	name: string;
	photoUrl: string;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-12", className)}>
			<AvatarImage src={photoUrl} alt="" />
			<AvatarFallback className="font-medium text-foreground/70">
				{initials(name)}
			</AvatarFallback>
		</Avatar>
	);
}
