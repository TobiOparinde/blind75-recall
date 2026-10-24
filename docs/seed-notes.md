# Blind 75 seed verification

Verified on 24 October 2026 against the rendered [NeetCode Blind 75 list](https://neetcode.io/practice/practice/blind75), reached through the practice page's Blind 75 link. Expanded all 18 categories and read all 75 rows and their LeetCode/NeetCode solution links. The older `?tab=blind75` entry redirected to Core Skills, so it was not used as membership evidence.

## Differences from Appendix A

- **Combination Sum (39), Medium, Backtracking** replaces **Combination Sum IV (377), Medium, 1-D DP**. Backtracking has 2 entries; 1-D Dynamic Programming has 10. Total remains 75. The number/difficulty were cross-checked on [LeetCode's Combination Sum page](https://leetcode.com/problems/combination-sum/).
- Category order places Binary Search and Linked List before Stack, Backtracking before Heap / Priority Queue, and Bit Manipulation before Math & Geometry.
- Arrays & Hashing places Encode and Decode Strings before Product of Array Except Self and Longest Consecutive Sequence.
- Linked List places Linked List Cycle before Reorder List and Remove Nth Node From End of List.
- Category labels expand `1-D DP` / `2-D DP` to `1-D Dynamic Programming` / `2-D Dynamic Programming`.
- Title differences are preserved verbatim from the live list: `Best Time to Buy And Sell Stock`; `Find Minimum In Rotated Sorted Array`; `Search In Rotated Sorted Array`; `Merge K Sorted Lists`; `Lowest Common Ancestor of a Binary Search Tree`; `Kth Smallest Element In a Bst`; `Construct Binary Tree From Preorder And Inorder Traversal`; `Serialize And Deserialize Binary Tree`; `Implement Trie Prefix Tree`; `Design Add And Search Words Data Structure`; `Find Median From Data Stream`; `Number of Connected Components In An Undirected Graph`; `Non Overlapping Intervals`.
- No other membership or difficulty differences were found. Totals: 19 Easy, 49 Medium, 7 Hard. Premium flags remain the brief's six LeetCode Premium entries: 271, 261, 323, 269, 252, 253. NeetCode access does not imply free access on LeetCode.

## Representation

`src/data/blind75.v1.json` bundles the seed; no live fetch is required to start or work offline. The 75 `order` values follow category order and row order, numbered 1–75. Stable `lc-*` IDs use Appendix A's LeetCode numbers, except for the documented replacement 39. Each `leetcodeUrl` and `neetcodeUrl` was copied from the live row; NeetCode solution URLs are preferred over unverified guessed problem slugs. Optional insight and complexity fields are omitted for the links-only MVP.

Update the seed version and this audit note whenever content changes. Tests enforce schema, uniqueness, exact membership/order, category counts and difficulty totals; they do not fetch mutable external content during builds.
