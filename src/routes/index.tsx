import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { CalendarClockIcon } from "lucide-react";
import { TeacherAvatar } from "~/components/teacher-avatar";
import { Badge } from "~/components/ui/badge";
import { formatDayShort, formatTime } from "~/lib/format";
import { api } from "../../convex/_generated/api";

const teachersQuery = convexQuery(api.teachers.list, {});

export const Route = createFileRoute("/")({
	loader: ({ context }) =>
		context.queryClient.query({ ...teachersQuery, staleTime: "static" }),
	head: () => ({
		meta: [{ title: "Aula IA · Clases 1 a 1 de inteligencia artificial" }],
	}),
	component: Home,
});

type TeacherSummary = FunctionReturnType<typeof api.teachers.list>[number];

function Home() {
	const { data: teachers } = useSuspenseQuery(teachersQuery);

	return (
		<div className="sm:py-6">
			<section className="max-w-2xl">
				<h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
					Clases 1 a 1 con especialistas en inteligencia artificial
				</h1>
				<p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
					Elegí con quién aprender, mirá sus horarios y reservá una clase de 60
					minutos sobre lo que necesites.
				</p>
			</section>

			<section aria-labelledby="profesores" className="mt-12">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 id="profesores" className="text-lg font-semibold">
						Profesores
					</h2>
				</div>

				{teachers.length === 0 ? (
					<p className="mt-4 rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
						Todavía no hay profesores cargados.
					</p>
				) : (
					<ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{teachers.map((teacher) => (
							<li key={teacher._id} className="flex">
								<TeacherCard teacher={teacher} />
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function TeacherCard({ teacher }: { teacher: TeacherSummary }) {
	return (
		<Link
			to="/profesores/$slug"
			params={{ slug: teacher.slug }}
			className="group flex w-full flex-col gap-4 rounded-xl border bg-card p-5 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<div className="flex items-center gap-3">
				<TeacherAvatar
					name={teacher.name}
					photoUrl={teacher.photoUrl}
					className="size-14"
				/>
				<div className="min-w-0">
					<h3 className="font-semibold group-hover:underline group-hover:underline-offset-4">
						{teacher.name}
					</h3>
					<p className="text-sm text-muted-foreground">{teacher.headline}</p>
				</div>
			</div>

			<ul className="flex flex-wrap gap-1.5" aria-label="Especialidades">
				{teacher.specialties.map((specialty) => (
					<li key={specialty}>
						<Badge variant="outline">{specialty}</Badge>
					</li>
				))}
			</ul>

			<p className="mt-auto flex items-center gap-2 border-t pt-4 text-sm">
				<CalendarClockIcon
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
				{teacher.nextAvailableAt === null ? (
					<span className="text-muted-foreground">
						Sin horarios disponibles
					</span>
				) : (
					<span>
						<span className="text-muted-foreground">Próximo horario: </span>
						<span className="font-medium">
							{formatDayShort(teacher.nextAvailableAt)},{" "}
							{formatTime(teacher.nextAvailableAt)}
						</span>
					</span>
				)}
			</p>
		</Link>
	);
}
