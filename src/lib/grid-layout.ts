/*
 * Where each event's box goes in a week of the month grid.
 *
 * Pure — no Svelte, no DOM — and heavily tested, because this is the one part
 * of the calendar that is genuinely an algorithm rather than a query.
 *
 * ## The problem
 *
 * Round 11 drew a coloured dot per event. Marçal's note after using it: they
 * should be small boxes with some of the title showing, and **a holiday that
 * runs Friday to Tuesday should be one unbroken bar**, not five separate boxes.
 *
 * One bar across several columns means the boxes cannot live inside the day
 * cells — a cell cannot draw outside itself. So a week row is a positioned
 * container, and every event becomes a *segment*: a start column, a width in
 * columns, and a lane (which line of boxes it sits on). This file works out
 * those three numbers.
 *
 * ## Lanes
 *
 * A lane is a horizontal line within the week row. Two events can share a lane
 * only if their columns don't touch. Each event takes the lowest free lane, so
 * the boxes pack upwards and the week is as short as it can be.
 *
 * **Longer events get first pick.** They are sorted by span before anything
 * else, which matters for a reason that isn't obvious: a bar that changes lane
 * halfway through a week reads as two different events. Giving the long ones
 * the low lanes first keeps them low and unbroken, and lets the single days
 * shuffle around them.
 *
 * ## Overflow
 *
 * A phone has room for two or three lanes, not eight. Anything that doesn't fit
 * is dropped from the layout and counted per column, so the cell can say "+2".
 * The count is per *day*, not per week: "+2" under Tuesday has to mean two more
 * things on Tuesday.
 */

import type { CalendarEvent } from './calendar'
import { isMultiDay, sortEvents } from './calendar'
import { daysBetween } from './dates'

/** One event's box within one week row. */
export interface Segment {
  event: CalendarEvent
  /** Which line of boxes, from 0 at the top. */
  lane: number
  /** 0–6. Which column the box starts in. */
  column: number
  /** How many columns it covers. At least 1. */
  span: number
  /** The event began before this week — draw the left edge flat. */
  clippedStart: boolean
  /** The event runs past this week — draw the right edge flat. */
  clippedEnd: boolean
}

export interface WeekLayout {
  segments: Segment[]
  /** How many lanes are actually used. Zero for an empty week. */
  lanes: number
  /** Per column, how many events did not fit. Always length 7. */
  overflow: number[]
}

/** What a week row can show before it starts counting instead. */
export const DEFAULT_MAX_LANES = 3

/**
 * Where an event sits in a given week, or null if it misses the week entirely.
 *
 * `days` is the seven day keys of the week, Monday first.
 */
function place(
  event: CalendarEvent,
  days: readonly string[],
): { column: number; span: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const first = days[0]
  const last = days[days.length - 1]
  if (first === undefined || last === undefined) return null
  if (event.endsOn < first || event.startsOn > last) return null

  const startsBefore = event.startsOn < first
  const endsAfter = event.endsOn > last

  const column = startsBefore ? 0 : daysBetween(first, event.startsOn)
  const endColumn = endsAfter ? days.length - 1 : daysBetween(first, event.endsOn)

  return {
    column,
    span: Math.max(1, endColumn - column + 1),
    clippedStart: startsBefore,
    clippedEnd: endsAfter,
  }
}

/**
 * The order events are given lanes in.
 *
 * Longest first, so a multi-day bar keeps one lane all the way across — see the
 * header. Everything after that is the calendar's own order, which is all-day
 * before timed and then the clock, so a week reads top-to-bottom the same way a
 * day does.
 */
function packingOrder(events: readonly CalendarEvent[]): CalendarEvent[] {
  const ordered = sortEvents(events)
  return ordered.sort((a, b) => {
    const spanA = daysBetween(a.startsOn, a.endsOn)
    const spanB = daysBetween(b.startsOn, b.endsOn)
    if (spanA !== spanB) return spanB - spanA
    return ordered.indexOf(a) - ordered.indexOf(b)
  })
}

/**
 * Lay one week out.
 *
 * `maxLanes` is how many lines of boxes there is room for; anything beyond that
 * is counted in `overflow` rather than drawn.
 */
export function layOutWeek(
  days: readonly string[],
  events: readonly CalendarEvent[],
  maxLanes: number = DEFAULT_MAX_LANES,
): WeekLayout {
  const segments: Segment[] = []
  const overflow = [0, 0, 0, 0, 0, 0, 0]
  // taken[lane][column] — whether that box is already occupied.
  const taken: boolean[][] = []
  let lanes = 0

  for (const event of packingOrder(events)) {
    const spot = place(event, days)
    if (spot === null) continue

    let lane = 0
    while (lane < maxLanes) {
      const row = taken[lane]
      const free =
        row === undefined ||
        Array.from({ length: spot.span }, (_, i) => row[spot.column + i]).every((v) => !v)
      if (free) break
      lane += 1
    }

    if (lane >= maxLanes) {
      // No room. It still happened, so every day it touches says so.
      for (let i = 0; i < spot.span; i += 1) {
        const column = spot.column + i
        if (column < overflow.length) overflow[column] = (overflow[column] ?? 0) + 1
      }
      continue
    }

    const row = (taken[lane] ??= [])
    for (let i = 0; i < spot.span; i += 1) row[spot.column + i] = true

    segments.push({ event, lane, ...spot })
    lanes = Math.max(lanes, lane + 1)
  }

  return { segments, lanes, overflow }
}

/**
 * A whole month grid, one layout per week.
 *
 * `days` is every cell the grid draws (see monthGrid in dates.ts), which is
 * always a whole number of weeks.
 */
export function layOutGrid(
  days: readonly string[],
  events: readonly CalendarEvent[],
  maxLanes: number = DEFAULT_MAX_LANES,
): WeekLayout[] {
  const weeks: WeekLayout[] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(layOutWeek(days.slice(i, i + 7), events, maxLanes))
  }
  return weeks
}

/**
 * True when this segment should draw a time in front of the title.
 *
 * A one-column box is about 55px, which is five or six characters — the whole
 * budget goes on the title. Three columns and there is room for both, and the
 * time is worth having there because a bar that wide is usually a plan rather
 * than an appointment.
 *
 * Judged from the span rather than by measuring the text, deliberately.
 * Measuring means a layout pass per box per redraw, and being one character out
 * costs an ellipsis nobody notices.
 */
export function showsTime(segment: Segment): boolean {
  return (
    segment.span >= 3 &&
    segment.event.startTime !== null &&
    !isMultiDay(segment.event)
  )
}
