import { describe, expect, it } from 'vitest';

import TablesComparator, { normalizeComparisonOptions } from '../src/scripts/tester/tables/comparator-tables';

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

describe('TablesComparator options', () => {
  const table = (columns, values) => [{ columns, values }];
  const comparator = new TablesComparator();

  it('ignores row order by default and compares rows as a multiset', () => {
    expect(comparator.getComparisonDetails(
      table(['a'], [['x'], ['y']]),
      table(['a'], [['y'], ['x']]),
    ).identical).toBe(true);

    // A duplicated learner row must not satisfy two different expected rows.
    expect(comparator.getComparisonDetails(
      table(['a'], [['x'], ['x'], ['y']]),
      table(['a'], [['x'], ['y'], ['y']]),
    ).identical).toBe(false);
  });

  it('requires the row order in strict mode', () => {
    const details = comparator.getComparisonDetails(
      table(['a'], [['x'], ['y']]),
      table(['a'], [['y'], ['x']]),
      { rowOrder: 'strict' },
    );

    expect(details.identical).toBe(false);
    expect(details.rowOrderMismatch).toBe(true);
    expect(details.missingRows).toEqual([]);

    expect(comparator.getComparisonDetails(
      table(['a'], [['x'], ['y']]),
      table(['a'], [['x'], ['y']]),
      { rowOrder: 'strict' },
    ).identical).toBe(true);
  });

  it('requires column names by default and can ignore them', () => {
    const expected = table(['name', 'pop'], [['Berlin', 1]]);
    const aliased = table(['stadt', 'einwohner'], [['Berlin', 1]]);

    expect(comparator.getComparisonDetails(expected, aliased).identical).toBe(false);
    expect(comparator.getComparisonDetails(
      expected,
      aliased,
      { columnComparison: 'ignoreNames' },
    ).identical).toBe(true);
    expect(comparator.getComparisonDetails(
      expected,
      table(['stadt'], [['Berlin']]),
      { columnComparison: 'ignoreNames' },
    ).identical).toBe(false);
  });

  it('accepts a different column order when only the order is ignored', () => {
    const expected = table(['name', 'pop'], [['Berlin', 1], ['Paris', 2]]);
    const swapped = table(['pop', 'name'], [[2, 'Paris'], [1, 'Berlin']]);

    expect(comparator.getComparisonDetails(expected, swapped).identical).toBe(false);

    const details = comparator.getComparisonDetails(
      expected,
      swapped,
      { columnComparison: 'ignoreOrder' },
    );
    expect(details.identical).toBe(true);
    expect(details.actualColMatches).toEqual([true, true]);

    expect(comparator.getComparisonDetails(
      expected,
      table(['pop', 'country'], [[2, 'x']]),
      { columnComparison: 'ignoreOrder' },
    ).missingColumns).toEqual(['name']);
  });

  it('can ignore letter case in names and values', () => {
    const expected = table(['Name'], [['Berlin']]);
    const actual = table(['name'], [['BERLIN']]);

    expect(comparator.getComparisonDetails(expected, actual).identical).toBe(false);
    expect(comparator.getComparisonDetails(expected, actual, { ignoreCase: true }).identical).toBe(true);
  });

  it('accepts numeric values within the configured tolerance', () => {
    const expected = table(['avg'], [[3.3333], ['text']]);
    const actual = table(['avg'], [[3.33], ['text']]);

    expect(comparator.getComparisonDetails(expected, actual).identical).toBe(false);
    expect(comparator.getComparisonDetails(expected, actual, { numericTolerance: 0.01 }).identical).toBe(true);
    expect(comparator.getComparisonDetails(expected, actual, { numericTolerance: 0.0001 }).identical).toBe(false);
  });

  it('sanitizes unknown option values', () => {
    expect(normalizeComparisonOptions({
      rowOrder: 'bogus', columnComparison: 'x', numericTolerance: -1, ignoreCase: 'yes',
    })).toEqual({
      rowOrder: 'ignore', columnComparison: 'exact', ignoreCase: false, numericTolerance: 0,
    });
  });

  it('treats two empty results as identical but not an empty and a filled one', () => {
    expect(comparator.getComparisonDetails([], []).identical).toBe(true);
    expect(comparator.getComparisonDetails([], table(['a'], [[1]])).identical).toBe(false);
    expect(comparator.getComparisonDetails(table(['a'], [[1]]), []).identical).toBe(false);
  });

  it('keeps the numeric tolerance pass correct when most rows match exactly', () => {
    const rows = Array.from({ length: 3000 }, (_, index) => [index, `n${index}`]);
    const actual = rows.map((row) => row.slice());
    actual[1500] = [1500.004, 'n1500'];

    const details = new TablesComparator().getComparisonDetails(
      table(['id', 'name'], rows),
      table(['id', 'name'], actual),
      { numericTolerance: 0.01 },
    );

    expect(details.identical).toBe(true);
    expect(new TablesComparator().getComparisonDetails(
      table(['id', 'name'], rows),
      table(['id', 'name'], actual),
    ).missingRows).toEqual([[1500, 'n1500']]);
  });
});
