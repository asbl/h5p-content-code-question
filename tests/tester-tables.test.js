import { describe, expect, it, vi } from 'vitest';

import TablesTester from '../src/scripts/tester/tables/tester-tables';

const table = (columns, values) => [{ columns, values }];

function createTester(testcases, options = {}) {
  const tester = new TablesTester(
    testcases,
    'bySolution',
    vi.fn(),
    () => ({}),
    {},
    null,
    false,
    'SELECT 1',
    '',
    {},
    {},
    options,
  );
  document.body.innerHTML = '<div id="fixture"></div>';
  document.getElementById('fixture').appendChild(tester.view.getDOM());
  return tester;
}

async function runCase(tester, expected, actual) {
  tester.setTargetTable(expected);
  tester.addOutput(actual);
  await tester.evaluateTestCase();
}

describe('TablesTester', () => {
  it('evaluates exactly one comparison when no test cases are authored', async () => {
    const tester = createTester([]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));

    expect(tester.session.countTestCases()).toBe(1);
    expect(tester.getScore()).toBe(1);
    expect(tester.results.getMaxScore()).toBe(1);
  });

  it('fails when the learner result differs', async () => {
    const tester = createTester([{}]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[2]]));

    expect(tester.getScore()).toBe(0);
    expect(tester.getFirstFailure()).toMatchObject({ type: 'tableMismatch', testIndex: 0 });
  });

  it('applies comparison options from the tester options', async () => {
    const strict = createTester([{}], { comparison: { rowOrder: 'strict' } });
    await runCase(strict, table(['a'], [[1], [2]]), table(['a'], [[2], [1]]));
    expect(strict.getScore()).toBe(0);

    const relaxed = createTester([{}]);
    await runCase(relaxed, table(['a'], [[1], [2]]), table(['a'], [[2], [1]]));
    expect(relaxed.getScore()).toBe(1);
  });

  it('grades weighted test cases and keeps all-or-nothing scoring for the full score', async () => {
    const tester = createTester([{ weight: 1 }, { weight: 3 }]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));
    tester.session.nextTestCase();
    await runCase(tester, table(['a'], [[1]]), table(['a'], [[9]]));

    expect(tester.results.getScore()).toBe(1);
    expect(tester.results.getMaxScore()).toBe(4);
    expect(tester.getScore()).toBe(0);
    expect(tester.getFirstFailure()).toMatchObject({ testIndex: 1 });
  });

  it('fails every case when the query requirements are violated', async () => {
    const tester = createTester([{}]);
    tester.setQueryConstraintResult({
      passed: false,
      violations: ['JOIN fehlt'],
      checks: [{ passed: false, message: 'JOIN fehlt' }],
    });

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));

    expect(tester.getScore()).toBe(0);
    expect(tester.getFirstFailure()).toMatchObject({
      type: 'queryConstraintMismatch',
      violations: ['JOIN fehlt'],
    });
    expect(document.querySelector('.tables-query-constraints')?.textContent).toContain('JOIN fehlt');
  });

  it('renders one collapsible entry per test case with a hint and hides hidden tests', async () => {
    const tester = createTester([
      { name: 'Basis' },
      { name: 'Variante', failureHint: 'Prüfe die Bedingung.' },
      { hidden: true, name: 'Geheim', failureHint: 'nicht zeigen' },
    ]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));
    tester.session.nextTestCase();
    await runCase(tester, table(['a'], [[2]]), table(['a'], [[3]]));
    tester.session.nextTestCase();
    await runCase(tester, table(['a'], [[5]]), table(['a'], [[6]]));

    const entries = document.querySelectorAll('.tables-testcase');
    expect(entries).toHaveLength(3);
    expect(entries[0].classList.contains('matching')).toBe(true);
    expect(entries[0].open).toBe(false);
    expect(entries[1].classList.contains('not-matching')).toBe(true);
    expect(entries[1].open).toBe(true);
    expect(entries[1].querySelector('.testcase-hint')?.textContent).toContain('Prüfe die Bedingung.');
    expect(entries[2].textContent).not.toContain('nicht zeigen');
    expect(entries[2].querySelector('.tables-table')).toBeNull();
  });

  it('keeps the learner tables of earlier cases when later cases run', async () => {
    const tester = createTester([{}, {}]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));
    tester.session.nextTestCase();
    await runCase(tester, table(['a'], [[7]]), table(['a'], [[7]]));

    expect(tester.resultTables).toHaveLength(2);
    expect(tester.getScore()).toBe(1);
  });

  it('resets collected results', async () => {
    const tester = createTester([{}]);
    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));

    tester.reset();

    expect(tester.targetTables).toEqual([]);
    expect(tester.getScore()).toBe(0);
  });

  it('reports a case that was never graded, e.g. after a failing learner query', async () => {
    const tester = createTester([{}, { name: 'Variante' }]);

    await runCase(tester, table(['a'], [[1]]), table(['a'], [[1]]));

    expect(tester.getScore()).toBe(0);
    expect(tester.getFirstFailure()).toEqual({ type: 'incomplete', testIndex: 1 });
  });
});
