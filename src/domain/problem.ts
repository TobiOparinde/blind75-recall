export interface Problem {
  readonly id: string;
  readonly lcNumber: number;
  readonly title: string;
  readonly slug: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly category: string;
  readonly lists: readonly string[];
  readonly order: number;
  readonly premium: boolean;
  readonly insight?: string;
  readonly timeComplexity?: string;
  readonly spaceComplexity?: string;
  readonly leetcodeUrl: string;
  readonly neetcodeUrl?: string;
}

export interface ProblemSeed {
  readonly schemaVersion: 1;
  readonly seedVersion: string;
  readonly problems: readonly Problem[];
}
