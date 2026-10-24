import type { Subscription } from 'dexie';
import type { Problem } from '../domain/problem';
import type { Card, IntervalPreviews, Rating, ReviewLog, SchedulerSettings } from '../domain/scheduler';
import { sameCard } from '../domain/membership';
import { intervalPreviews } from '../scheduler/schedule';
import { ReviewConflictError, ReviewRepository, type RatingCommand, type RatingUndo, type ReviewSnapshot } from '../storage/reviewRepository';
import { previewNeedsRefresh, sameValue, todayModel } from './model';

export interface CardSession {
  readonly kind: 'card'; readonly id: number; readonly card: Card;
  readonly settings: SchedulerSettings; readonly continuing: boolean; readonly started: number;
  readonly answer: { readonly now: number; readonly timeZone: string; readonly previews: IntervalPreviews } | null;
}
export type ReviewSession = CardSession | { readonly kind: 'waiting'; readonly continuing: boolean };
export interface ReviewState {
  readonly data: ReviewSnapshot | null; readonly now: number; readonly timeZone: string;
  readonly session: ReviewSession | null; readonly busy: boolean; readonly error: string | null;
  readonly notice: string | null; readonly undo: RatingUndo | null;
}

export class ReviewController {
  private state: ReviewState;
  private authoritative: ReviewSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private observation: Subscription | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private clients = 0;
  private generation = 0;
  private sessionId = 0;

