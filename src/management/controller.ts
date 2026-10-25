import type { SchedulerSettings } from '../domain/scheduler';
import type { ManagementRepository } from '../storage/managementRepository';
import { exportBackup, parseBackup, type Backup } from './backup';
import { validateScheduleRange } from './validateScheduleRange';

interface State {
  readonly backupDue: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly notice: string | null;
  readonly preview: { readonly backup: Backup; readonly revision: number } | null;
  readonly resetRevision: number | null;
  readonly resetStage: 0 | 1 | 2;
}
export class ManagementController {
  private state: State = { backupDue: false, busy: false, error: null, notice: null, preview: null, resetRevision: null, resetStage: 0 };
  private readonly listeners = new Set<() => void>();
  constructor(private readonly repository: ManagementRepository, private readonly ids: ReadonlySet<string>, private readonly clock: () => number = Date.now,
    private readonly zone: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone) {}
  getSnapshot = () => this.state;
  clearFeedback = () => { if (!this.state.busy) this.update({ error: null, notice: null }); };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private async run<T>(action: () => Promise<T>, notice: string): Promise<T | undefined> {
    if (this.state.busy) return;
    this.update({ busy: true, error: null, notice: null });
    try { const result = await action(); this.update({ notice, preview: null, resetStage: 0, resetRevision: null }); return result; }
    catch (error) { this.update({ error: error instanceof Error ? error.message : 'Could not save changes. Try again.' }); }
    finally { this.update({ busy: false }); }
  }
  save = (settings: SchedulerSettings, revision: number) => this.run(() => this.repository.saveConfiguration(settings, revision, this.clock(), this.zone()), 'Settings saved. Existing deadlines are unchanged.');
  checkReminder = async () => {
    try { this.update({ backupDue: await this.repository.backupReminder(this.clock()) }); }
    catch { /* A reminder failure must not hide the deck or block recovery/export. */ }
  };
  export = () => this.run(async () => {
    const text = exportBackup(await this.repository.reviewSnapshot());
    try { await this.repository.backupReminder(this.clock(), true); this.update({ backupDue: false }); }
    catch { /* Export must remain possible even if housekeeping cannot be written. */ }
    return text;
  }, 'Backup ready. Keep it somewhere safe.');
  prepareImport = async (source: string | (() => Promise<string>)) => {
    if (this.state.busy) return;
    this.update({ busy: true, preview: null, error: null, notice: null, resetStage: 0 });
    try {
      const text = typeof source === 'string' ? source : await source();
      const backup = parseBackup(text, this.ids);
      validateScheduleRange(backup.settings, this.clock(), this.zone());
      const current = await this.repository.reviewSnapshot();
      this.update({ preview: { backup: structuredClone(backup), revision: current.revision } });
    } catch (error) { this.update({ error: error instanceof Error ? error.message : 'Invalid backup' }); }
    finally { this.update({ busy: false }); }
  };
  confirmImport = () => {
    const preview = this.state.preview;
    if (preview) return this.run(() => this.repository.replaceBackup(preview.backup, preview.revision, this.ids, this.clock(), this.zone()), 'Backup imported. Deck and schedule restored.');
  };
  beginReset = (revision: number) => { if (!this.state.busy) this.update({ resetStage: 1, resetRevision: revision, preview: null, error: null, notice: null }); };
  confirmReset = () => {
    if (this.state.busy) return;
    if (this.state.resetStage === 1) this.update({ resetStage: 2 });
    else if (this.state.resetStage === 2 && this.state.resetRevision !== null) {
      const revision = this.state.resetRevision;
      return this.run(async () => { const result = await this.repository.reset(revision, this.ids); this.update({ backupDue: false }); return result; }, 'All user data reset. Your Library is ready.');
    }
  };
  cancel = () => { if (!this.state.busy) this.update({ preview: null, resetStage: 0, resetRevision: null, error: null }); };
}
