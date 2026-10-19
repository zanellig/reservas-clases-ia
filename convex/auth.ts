import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import type { GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import authConfig from './auth.config'
import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { env, query } from './_generated/server'

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: env.SITE_URL,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    plugins: [convex({ authConfig })],
  })

// The signed-in Better Auth user (name, email, ...), or null.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => await authComponent.safeGetAuthUser(ctx) ?? null,
})
