import { describe, expect, it } from 'vitest';

import { IOComparator } from '../src/scripts/tester/io/comparator-io.js';

describe('IOComparator', () => {
  it('matches HTML-encoded expected output against decoded runtime output', () => {
    const comparator = new IOComparator();

    const passed = comparator.compare(
      0,
      { outputs: ['[&#039;Gold&#039;, &#039;Diamant&#039;]'] },
      ["['Gold', 'Diamant']"],
    );

    expect(passed).toBe(true);
  });

  it('matches encoded actual output against plain expected output', () => {
    const comparator = new IOComparator();

    const passed = comparator.compare(
      0,
      { outputs: ['print("ok")'] },
      ['print(&quot;ok&quot;)'],
    );

    expect(passed).toBe(true);
  });

  it('reports a line-count mismatch reason when there is more output than expected', () => {
    // Regression test: a stray/blank extra print() line used to fail the
    // comparison via a bare length check with zero diagnostic information,
    // even though the visible/expected lines matched exactly.
    const comparator = new IOComparator();

    const passed = comparator.compare(
      0,
      { outputs: ['Robotik', '2'] },
      ['Robotik', '', '2'],
    );

    expect(passed).toBe(false);
    expect(comparator.getLastMismatchReason()).toEqual({
      type: 'lineCountMismatch',
      expectedCount: 2,
      actualCount: 3,
    });
  });

  it('reports which line differs on a content mismatch', () => {
    const comparator = new IOComparator();

    const passed = comparator.compare(
      0,
      { outputs: ['Robotik', '2'] },
      ['Robotik', '3'],
    );

    expect(passed).toBe(false);
    expect(comparator.getLastMismatchReason()).toEqual({
      type: 'lineContentMismatch',
      line: 2,
      expectedValue: '2',
      actualValue: '3',
    });
  });

  it('clears the mismatch reason once a later comparison passes', () => {
    const comparator = new IOComparator();

    comparator.compare(0, { outputs: ['a'] }, ['b']);
    expect(comparator.getLastMismatchReason()).not.toBeNull();

    const passed = comparator.compare(0, { outputs: ['a'] }, ['a']);

    expect(passed).toBe(true);
    expect(comparator.getLastMismatchReason()).toBeNull();
  });
});
