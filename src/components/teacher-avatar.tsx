import { Avatar, AvatarFallback } from "~/components/ui/avatar";
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
			<AvatarFallback
				aria-hidden="true"
				className="font-medium text-foreground/70"
			>
				{initials(name)}
			</AvatarFallback>
			{/* Native <img> instead of Radix AvatarImage: Radix only creates the image
			    after hydration, so the browser discovered photos late. This one is in
			    the SSR HTML (React 19 also emits a preload); initials show if it fails. */}
			<img
				key={photoUrl}
				data-slot="avatar-image"
				src={photoUrl}
				alt=""
				width={192}
				height={192}
				decoding="async"
				className="absolute inset-0 size-full rounded-full object-cover"
				ref={(image) => {
					if (image?.complete && image.naturalWidth === 0) image.hidden = true;
				}}
				onError={(event) => {
					event.currentTarget.hidden = true;
				}}
			/>
		</Avatar>
	);
}
