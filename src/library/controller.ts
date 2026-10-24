import type { Subscription } from 'dexie';
import type { Problem } from '../domain/problem';
import { changeMembership } from '../domain/membership';
import { LibraryRepository, MembershipConflictError, type LibrarySnapshot, type MembershipUndo } from '../storage/libraryRepository';

export interface LibraryState {
  readonly data: LibrarySnapshot | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly notice: string | null;
  readonly undo: MembershipUndo | null;
}

/** Framework-independent optimistic state; storage and calendar contexts are injected. */
export class LibraryController {
  private state: LibraryState = { data: null, busy: false, error: null, notice: null, undo: null };
  private authoritative: LibrarySnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private observation: Subscription | undefined;
  private clients = 0;
  private generation = 0;

  constructor(readonly repository: LibraryRepository, private readonly problems: readonly Problem[],
    private readonly clock: () => number = Date.now,
    private readonly timeZone: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<LibraryState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private accept(snapshot: LibrarySnapshot) {
    if (this.authoritative && snapshot.revision < this.authoritative.revision) return;
    this.authoritative = snapshot;
    if (!this.state.busy) {
      const staleUndo = this.state.undo && this.state.undo.revision !== snapshot.revision;
      this.update({ data: snapshot, error: null, ...(staleUndo ? { undo: null, notice: 'Library changed. Undo is no longer available.' } : {}) });
    }
  }

  private observe() {
    const generation = ++this.generation;
    this.observation?.unsubscribe();
    this.update({ error: null });
    void this.repository.initialize().then(() => {
      if (generation !== this.generation || this.clients === 0) return;
      this.observation = this.repository.observe(
        (snapshot) => { if (generation === this.generation) this.accept(snapshot); },
        () => { if (generation === this.generation) this.update({ error: 'Your saved library could not be loaded. Retry to reconnect.' }); },
      );
    }).catch(() => {
      if (generation === this.generation) this.update({ error: 'Your saved library could not be loaded. Retry to reconnect.' });
    });
  }

  connect = () => {
    this.clients++;
    if (this.clients === 1) this.observe();
    return () => {
      if (--this.clients === 0) { this.generation++; this.observation?.unsubscribe(); }
    };
  };

  retry = () => { if (this.clients > 0) this.observe(); };
  dismissNotice = () => this.update({ notice: null, undo: null });

  async setCompleted(ids: readonly string[], completed: boolean): Promise<void> {
    const data = this.state.data;
    if (!data || this.state.busy || this.state.error) return;
    const now = this.clock();
    const timeZone = this.timeZone();
    const chosen = this.problems.filter((problem) => ids.includes(problem.id));
    const optimistic = new Map(data.cards.map((card) => [card.problemId, card]));
    for (const problem of chosen) {
      const card = changeMembership(problem, optimistic.get(problem.id), completed, now, data.settings, timeZone);
      if (card) optimistic.set(problem.id, card);
    }
    this.update({ data: { ...data, cards: [...optimistic.values()] }, busy: true, error: null, notice: null, undo: null });
    try {
      const result = await this.repository.setCompleted(ids, completed, now, timeZone);
      this.accept(result.snapshot);
      const title = result.changedCount === 1 && chosen.length === 1 ? chosen[0]!.title : `${result.changedCount} problems`;
      this.update({ data: this.authoritative, busy: false,
        undo: result.undo?.revision === this.authoritative?.revision ? result.undo : null,
        notice: result.changedCount === 0 ? 'Your library is already up to date.'
          : completed ? `Added ${title}.` : `Removed ${title}. History is kept.`,
      });
    } catch {
      try { this.accept(await this.repository.snapshot()); } catch { /* Preserve the last confirmed snapshot. */ }
      this.update({ data: this.authoritative, busy: false, error: 'Changes could not be saved. Your saved deck is shown; retry to reconnect.' });
    }
  }

  async undo(): Promise<void> {
    const token = this.state.undo;
    if (!token || this.state.busy || this.state.error) return;
    this.update({ busy: true, undo: null });
    try {
      this.accept(await this.repository.undoMembership(token));
      this.update({ data: this.authoritative, busy: false, notice: 'Change undone.' });
    } catch (error) {
      try { this.accept(await this.repository.snapshot()); } catch { /* Preserve confirmed data on a read failure. */ }
      this.update({ data: this.authoritative, busy: false,
        notice: error instanceof MembershipConflictError ? 'Library changed. Undo is no longer available.' : null,
        error: error instanceof MembershipConflictError ? null : 'Undo could not be saved. Retry to reconnect.',
      });
    }
  }
}
