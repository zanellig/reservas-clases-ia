/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 20, 12) // Tuesday 2026-10-20 09:00 ART

const ana = { tokenIdentifier: 'test|ana' }
const beto = { tokenIdentifier: 'test|beto' }
const TOPIC = 'Quiero aprender RAG'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const base = {
      bio: 'Bio',
      headline: 'Headline',
      specialties: ['IA'],
    }
    const teacherA = await ctx.db.insert('teachers', {
      ...base,
      slug: 'a',
      name: 'Ana Docente',
      photoUrl: '/teachers/a.webp',
    })
    const teacherB = await ctx.db.insert('teachers', {
      ...base,
      slug: 'b',
      name: 'Bruno Docente',
      photoUrl: '/teachers/b.webp',
    })
    const slot = (teacherId: typeof teacherA, startsAt: number) =>
      ctx.db.insert('slots', { teacherId, startsAt, durationMin: 60 })
    return {
      teacherA,
      past: await slot(teacherA, NOW - HOUR),
      s1: await slot(teacherA, NOW + HOUR),
      s2: await slot(teacherA, NOW + 2 * HOUR),
      // Teacher B at NOW+1h30: overlaps s1 and s2.
      bOverlap: await slot(teacherB, NOW + 1.5 * HOUR),
    }
  })
  return { t, ...ids }
}

describe('bookings.create', () => {
  test('books the slot and marks it taken', async () => {
    const { t, s1, s2 } = await setup()
    const before = await t.query(api.teachers.list, {})
    expect(before.map((x) => x.name)).toEqual(['Ana Docente', 'Bruno Docente'])
    expect(before[0].nextAvailableAt).toBe(NOW + HOUR)

    const id = await t
      .withIdentity(ana)
      .mutation(api.bookings.create, { slotId: s1, topic: `  ${TOPIC}  ` })

    const page = await t.query(api.teachers.getBySlug, { slug: 'a' })
    expect(page?.slots.map((s) => [s._id, s.available])).toEqual([
      [s1, false],
      [s2, true],
    ])
    const after = await t.query(api.teachers.list, {})
    expect(after[0].nextAvailableAt).toBe(NOW + 2 * HOUR)

    const view = await t.withIdentity(ana).query(api.bookings.get, {
      bookingId: id,
    })
    expect(view).toMatchObject({
      topic: TOPIC,
      status: 'confirmed',
      startsAt: NOW + HOUR,
      durationMin: 60,
      teacher: { slug: 'a', name: 'Ana Docente' },
    })
  })

  test('second student cannot book a taken slot', async () => {
    const { t, s1 } = await setup()
    await t.withIdentity(ana).mutation(api.bookings.create, {
      slotId: s1,
      topic: TOPIC,
    })
    await expect(
      t.withIdentity(beto).mutation(api.bookings.create, {
        slotId: s1,
        topic: TOPIC,
      }),
    ).rejects.toThrow('Ese horario ya fue reservado. Elegí otro.')
  })

  test('rejects past slot, bad topic, missing slot and anonymous user', async () => {
    const { t, past, s1 } = await setup()
    const asAna = t.withIdentity(ana)
    await expect(
      asAna.mutation(api.bookings.create, { slotId: past, topic: TOPIC }),
    ).rejects.toThrow('Ese horario ya pasó. Elegí otro.')
    for (const topic of ['', '   abc   ', 'x'.repeat(301)]) {
      await expect(
        asAna.mutation(api.bookings.create, { slotId: s1, topic }),
      ).rejects.toThrow(
        'Contanos qué querés trabajar en la clase (entre 5 y 300 caracteres).',
      )
    }
    await expect(
      t.mutation(api.bookings.create, { slotId: s1, topic: TOPIC }),
    ).rejects.toThrow('Iniciá sesión para continuar.')

    await t.run((ctx) => ctx.db.delete('slots', s1))
    await expect(
      asAna.mutation(api.bookings.create, { slotId: s1, topic: TOPIC }),
    ).rejects.toThrow('Ese horario no existe.')
  })

  test('rejects an overlapping booking for the same student', async () => {
    const { t, s1, s2, bOverlap } = await setup()
    const asAna = t.withIdentity(ana)
    await asAna.mutation(api.bookings.create, { slotId: s1, topic: TOPIC })
    await expect(
      asAna.mutation(api.bookings.create, { slotId: bOverlap, topic: TOPIC }),
    ).rejects.toThrow('Ya tenés otra clase reservada en ese horario.')
    // Back-to-back is fine.
    await asAna.mutation(api.bookings.create, { slotId: s2, topic: TOPIC })
    // Another student is not affected.
    await t
      .withIdentity(beto)
      .mutation(api.bookings.create, { slotId: bOverlap, topic: TOPIC })
  })
})