  constructor(readonly repository: ReviewRepository, private readonly problems: readonly Problem[],
    private readonly clock: () => number = Date.now,
    private readonly zone: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    private readonly monotonic: () => number = () => performance.now()) {
    this.state = { data: null, now: clock(), timeZone: zone(), session: null, busy: false, error: null, notice: null, undo: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ReviewState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private cardSession(card: Card, settings: SchedulerSettings, continuing: boolean): CardSession {
    return { kind: 'card', id: ++this.sessionId, card, settings, continuing, started: this.monotonic(), answer: null };
  }
  private validSession(session: ReviewSession | null, data: ReviewSnapshot): ReviewSession | null {
    if (session?.kind !== 'card') return session;
    const card = data.cards.find((card) => card.problemId === session.card.problemId);
    return card && !card.archived && sameCard(card, session.card) && sameValue(data.settings, session.settings) ? session : null;
  }
  private accept(data: ReviewSnapshot) {
    if (this.authoritative && data.revision < this.authoritative.revision) return;
    this.authoritative = data;
    if (!this.state.busy) {
      const session = this.validSession(this.state.session, data);
      const stale = this.state.undo && this.state.undo.revision !== data.revision;
      this.update({ data, session, error: null,
        ...(stale ? { undo: null, notice: 'Deck changed. Undo is no longer available.' } : {}),
        ...(this.state.session?.kind === 'card' && !session ? { notice: 'This card changed. Open it again to continue.' } : {}),
      });
    }
  }
  private observe() {
    const generation = ++this.generation;
    this.observation?.unsubscribe();
    this.update({ error: null });
    void this.repository.initialize().then(() => {
      if (generation !== this.generation || !this.clients) return;
      this.observation = this.repository.observeReviews(
        (data) => { if (generation === this.generation) this.accept(data); },
        () => { if (generation === this.generation) this.update({ error: 'Your saved reviews could not be loaded. Retry to reconnect.' }); },
      );
    }).catch(() => { if (generation === this.generation) this.update({ error: 'Your saved reviews could not be loaded. Retry to reconnect.' }); });
  }
  connect = () => {
    if (++this.clients === 1) { this.observe(); this.timer = setInterval(this.tick, 1000); }
    return () => { if (--this.clients === 0) { this.generation++; this.observation?.unsubscribe(); clearInterval(this.timer); } };
  };
  retry = () => { if (this.clients) this.observe(); };
  tick = () => {
    const now = this.clock(); const timeZone = this.zone();
    let session = this.state.session;
    if (session?.kind === 'waiting' && this.state.data && !this.state.busy) {
      const next = todayModel(this.state.data.cards, this.state.data.logs, this.problems, now, this.state.data.settings, timeZone).ready[0];
      if (next) session = this.cardSession(next, this.state.data.settings, session.continuing);
    }
    this.update({ now, timeZone, session });
  };
  close = () => { if (!this.state.busy) this.update({ session: null }); };
  dismissNotice = () => this.update({ notice: null });
  start = (problemId?: string) => {
    const { data, busy, error } = this.state;
    if (!data || busy || error) return;
    const now = this.clock(); const timeZone = this.zone();
    const model = todayModel(data.cards, data.logs, this.problems, now, data.settings, timeZone);
    const card = problemId ? data.cards.find((card) => card.problemId === problemId && !card.archived) : model.ready[0];
    if (!card || !this.problems.some((problem) => problem.id === card.problemId)) return;
    this.update({ now, timeZone, session: this.cardSession(card, data.settings, model.goalHit), notice: null });
  };
  reveal = (refresh = false) => {
    const session = this.state.session;
    if (this.state.busy || this.state.error || session?.kind !== 'card' || (session.answer && !refresh)) return;
    const now = this.clock(); const timeZone = this.zone();
    this.update({ now, timeZone, session: { ...session, answer: { now, timeZone, previews: intervalPreviews(session.card, now, session.settings, timeZone) } } });
  };
  private nextSession(data: ReviewSnapshot, continuing: boolean): ReviewSession | null {
    const model = todayModel(data.cards, data.logs, this.problems, this.clock(), data.settings, this.zone());
    if (!continuing && model.goalHit) return null;
    const next = model.ready[0];
    return next ? this.cardSession(next, data.settings, continuing)
      : model.nextLearningDueAt !== null ? { kind: 'waiting', continuing } : null;
  }
  async rate(rating: Rating): Promise<void> {
    const { session, data, busy, error } = this.state;
    if (!data || busy || error || session?.kind !== 'card' || !session.answer) return;
    if (previewNeedsRefresh(session.answer, this.clock(), session.settings, this.zone())) {
      this.tick();
      this.update({ notice: 'Refresh intervals before rating this card.' });
      return;
    }
    const command: RatingCommand = { revision: data.revision, cardBefore: session.card, settings: session.settings,
      rating, now: session.answer.now, timeZone: session.answer.timeZone,
      preview: session.answer.previews[rating], durationMs: Math.max(0, Math.round(this.monotonic() - session.started)) };
    const next = command.preview.nextCard;
    const optimisticLog: ReviewLog = { id: -1, problemId: next.problemId, rating, ratedAt: command.now,
      stateBefore: session.card.state, intervalBefore: session.card.intervalDays, intervalAfter: next.intervalDays,
      easeBefore: session.card.ease, easeAfter: next.ease, early: command.preview.early, durationMs: command.durationMs, cardBefore: session.card };
    const optimistic: ReviewSnapshot = { ...data, cards: data.cards.map((card) => card.problemId === next.problemId ? next : card), logs: [...data.logs, optimisticLog] };
    this.update({ data: optimistic, busy: true, undo: null, notice: null, session: this.nextSession(optimistic, session.continuing) });
    try {
      const result = await this.repository.acceptRating(command);
      this.accept(result.snapshot);
      const current = this.authoritative!;
      this.update({ data: current, busy: false, undo: current.revision === result.undo.revision ? result.undo : null,
        session: this.validSession(this.state.session, current) });
    } catch (error) {
      try { this.accept(await this.repository.reviewSnapshot()); } catch { /* Keep the last confirmed snapshot. */ }
      this.update({ data: this.authoritative, busy: false, undo: null,
        session: this.authoritative ? this.validSession(session, this.authoritative) : null,
        error: error instanceof ReviewConflictError ? null : 'Rating could not be saved. Your confirmed progress is shown; retry to reconnect.',
        notice: error instanceof ReviewConflictError ? 'Deck changed. Open the card again before rating.' : null });
    }
  }
  async undo(): Promise<void> {
    const { undo, data, busy, error } = this.state;
    if (!undo || !data || busy || error) return;
    const log = data.logs.find((log) => log.id === undo.logId);
    if (!log) return;
    const optimistic = { ...data, cards: data.cards.map((card) => card.problemId === log.problemId ? log.cardBefore : card), logs: data.logs.filter((entry) => entry.id !== log.id) };
    const continuing = todayModel(optimistic.cards, optimistic.logs, this.problems, this.clock(), data.settings, this.zone()).goalHit;
    this.update({ data: optimistic, busy: true, undo: null, session: this.cardSession(log.cardBefore, data.settings, continuing), notice: null });
    try {
      this.accept(await this.repository.undoRating(undo));
      const current = this.authoritative!;
      this.update({ data: current, busy: false, session: this.validSession(this.state.session, current), notice: 'Rating undone.' });
    } catch (error) {
      try { this.accept(await this.repository.reviewSnapshot()); } catch { /* Keep confirmed progress. */ }
      const current = this.authoritative;
      const retryUndo = !(error instanceof ReviewConflictError) && current?.revision === undo.revision
        && current.logs.at(-1)?.id === undo.logId && sameCard(current.cards.find((card) => card.problemId === undo.cardAfter.problemId), undo.cardAfter) ? undo : null;
      this.update({ data: this.authoritative, busy: false, session: null,
        undo: retryUndo,
        error: error instanceof ReviewConflictError ? null : 'Undo could not be saved. Retry to reconnect.',
        notice: error instanceof ReviewConflictError ? 'Deck changed. Undo is no longer available.' : null });
    }
  }
}
