import type { Problem } from './problem';

export type Rating = 1 | 2 | 3 | 4;
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface CardFields {
  readonly problemId: string;
  readonly ease: number;
  readonly intervalDays: number;
  readonly dueDay: number;
  readonly stepIndex: number;
  readonly reps: number;
  readonly lapses: number;
  readonly lastReviewedAt?: number;
  readonly notes?: string;
  readonly addedAt: number;
  readonly archived: boolean;
}

export interface NewCard extends CardFields {
  readonly state: 'new';
  readonly intervalDays: 0;
  readonly stepIndex: 0;
  readonly dueAt?: never;
  readonly lastReviewedAt?: never;
}

export interface LearningCard extends CardFields {
  readonly state: 'learning';
  readonly intervalDays: 0;
  readonly dueAt: number;
  readonly lastReviewedAt: number;
}

export interface ReviewCard extends CardFields {
  readonly state: 'review';
  readonly stepIndex: 0;
  readonly dueAt?: never;
  readonly lastReviewedAt: number;
}

export interface RelearningCard extends CardFields {
  readonly state: 'relearning';
  readonly dueAt: number;
  readonly lastReviewedAt: number;
}

export type Card = NewCard | LearningCard | ReviewCard | RelearningCard;

/** Step durations and learn-ahead are milliseconds; interval values are calendar days. */
export interface SchedulerSettings {
  readonly dailyGoal: number;
  readonly rolloverHour: number;
  readonly firstReview: 'today' | 'tomorrow';
  readonly learningSteps: readonly number[];
  readonly relearningSteps: readonly number[];
  readonly graduatingIntervalDays: number;
  readonly easyIntervalDays: number;
  readonly maxIntervalDays: number;
  readonly startingEase: Readonly<Record<Problem['difficulty'], number>>;
  readonly minEase: number;
  readonly hardMultiplier: number;
  readonly easyBonus: number;
  readonly intervalModifier: number;
  readonly lapseMultiplier: number;
  readonly againEasePenalty: number;
  readonly hardEasePenalty: number;
  readonly easyEaseBonus: number;
  readonly leechThreshold: number;
  readonly fuzzFraction: number;
  readonly fuzzMinDays: number;
  readonly fuzzThresholdDays: number;
  readonly learnAheadMs: number;
}

export interface ScheduleResult {
  readonly nextCard: Card;
  readonly early: boolean;
}

export type IntervalPreviews = Readonly<Record<Rating, ScheduleResult>>;

export interface QueueResult {
  readonly ready: readonly Card[];
  readonly picks: readonly Card[];
  readonly upNext: readonly Card[];
  readonly learnAheadCandidates: readonly (LearningCard | RelearningCard)[];
  readonly nextLearningDueAt: number | null;
}

/** Commit card + log atomically in M3/M4. Undo is the sole append-only exception. */
export interface ReviewLog {
  readonly id: number;
  readonly problemId: string;
  readonly ratedAt: number;
  readonly rating: Rating;
  readonly stateBefore: CardState;
  readonly intervalBefore: number;
  readonly intervalAfter: number;
  readonly easeBefore: number;
  readonly easeAfter: number;
  readonly durationMs: number;
  readonly early: boolean;
  readonly cardBefore: Card;
}

/** One session token; later mutations invalidate it. No persistence/undo effects in M2. */
export interface UndoToken {
  readonly logId: ReviewLog['id'];
  readonly cardAfter: Card;
}
