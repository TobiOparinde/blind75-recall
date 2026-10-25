import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ManagementController } from '../management/controller';
import { numericSettings, settingsFromForm } from '../management/settings';
import type { ReviewSnapshot } from '../storage/reviewRepository';

export const Settings = memo(function Settings({ controller, data }: { controller: ManagementController; data: ReviewSnapshot | null }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [formError, setFormError] = useState<string | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const formFeedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error || state.notice) feedback.current?.focus(); }, [state.error, state.notice]);
  useEffect(() => { if (formError) formFeedback.current?.focus(); }, [formError]);
  if (!data) return <p role="status">Loading settings…</p>;
  const settings = data.settings;
  const download = async () => {
    const text = await controller.export();
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'blind75-recall-backup.json';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="utility-screen settings-screen" aria-labelledby="settings-title"><h2 id="settings-title" tabIndex={-1}>Settings</h2>
    {state.error && <p ref={feedback} tabIndex={-1} role="alert">{state.error}</p>}{state.notice && <p ref={feedback} tabIndex={-1} role="status">{state.notice}</p>}
    <form key={JSON.stringify(settings)} onSubmit={(event) => {
      event.preventDefault(); setFormError(null); controller.clearFeedback();
      try { void controller.save(settingsFromForm(new FormData(event.currentTarget), settings), data.revision); }
      catch (error) { setFormError(error instanceof Error ? error.message : 'Invalid settings'); }
    }}><fieldset disabled={state.busy}><legend>Schedule</legend>
      {numericSettings.map(([key, label, min, max]) => <label key={key}>{label}<input name={key} type="number" min={min} max={max} step="1" required defaultValue={settings[key]} /></label>)}
      <label htmlFor="first-review">First review</label><select id="first-review" name="firstReview" defaultValue={settings.firstReview}><option value="tomorrow">Tomorrow</option><option value="today">Today</option></select>
      <label>Learning steps (minutes)<input name="learningSteps" required defaultValue={settings.learningSteps.map((step) => step / 60_000).join(', ')} /></label>
      <label>Relearning steps (minutes)<input name="relearningSteps" required defaultValue={settings.relearningSteps.map((step) => step / 60_000).join(', ')} /></label>
      <p>Separate steps with commas, for example 1, 10. Existing deadlines stay unchanged. A cap below a stored interval or steps that exclude an existing step index cannot be saved. First-review timing applies to new ticks only.</p>
      {formError && <p ref={formFeedback} tabIndex={-1} role="alert">{formError}</p>}<button type="submit">Save settings</button>
    </fieldset></form>
    <section className="settings-card"><h3>Backup and restore</h3><p>Storage can be evicted by iOS. Export a backup regularly, ideally every 30 days. Keep the file outside this app.</p>
      <button type="button" disabled={state.busy} onClick={() => { void download(); }}>Export JSON</button>
      <label>Import JSON<input type="file" accept=".json,application/json" disabled={state.busy} onChange={(event) => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void controller.prepareImport(() => file.text());
      }} /></label>
      {state.preview && <div role="group" aria-label="Import preview"><p>{state.preview.backup.cards.length} cards ({state.preview.backup.cards.filter((card) => !card.archived).length} active), {state.preview.backup.reviewLogs.length} review logs, 1 settings record.</p><p>This replaces all current cards, history and settings.</p>
        <button type="button" disabled={state.busy} onClick={() => { void controller.confirmImport(); }}>Confirm overwrite</button><button type="button" disabled={state.busy} onClick={controller.cancel}>Cancel import</button></div>}
    </section>
    <section className="settings-card"><h3>Reset</h3><p>Clear your deck, all history and settings. The bundled Library stays available.</p>
      {state.resetStage === 0 ? <button type="button" disabled={state.busy} onClick={() => controller.beginReset(data.revision)}>Reset user data</button>
        : <div role="group" aria-label={`Reset confirmation ${state.resetStage}`}><p>{state.resetStage === 1 ? 'Reset all user data? Export first if you want to keep your history.' : 'Final confirmation: permanently clear your deck, history and settings?'}</p>
          <button type="button" disabled={state.busy} onClick={controller.cancel}>Cancel reset</button><button type="button" disabled={state.busy} onClick={() => { void controller.confirmReset(); }}>{state.resetStage === 1 ? 'Continue reset' : 'Permanently reset'}</button></div>}
    </section>
    <section className="settings-card"><h3>Add to Home Screen</h3><p>On iPhone, open this app in Safari. Tap Share, then Add to Home Screen and Add. Launch Recall from its icon for the standalone app. After the first load, the app and backups work offline.</p></section>
  </section>;
});
