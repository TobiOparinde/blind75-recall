import { liveQuery } from 'dexie';
import type { Card, Rating, ReviewLog, ScheduleResult, SchedulerSettings, UndoToken } from '../domain/scheduler';
import { sameCard } from '../domain/membership';
import { schedule } from '../scheduler/schedule';
import { sameValue } from '../review/model';
import { LibraryRepository, type LibrarySnapshot } from './libraryRepository';

export interface ReviewSnapshot extends LibrarySnapshot { readonly logs: readonly ReviewLog[] }
export interface RatingCommand {
  readonly revision: number;
  readonly cardBefore: Card;
  readonly settings: SchedulerSettings;
  readonly rating: Rating;
  readonly now: number;
  readonly timeZone: string;
  readonly preview: ScheduleResult;
  readonly durationMs: number;
}
export interface RatingUndo extends UndoToken { readonly revision: number }
export class ReviewConflictError extends Error {
  constructor() { super('The deck changed. Reopen the card before rating or undoing.'); }
}

export class ReviewRepository extends LibraryRepository {
  private get stores() { return [this.database.cards, this.database.settings, this.database.metadata, this.database.reviewLogs]; }
  private async readReviewCurrent(): Promise<ReviewSnapshot> {
    const [snapshot, logs] = await Promise.all([this.readCurrent(), this.database.reviewLogs.orderBy('id').toArray()]);
    return { ...snapshot, logs };
  }
  async reviewSnapshot(): Promise<ReviewSnapshot> {
    await this.initialize();
    return this.database.transaction('r', this.stores, () => this.readReviewCurrent());
  }
  observeReviews(next: (snapshot: ReviewSnapshot) => void, error: (error: unknown) => void) {
    return liveQuery(() => this.database.transaction('r', this.stores, () => this.readReviewCurrent())).subscribe({ next, error });
  }
  async acceptRating(command: RatingCommand): Promise<{ snapshot: ReviewSnapshot; undo: RatingUndo }> {
    await this.initialize();
    if (!Number.isSafeInteger(command.durationMs) || command.durationMs < 0) throw new RangeError('Invalid rating duration');
    return this.database.transaction('rw', this.stores, async () => {
      const current = await this.readReviewCurrent();
      const card = current.cards.find((card) => card.problemId === command.cardBefore.problemId);
      if (current.revision !== command.revision || !card || card.archived || !sameCard(card, command.cardBefore)
        || !sameValue(current.settings, command.settings)) throw new ReviewConflictError();
      const canonical = schedule(card, command.rating, command.now, current.settings, command.timeZone);
      if (!sameValue(canonical, command.preview)) throw new ReviewConflictError();
      const next = structuredClone(command.preview.nextCard);
      await this.database.cards.put(next);
      const logId = await this.database.reviewLogs.add({
        problemId: card.problemId, ratedAt: command.now, rating: command.rating,
        stateBefore: card.state, intervalBefore: card.intervalDays, intervalAfter: next.intervalDays,
        easeBefore: card.ease, easeAfter: next.ease, durationMs: command.durationMs,
        early: command.preview.early, cardBefore: structuredClone(card),
      });
      const revision = await this.advanceRevision();
      return { snapshot: await this.readReviewCurrent(), undo: { logId, cardAfter: next, revision } };
    });
  }
  async undoRating(token: RatingUndo): Promise<ReviewSnapshot> {
    await this.initialize();
    return this.database.transaction('rw', this.stores, async () => {
      const current = await this.readReviewCurrent();
      const log = current.logs.at(-1);
      const card = current.cards.find((card) => card.problemId === token.cardAfter.problemId);
      if (current.revision !== token.revision || !log || log.id !== token.logId || log.problemId !== card?.problemId
        || log.cardBefore.problemId !== log.problemId || log.cardBefore.archived
        || !sameCard(card, token.cardAfter)) throw new ReviewConflictError();
      await this.database.cards.put(structuredClone(log.cardBefore));
      await this.database.reviewLogs.delete(log.id);
      await this.advanceRevision();
      return this.readReviewCurrent();
    });
  }
}
