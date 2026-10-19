import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  teachers: defineTable({
    slug: v.string(),
    name: v.string(),
    headline: v.string(),
    bio: v.string(),
    specialties: v.array(v.string()),
    photoUrl: v.string(),
  }).index('by_slug', ['slug']),

  slots: defineTable({
    teacherId: v.id('teachers'),
    startsAt: v.number(), // epoch ms, UTC
    durationMin: v.number(),
  })
    .index('by_teacher_and_startsAt', ['teacherId', 'startsAt'])
    .index('by_startsAt', ['startsAt']),

  // A slot is available iff it has no booking with status "confirmed".
  bookings: defineTable({
    slotId: v.id('slots'),
    teacherId: v.id('teachers'),
    studentId: v.string(), // identity.tokenIdentifier
    startsAt: v.number(), // copied from the slot
    durationMin: v.number(),
    topic: v.string(),
    status: v.union(v.literal('confirmed'), v.literal('cancelled')),
  })
    .index('by_slotId_and_status', ['slotId', 'status'])
    .index('by_studentId_and_startsAt', ['studentId', 'startsAt']),
})
