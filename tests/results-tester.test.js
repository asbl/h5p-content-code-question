import { describe, expect, it } from 'vitest';

import TestResult from '../src/scripts/tester/components/results-tester.js';

describe('TestResult persistence helpers', () => {
  it('reports results, any-result and weights', () => {
    const results = new TestResult(3, [2, 5, 1]);
    expect(results.getResults()).toEqual([0, 0, 0]);
    expect(results.hasAnyResult()).toBe(false);

    results.setResult(0, true);
    results.setResult(2, false);

    expect(results.getResults()).toEqual([1, 0, 0]);
    expect(results.hasAnyResult()).toBe(true);
    expect(results.getScore()).toBe(2);
    expect(results.getMaxScore()).toBe(8);
  });

  it('restores only 0/1 flags within the test-case range', () => {
    const results = new TestResult(3, [1, 1, 1]);
    results.restoreResults([1, 0, 1, 1, 'x']);

    expect(results.getResults()).toEqual([1, 0, 1]);
    expect(results.getScore()).toBe(2);
  });

  it('ignores non-array input and out-of-range values when restoring', () => {
    const results = new TestResult(2, [1, 1]);
    results.setResult(1, true);

    results.restoreResults(null);
    results.restoreResults('nope');
    expect(results.getResults()).toEqual([0, 1]);

    // In-range entries apply; the out-of-range third entry is dropped.
    results.restoreResults([1, 0, 1]);
    expect(results.getResults()).toEqual([1, 0]);
  });

  it('reset clears restored results', () => {
    const results = new TestResult(2, [1, 1]);
    results.restoreResults([1, 1]);
    results.reset();

    expect(results.getResults()).toEqual([0, 0]);
    expect(results.hasAnyResult()).toBe(false);
  });
});
