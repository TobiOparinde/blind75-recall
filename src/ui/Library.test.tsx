// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { problems } from '../data';
import { LibraryController } from '../library/controller';
import { RecallDatabase } from '../storage/database';
import { LibraryRepository } from '../storage/libraryRepository';
import { historyFixture } from '../storage/testFixtures';
import { NOW } from '../scheduler/testFixtures';
import { Library } from './Library';

let serial = 0;
let database: RecallDatabase;
let repository: LibraryRepository;
let controller: LibraryController;

beforeAll(() => {
  // jsdom does not implement modal dialog methods; real-browser tests cover them.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(async () => {
  database = new RecallDatabase(`m3-component-${++serial}`);
  repository = new LibraryRepository(database, problems);
  controller = new LibraryController(repository, problems, () => NOW, () => 'UTC');
  await repository.initialize();
});
afterEach(async () => {
  cleanup();
  database.close();
  await database.delete();
});

const checkbox = (title = 'Contains Duplicate') => screen.getByRole('checkbox', { name: `Completed: ${title}` }) as HTMLInputElement;
async function mount() {
  const view = render(<Library controller={controller} now={NOW} timeZone="UTC" />);
  await waitFor(() => expect(checkbox().disabled).toBe(false));
  return view;
}

describe('Library component', () => {
  it('renders grouped problems, premium flags and accessible completion progress', async () => {
    await mount();
    expect(screen.getAllByRole('checkbox')).toHaveLength(75);
    expect(document.querySelectorAll('details')).toHaveLength(18);
    expect(screen.getAllByText('Premium')).toHaveLength(6);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText('Completed 0 / 75')).toBeTruthy();
    expect(document.querySelector('[data-problem-id="lc-217"]')?.textContent).toContain('#217');
  });

  it('ticks optimistically before storage completes, then offers one-level undo', async () => {
    await mount();
    const original = repository.setCompleted.bind(repository);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(repository, 'setCompleted').mockImplementationOnce(async (...args) => {
      await gate;
      return original(...args);
    });
    await userEvent.click(checkbox());
    expect(checkbox().checked).toBe(true);
    expect(checkbox().disabled).toBe(true);
    expect(screen.getByText('Completed 1 / 75')).toBeTruthy();
    expect(await database.cards.count()).toBe(0);
    await act(async () => { release(); });
    await waitFor(() => expect(checkbox().disabled).toBe(false));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(checkbox().checked).toBe(false));
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect((await database.cards.get('lc-217'))?.archived).toBe(true);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('requires confirmation, supports cancel, archives and restores without losing history', async () => {
    const { card, log } = historyFixture();
    await database.cards.put(card);
    await database.reviewLogs.add(log);
    const history = await repository.reviewHistory(card.problemId);
    await mount();
    await userEvent.click(checkbox());
    const dialog = screen.getByRole('dialog', { name: 'Remove from deck?' });
    expect(checkbox().checked).toBe(true);
    expect((await database.cards.get(card.problemId))?.archived).toBe(false);
    expect(within(dialog).getByText(/History is kept/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(checkbox().checked).toBe(true);
    expect(document.activeElement).toBe(checkbox());
    await userEvent.click(checkbox());
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(checkbox().checked).toBe(false);
    expect(await repository.reviewHistory(card.problemId)).toEqual(history);
    expect(await database.cards.get(card.problemId)).toEqual({ ...card, archived: true });
    await userEvent.click(checkbox());
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(await database.cards.get(card.problemId)).toEqual(card);
    expect(await repository.reviewHistory(card.problemId)).toEqual(history);
  });

  it('dismisses the removal confirmation through its cancel event', async () => {
    await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    await mount();
    await userEvent.click(checkbox());
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(checkbox().checked).toBe(true);
  });

  it('combines completion/difficulty filters and leaves global progress intact', async () => {
    await repository.setCompleted(['lc-217', 'lc-49', 'lc-76'], true, NOW, 'UTC');
    await mount();
    const completion = within(screen.getByRole('group', { name: 'Completion' }));
    const difficulty = within(screen.getByRole('group', { name: 'Difficulty' }));
    await userEvent.click(completion.getByRole('button', { name: 'Completed' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    await userEvent.click(difficulty.getByRole('button', { name: 'Easy' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(checkbox().checked).toBe(true);
    expect(screen.getByText('Completed 3 / 75')).toBeTruthy();
    await userEvent.click(completion.getByRole('button', { name: 'Remaining' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(18);
    expect(screen.queryByRole('checkbox', { name: 'Completed: Contains Duplicate' })).toBeNull();
  });

  it('marks a full category atomically and can undo just that bulk addition', async () => {
    await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all 8 problems in Arrays & Hashing' }));
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(screen.getByText('Completed 8 / 75')).toBeTruthy();
    expect((await repository.snapshot()).cards.filter((card) => !card.archived)).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(screen.getByText('Completed 0 / 75')).toBeTruthy();
    expect((await repository.snapshot()).cards.every((card) => card.archived)).toBe(true);
  });

  it('rolls back failed optimistic writes and lets the user reconnect', async () => {
    await mount();
    vi.spyOn(repository, 'setCompleted').mockRejectedValueOnce(new Error('Simulated unavailable storage'));
    await userEvent.click(checkbox());
    await screen.findByRole('alert');
    expect(checkbox().checked).toBe(false);
    expect(screen.getByText('Completed 0 / 75')).toBeTruthy();
    expect(await database.cards.count()).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(checkbox().disabled).toBe(false));
    await userEvent.click(checkbox());
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(checkbox().checked).toBe(true);
  });

  it('shows load failures without presenting an editable empty replacement deck', async () => {
    const { card } = historyFixture();
    await database.cards.put(card);
    vi.spyOn(repository, 'initialize').mockRejectedValueOnce(new Error('Load failure'));
    render(<Library controller={controller} now={NOW} timeZone="UTC" />);
    await screen.findByRole('alert');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(await database.cards.count()).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(checkbox().checked).toBe(true));
    expect(screen.getByText('Completed 1 / 75')).toBeTruthy();
  });
});
