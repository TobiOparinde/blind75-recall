// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { newCard, NOW } from '../scheduler/testFixtures';
import { RecallDatabase } from '../storage/database';
import { ManagementRepository } from '../storage/managementRepository';
import { ManagementController } from '../management/controller';
import { Settings } from './Settings';
import { Stats } from './Stats';
let serial = 0; let db: RecallDatabase; let repo: ManagementRepository; let controller: ManagementController;
beforeEach(async () => { db = new RecallDatabase(`m5-ui-${++serial}`); repo = new ManagementRepository(db, problems); await repo.initialize(); controller = new ManagementController(repo, new Set(problems.map((problem) => problem.id))); });
afterEach(async () => { cleanup(); db.close(); await db.delete(); });
it('renders stats, forecast labels and empty history without a chart dependency', async () => {
  await db.cards.put(newCard()); render(<Stats data={await repo.reviewSnapshot()} now={NOW} timeZone="UTC" />);
  expect(screen.getByRole('heading', { name: 'Stats' })).toBeTruthy(); expect(screen.getByLabelText('Today: 1 cards')).toBeTruthy(); expect(screen.getByText('No reviews yet')).toBeTruthy(); expect(screen.getByText('No leeches.')).toBeTruthy();
});
it('saves the form and retains unsaved input on ordinary rerenders', async () => {
  const data = await repo.reviewSnapshot(); const view = render(<Settings controller={controller} data={data} />);
  const goal = screen.getByLabelText('Daily goal') as HTMLInputElement; fireEvent.change(goal, { target: { value: '1' } });
  view.rerender(<Settings controller={controller} data={{ ...data }} />); expect(goal.value).toBe('1');
  fireEvent.submit(screen.getByRole('button', { name: 'Save settings' }).closest('form')!);
  await waitFor(() => expect(screen.getByText(/Settings saved/)).toBeTruthy()); expect((await repo.reviewSnapshot()).settings.dailyGoal).toBe(1);
});
it('shows invalid step feedback without writing', async () => {
  render(<Settings controller={controller} data={await repo.reviewSnapshot()} />);
  fireEvent.change(screen.getByLabelText('Learning steps (minutes)'), { target: { value: '1,' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save settings' }).closest('form')!);
  expect(screen.getByRole('alert').textContent).toContain('positive step'); expect((await repo.reviewSnapshot()).settings).toEqual(DEFAULT_SETTINGS);
});
it('shows both reset confirmations, preserves data until final acceptance and exposes install help', async () => {
  await db.cards.put(newCard()); render(<Settings controller={controller} data={await repo.reviewSnapshot()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset user data' })); expect(screen.getByRole('group', { name: 'Reset confirmation 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue reset' })); expect((await repo.reviewSnapshot()).cards).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Permanently reset' }));
  await waitFor(() => expect(screen.getByText(/All user data reset/)).toBeTruthy()); expect((await repo.reviewSnapshot()).cards).toHaveLength(0);
  expect(screen.getByRole('heading', { name: 'Add to Home Screen' })).toBeTruthy();
});
