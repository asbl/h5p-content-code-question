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
});
