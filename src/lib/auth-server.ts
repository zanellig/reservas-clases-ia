import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

// ponytail: import.meta.env instead of the guide's process.env; same values, no @types/node needed.
export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL,
  })
