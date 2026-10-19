import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
	},
	// Better Auth guide: bundle the component during SSR to avoid module resolution issues.
	ssr: {
		noExternal: ["@convex-dev/better-auth"],
	},
	plugins: [
		tailwindcss(),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart(),
		nitro(),
		viteReact(),
	],
});
