import type { Problem, ProblemSeed } from '../domain/problem';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid problem seed: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validUrl(value: unknown, hostname: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname && !url.username && !url.password && !url.port;
  } catch { return false; }
}

function validateProblem(value: unknown): asserts value is Problem {
  invariant(isRecord(value), 'problem must be an object');
  invariant(positiveInteger(value.lcNumber), 'lcNumber must be a positive integer');
  invariant(value.id === `lc-${value.lcNumber}`, 'id must match lcNumber');
  invariant(nonempty(value.title), 'title is required');
  invariant(typeof value.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug), 'invalid slug');
  invariant(typeof value.difficulty === 'string' && ['easy', 'medium', 'hard'].includes(value.difficulty), 'invalid difficulty');
  invariant(nonempty(value.category), 'category is required');
  invariant(Array.isArray(value.lists) && value.lists.length > 0 && value.lists.every(nonempty), 'lists must contain nonempty strings');
  invariant(new Set(value.lists).size === value.lists.length, 'duplicate list membership');
  invariant(positiveInteger(value.order), 'order must be a positive integer');
  invariant(typeof value.premium === 'boolean', 'premium must be boolean');
  invariant(value.leetcodeUrl === `https://leetcode.com/problems/${value.slug}/`, 'LeetCode URL must match slug');
  invariant(value.neetcodeUrl === undefined || validUrl(value.neetcodeUrl, 'neetcode.io'), 'invalid NeetCode URL');
  for (const field of ['insight', 'timeComplexity', 'spaceComplexity']) {
    invariant(value[field] === undefined || typeof value[field] === 'string', `${field} must be a string`);
  }
}

// Generic schema validation: other problem lists can use the same data model.
export function validateSeed(value: unknown): asserts value is ProblemSeed {
  invariant(isRecord(value), 'seed must be an object');
  invariant(value.schemaVersion === 1, 'unsupported schemaVersion');
  invariant(nonempty(value.seedVersion), 'seedVersion is required');
  invariant(Array.isArray(value.problems), 'problems must be an array');
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const orders = new Set<number>();
  for (const problem of value.problems) {
    validateProblem(problem);
    invariant(!ids.has(problem.id), `duplicate id ${problem.id}`);
    invariant(!slugs.has(problem.slug), `duplicate slug ${problem.slug}`);
    invariant(!orders.has(problem.order), `duplicate order ${problem.order}`);
    ids.add(problem.id);
    slugs.add(problem.slug);
    orders.add(problem.order);
  }
}

export function validateBlind75Seed(value: unknown): asserts value is ProblemSeed {
  validateSeed(value);
  invariant(value.problems.length === 75, 'Blind 75 requires exactly 75 problems');
  value.problems.forEach((problem, index) => {
    invariant(problem.lists.includes('blind75'), 'missing Blind 75 membership');
    invariant(problem.order === index + 1, 'Blind 75 order must be contiguous and sorted');
  });
}
