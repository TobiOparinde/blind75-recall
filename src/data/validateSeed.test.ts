import { describe, expect, it } from 'vitest';
import seed from './blind75.v1.json';
import { problems } from './index';
import { validateBlind75Seed, validateSeed } from './validateSeed';

describe('versioned Blind 75 seed', () => {
  it('loads exactly 75 unique, schema-valid problems in live list order', () => {
    expect(() => validateBlind75Seed(seed)).not.toThrow();
    expect(problems).toHaveLength(75);
    expect(new Set(problems.map((p) => p.lcNumber)).size).toBe(75);
    expect(problems.map((p) => p.order)).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
  });

  it('matches the independently recorded live membership and category counts', () => {
    const expected = [217,242,1,49,347,271,238,128,125,15,11,121,3,424,76,153,33,206,21,141,143,19,23,20,226,104,100,572,235,102,98,230,105,124,297,208,211,212,39,79,295,200,133,417,207,261,323,269,70,198,213,5,647,91,322,152,139,300,62,1143,53,55,57,56,435,252,253,191,338,190,268,371,48,54,73];
    expect(problems.map((p) => p.lcNumber)).toEqual(expected);
    const counts = Object.fromEntries([...new Set(problems.map((p) => p.category))]
      .map((category) => [category, problems.filter((p) => p.category === category).length]));
    expect(Object.values(counts)).toEqual([8,3,4,2,6,1,11,3,2,1,6,1,10,2,2,5,5,3]);
    expect(problems.filter((p) => p.premium).map((p) => p.lcNumber)).toEqual([271,261,323,269,252,253]);
    expect(problems.filter((p) => p.difficulty === 'easy')).toHaveLength(19);
    expect(problems.filter((p) => p.difficulty === 'medium')).toHaveLength(49);
    expect(problems.filter((p) => p.difficulty === 'hard')).toHaveLength(7);
  });

  it.each([
    ['id', 'lc-999'], ['lcNumber', 0], ['lcNumber', 1.5], ['title', ' '],
    ['slug', 'invalid slug'], ['difficulty', 'expert'], ['difficulty', null], ['difficulty', ['easy']],
    ['category', ''], ['lists', []], ['lists', ['blind75', 'blind75']],
    ['lists', [42]], ['lists', ['another-list']], ['order', 0], ['order', 1.5],
    ['premium', 'false'], ['leetcodeUrl', 'https://example.com/'],
    ['neetcodeUrl', 'javascript:alert(1)'], ['neetcodeUrl', 'https://neetcode.io.evil.test/'],
    ['neetcodeUrl', 'https://user:password@neetcode.io/'], ['insight', 3],
    ['timeComplexity', false], ['spaceComplexity', {}],
  ])('rejects malformed %s = %j', (field, value) => {
    const copy = structuredClone(seed);
    Object.assign(copy.problems[0]!, { [field]: value });
    expect(() => validateBlind75Seed(copy)).toThrow('Invalid problem seed');
  });

  it.each(['id', 'lcNumber', 'title', 'slug', 'difficulty', 'category', 'lists', 'order', 'premium', 'leetcodeUrl'])('rejects missing %s', (field) => {
    const copy = structuredClone(seed);
    Reflect.deleteProperty(copy.problems[0]!, field);
    expect(() => validateBlind75Seed(copy)).toThrow();
  });

  it('rejects missing, extra, duplicate and reordered problems', () => {
    for (const items of [seed.problems.slice(1), [...seed.problems, seed.problems[0]],
      [seed.problems[1], ...seed.problems.slice(1)], [...seed.problems].reverse()]) {
      expect(() => validateBlind75Seed({ ...seed, problems: items })).toThrow();
    }
  });

  it.each([null, [], {}, { ...seed, schemaVersion: 2 }, { ...seed, seedVersion: '' }, { ...seed, problems: null }])('rejects an invalid envelope', (value) => {
    expect(() => validateSeed(value)).toThrow();
  });

  it('allows optional enrichment and other lists without changing the Problem schema', () => {
    const problem = { ...seed.problems[0], lists: ['another-list'], insight: 'Example', timeComplexity: 'O(n)', spaceComplexity: 'O(n)' };
    Reflect.deleteProperty(problem, 'neetcodeUrl');
    expect(() => validateSeed({ ...seed, problems: [problem] })).not.toThrow();
  });
});
