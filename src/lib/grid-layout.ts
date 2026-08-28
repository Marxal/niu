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
 * ## Dots, and the rule that decides between a box and a dot
 *
 * Round 11.1 drew every event as a titled box and stacked up to three of them.
 * Marçal, after a busy week: *"if there's more than one event it gets too
 * crowded. one event show the text, more than one event show dots instead."*
 *
 * So the rule is per **day**, and it is the one he wrote:
 *
 *   one thing on that day    → a box with the title in it
 *   more than one            → a dot each, on one line
 *
 * with one exception, which is the reason the boxes exist at all: **a multi-day
 * event is always a bar.** A holiday running Friday to Tuesday cannot become
 * five dots — five dots on five days say five things happened, not that one
 * thing lasted five days — and it is the only shape in the grid that can say
 * "this is still going". So a day carrying a holiday *and* a birthday draws the
 * bar and turns the birthday into a dot, which is still the rule: the day has
 * more than one thing on it, so what fits gets a word and the rest get dots.
 *
 * A dot is 6px and a box is 17px, so a day with four things on it costs one
 * line instead of three, and a busy September stops pushing the day list off
 * the bottom of the screen. Which day each dot belongs to is never in doubt,
 * because a dot never leaves its own cell.
 *
 * ## Overflow
 *
 * A phone has room for two or three lanes and about four dots, not eight of
 * either. Anything that doesn't fit is dropped from the layout and counted per
 * column, so the cell can say "+2". The count is per *day*, not per week: "+2"
 * under Tuesday has to mean two more things on Tuesday.
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
  /**
   * Per column, the events drawn as dots rather than boxes, in the order they
   * happen. Always length 7; usually mostly empty.
   */
  dots: CalendarEvent[][]
  /** How many lanes are actually used. Zero for an empty week. */
  lanes: number
  /** Per column, how many events did not fit. Always length 7. */
  overflow: number[]
}

/** What a week row can show before it starts counting instead. */
export const DEFAULT_MAX_LANES = 3

/**
 * How many dots fit across one cell.
 *
 * A cell is about 52px wide and a dot with its gap is 9px, so five would fit
 * and four leaves room for the "+2" beside them when there are more.
 */
export const MAX_DOTS = 4

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
 * How busy each column is — how many events cover that day, counting the ones
 * that started before this week and are still going.
 *
 * This is the number the box-or-dot rule reads. It counts *events on the day*,
 * not events drawn in the week, so Tuesday is busy because Tuesday is busy and
 * not because Thursday is.
 */
function dayCounts(days: readonly string[], events: readonly CalendarEvent[]): number[] {
  return days.map((day) => events.filter((e) => e.startsOn <= day && day <= e.endsOn).length)
}

/**
 * Lay one week out.
 *
 * `maxLanes` is how many lines of boxes there is room for; anything beyond that
 * is counted in `overflow` rather than drawn. See the header for the rule that
 * decides which events become boxes and which become dots.
 */
export function layOutWeek(
  days: readonly string[],
  events: readonly CalendarEvent[],
  maxLanes: number = DEFAULT_MAX_LANES,
): WeekLayout {
  const segments: Segment[] = []
  const dots: CalendarEvent[][] = [[], [], [], [], [], [], []]
  const overflow = [0, 0, 0, 0, 0, 0, 0]
  // taken[lane][column] — whether that box is already occupied.
  const taken: boolean[][] = []
  let lanes = 0

  const counts = dayCounts(days, events)

  /** A single-day event's dot goes in its own column, or is counted. */
  function dot(event: CalendarEvent, column: number): void {
    const bucket = dots[column]
    if (bucket === undefined) return
    if (bucket.length >= MAX_DOTS) overflow[column] = (overflow[column] ?? 0) + 1
    else bucket.push(event)
  }

  for (const event of packingOrder(events)) {
    const spot = place(event, days)
    if (spot === null) continue

    // The rule: a bar if it spans days, a box if it is the only thing on its
    // day, a dot otherwise. `place` clamps a bar to the week, so a holiday
    // that started last month is multi-day here even when its span is 1.
    const multiDay = isMultiDay(event)
    const alone = (counts[spot.column] ?? 0) <= 1
    if (!multiDay && !alone) {
      dot(event, spot.column)
      continue
    }

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
      //
      // Only a bar can land here: a single-day event reaching the lane search
      // is by definition the only thing on its day, so nothing can be occupying
      // that column and lane 0 is always free for it.
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

  // Dots read in the day's own order — all-day first, then the clock — which
  // packingOrder deliberately does not use.
  for (let i = 0; i < dots.length; i += 1) dots[i] = sortEvents(dots[i] ?? [])

  return { segments, dots, lanes, overflow }
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
