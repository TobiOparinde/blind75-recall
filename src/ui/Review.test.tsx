// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useEffect, useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { problems } from '../data';
import { RecallDatabase } from '../storage/database';
import { ReviewRepository } from '../storage/reviewRepository';
import { ReviewController } from '../review/controller';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { newCard, NOW, reviewCard } from '../scheduler/testFixtures';
import { Review } from './Review';
import { Today } from './Today';

let serial = 0;
let database: RecallDatabase;
let repository: ReviewRepository;
let controller: ReviewController;
beforeEach(async () => {
  database = new RecallDatabase(`m4-component-${++serial}`);
  repository = new ReviewRepository(database, problems);
  await repository.initialize();
  controller = new ReviewController(repository, problems, () => NOW, () => 'UTC', () => 1000);
});
afterEach(async () => { cleanup(); database.close(); await database.delete(); });
function Harness() {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => controller.connect(), []);
  return <><input aria-label="Ordinary input" />{state.session ? <Review controller={controller} state={state} /> : <Today controller={controller} state={state} />}</>;
}
async function mount() {
  const view = render(<Harness />);
  await waitFor(() => expect(controller.getSnapshot().data).not.toBeNull());
  return view;
}

describe('Today and Review components', () => {
  it('links an empty deck to Library and shows a caught-up state for future cards', async () => {
    await mount();
    expect(screen.getByRole('link', { name: 'Open Library' }).getAttribute('href')).toBe('#library');
    await act(async () => { await repository.setCompleted(['lc-217'], true, NOW, 'UTC'); });
    await screen.findByText(/All caught up/);
    expect(screen.getByRole('button', { name: 'Review Contains Duplicate' })).toBeTruthy();
  });

  it('hides category and rating controls on the front, then reveals links and four previews', async () => {
    await database.cards.put(newCard({ problemId: 'lc-217' }));
    await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    expect(screen.getByRole('heading', { name: 'Contains Duplicate' })).toBeTruthy();
    expect(screen.queryByText('Arrays & Hashing')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open on LeetCode' }).getAttribute('target')).toBe('_blank');
    expect(screen.queryByRole('button', { name: /^Again/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByRole('link', { name: 'NeetCode' }).getAttribute('href')).toContain('neetcode.io');
    expect(screen.getByRole('link', { name: 'LeetCode' })).toBeTruthy();
    for (const rating of ['Again', 'Hard', 'Good', 'Easy']) expect(screen.getByRole('button', { name: new RegExp(`^${rating} `) })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Good 2d' })).toBeTruthy();
  });

  it('goal 1 displays Goal hit and Keep going without hiding remaining cards', async () => {
    await repository.saveSettings({ ...DEFAULT_SETTINGS, dailyGoal: 1 });
    await database.cards.bulkPut([newCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-49' })]);
    await mount();
    expect(document.querySelector('[data-queue-group="picks"]')?.querySelectorAll('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good 2d' }));
    await screen.findByText('Goal hit');
    await waitFor(() => expect(controller.getSnapshot().busy).toBe(false));
    expect(screen.getByText('1 / 1 ratings today')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good 2d' }));
    await waitFor(() => expect(controller.getSnapshot().data!.logs).toHaveLength(2));
  });

  it('uses Space/1–4 while leaving ordinary input and focused controls alone', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    const link = screen.getByRole('link', { name: 'Open on LeetCode' });
    fireEvent.keyDown(link, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Show answer' })).toBeTruthy();
    await userEvent.keyboard(' ');
    await screen.findByRole('button', { name: /^Good / });
    await userEvent.type(screen.getByRole('textbox', { name: 'Ordinary input' }), '1234 ');
    expect(controller.getSnapshot().data!.logs).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole('region', { name: 'Review session' }), { key: '3' });
    await waitFor(() => expect(controller.getSnapshot().data!.logs).toHaveLength(1));
  });

  it('a rerender preserves reveal, current card and its exact previews', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    const view = await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    const session = controller.getSnapshot().session;
    view.rerender(<Harness />);
    expect(controller.getSnapshot().session).toBe(session);
    expect(screen.getByRole('heading', { name: 'Contains Duplicate' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show answer' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Good / })).toBeTruthy();
  });
});