describe('bookings.cancel', () => {
  test('frees the slot for another student', async () => {
    const { t, s1 } = await setup()
    const id = await t
      .withIdentity(ana)
      .mutation(api.bookings.create, { slotId: s1, topic: TOPIC })
    await t.withIdentity(ana).mutation(api.bookings.cancel, { bookingId: id })

    const page = await t.query(api.teachers.getBySlug, { slug: 'a' })
    expect(page?.slots[0]).toMatchObject({ _id: s1, available: true })
    await t
      .withIdentity(beto)
      .mutation(api.bookings.create, { slotId: s1, topic: TOPIC })
  })

  test('rejects non-owner, double cancel and started classes', async () => {
    const { t, s1 } = await setup()
    const id = await t
      .withIdentity(ana)
      .mutation(api.bookings.create, { slotId: s1, topic: TOPIC })
    await expect(
      t.withIdentity(beto).mutation(api.bookings.cancel, { bookingId: id }),
    ).rejects.toThrow('No encontramos esa reserva.')

    vi.setSystemTime(NOW + HOUR)
    await expect(
      t.withIdentity(ana).mutation(api.bookings.cancel, { bookingId: id }),
    ).rejects.toThrow('No se puede cancelar una clase que ya empezó.')

    vi.setSystemTime(NOW)
    await t.withIdentity(ana).mutation(api.bookings.cancel, { bookingId: id })
    await expect(
      t.withIdentity(ana).mutation(api.bookings.cancel, { bookingId: id }),
    ).rejects.toThrow('La reserva ya estaba cancelada.')
  })
})

describe('bookings queries', () => {
  test("listMine returns only the caller's upcoming bookings", async () => {
    const { t, s1, s2, bOverlap, teacherA } = await setup()
    const asAna = t.withIdentity(ana)
    const cancelled = await asAna.mutation(api.bookings.create, {
      slotId: s1,
      topic: TOPIC,
    })
    await asAna.mutation(api.bookings.cancel, { bookingId: cancelled })
    await asAna.mutation(api.bookings.create, { slotId: s2, topic: TOPIC })
    await t
      .withIdentity(beto)
      .mutation(api.bookings.create, { slotId: bOverlap, topic: TOPIC })
    // A finished class of Ana's (inserted directly; create rejects the past).
    await t.run((ctx) =>
      ctx.db.insert('bookings', {
        slotId: s1,
        teacherId: teacherA,
        studentId: ana.tokenIdentifier,
        startsAt: NOW - 2 * HOUR,
        durationMin: 60,
        topic: TOPIC,
        status: 'confirmed',
      }),
    )

    const mine = await asAna.query(api.bookings.listMine, {})
    expect(mine.map((b) => [b.startsAt, b.status])).toEqual([
      [NOW + HOUR, 'cancelled'],
      [NOW + 2 * HOUR, 'confirmed'],
    ])
    expect(await t.query(api.bookings.listMine, {})).toEqual([])
  })

  test('get returns null for a non-owner or anonymous user', async () => {
    const { t, s1 } = await setup()
    const id = await t
      .withIdentity(ana)
      .mutation(api.bookings.create, { slotId: s1, topic: TOPIC })
    expect(
      await t.withIdentity(beto).query(api.bookings.get, { bookingId: id }),
    ).toBeNull()
    expect(await t.query(api.bookings.get, { bookingId: id })).toBeNull()
  })
})

test('seed.run is idempotent', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(internal.seed.run, {})
  const count = () =>
    t.run(async (ctx) => ({
      teachers: (await ctx.db.query('teachers').collect()).length,
      slots: (await ctx.db.query('slots').collect()).length,
      bookings: (await ctx.db.query('bookings').collect()).length,
    }))
  const first = await count()
  // Oct 20-29 has 8 weekdays x 3 slots x 5 teachers = 120, minus the two
  // 9:00 ART slots on day 0 that equal NOW and are skipped.
  expect(first.teachers).toBe(5)
  expect(first.slots).toBe(118)
  expect(first.bookings).toBe(3)

  await t.mutation(internal.seed.run, {})
  expect(await count()).toEqual(first)

  const slots = await t.run((ctx) => ctx.db.query('slots').collect())
  for (const s of slots) {
    const art = new Date(s.startsAt - 3 * HOUR)
    expect([0, 6]).not.toContain(art.getUTCDay())
    expect(art.getUTCHours()).toBeGreaterThanOrEqual(9)
    expect(art.getUTCHours()).toBeLessThanOrEqual(20)
    expect(s.startsAt).toBeGreaterThan(NOW)
  }
})
