/*
 * "Is this answer still worth listening to?"
 *
 * Every store in the app follows the same pattern: a full read replaces a list
 * wholesale, while local edits and realtime events patch that same list in
 * place. Those two race, and the read always wins, because it assigns last.
 *
 * The failure looks like this:
 *
 *   1. a read goes out; the server puts eight rows in an envelope
 *   2. before the envelope lands, you delete one — locally it goes at once,
 *      and the DELETE is on its way to the same server
 *   3. the envelope lands and overwrites local state with all eight rows
 *
 * The row is back on screen, deleted in the database and nowhere else. It stays
 * back until the next read, which is why it "fixes itself" on the next launch:
 * nothing was ever wrong with the data, only with which answer was believed.
 *
 * It bites hardest at launch because launch is when the most reads are in the
 * air at once — the boot read, then the one the app fires when it comes to the
 * foreground — so the window in which a tap can be undone is at its widest
 * exactly when you first start tapping.
 *
 * A Generation closes it. Anything that changes local state without going
 * through a read calls `bump()`. A read calls `mark()` before it asks and
 * `isStale()` before it assigns; if the number moved while it was waiting,
 * something newer already happened and the envelope is dropped.
 *
 * Dropping is the right call, not a compromise: local state at that moment is
 * the server's answer *plus* everything that has happened since, which is
 * strictly fresher than the answer on its own. Anything genuinely missed
 * arrives by realtime, and the next foreground read is a full re-sync anyway.
 */

export class Generation {
  #n = 0

  /** Something changed local state. Any read older than now is out of date. */
  bump(): void {
    this.#n += 1
  }

  /** Take a ticket before asking the server. */
  mark(): number {
    return this.#n
  }

  /** True if anything has changed since that ticket was taken. */
  isStale(marked: number): boolean {
    return this.#n !== marked
  }
}
