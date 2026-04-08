import { describe, expect, it } from 'vitest';

import TablesComparator from '../src/scripts/tester/tables/comparator-tables';

describe('TablesComparator', () => {
  it('reports missing and extra rows and columns', () => {
    const comparator = new TablesComparator();

    const details = comparator.getComparisonDetails(
      [{
        columns: ['name', 'population'],
        values: [['Berlin', 1], ['Paris', 2]],
      }],
      [{
        columns: ['name', 'country'],
        values: [['Berlin', 1], ['Rome', 3]],
      }],
    );

    expect(details.missingColumns).toEqual(['population']);
    expect(details.extraColumns).toEqual(['country']);
    expect(details.missingRows).toEqual([['Paris', 2]]);
    expect(details.extraRows).toEqual([['Rome', 3]]);
    expect(details.identical).toBe(false);
  });
});