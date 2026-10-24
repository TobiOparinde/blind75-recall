import seed from './blind75.v1.json';
import { validateBlind75Seed } from './validateSeed';
import type { Problem } from '../domain/problem';

validateBlind75Seed(seed);
export const problems: readonly Problem[] = seed.problems;
export const seedVersion = seed.seedVersion;
