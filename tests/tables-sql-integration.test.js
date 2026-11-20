import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import TablesTester from '../src/scripts/tester/tables/tester-tables';

const wasm = resolve(process.cwd(), '../H5P.SQLQuestion-5.17/node_modules/sql.js/dist/sql-wasm.wasm');
const PREPARE = `
  CREATE TABLE city(name TEXT, pop INTEGER);
  INSERT INTO city VALUES ('Berlin', 3), ('Paris', 2), ('Rom', 1);`;
let SQL;
// sql.js ships with the sibling SQLQuestion checkout; skip when it is not installed.
const hasSqlJs = existsSync(wasm);

beforeAll(async () => {
  if (!hasSqlJs) return;
  const { default: initSqlJs } = await import('../../H5P.SQLQuestion-5.17/node_modules/sql.js');
  SQL = await initSqlJs({ locateFile: () => wasm });
});

/**
 * Mimics the SQL runtimes: the reference and the learner query both run on a
 * fresh database that is extended with the setup SQL of the test case.
 * @param {string} sql Query.
 * @param {string} setupSql Setup SQL of the test case.
 * @returns {Array} sql.js result.
 */
function execute(sql, setupSql = '') {
  const db = new SQL.Database();
  db.run(PREPARE);
  if (setupSql) db.run(setupSql);
  return db.exec(sql);
}

async function grade(testcases, solution, learnerSql, options = {}) {
  const tester = new TablesTester(
    testcases, 'bySolution', vi.fn(), () => ({}), {}, null, false, '', '', {}, {}, options,
  );
  document.body.innerHTML = '<div id="fixture"></div>';
  document.getElementById('fixture').appendChild(tester.view.getDOM());

  for (let index = 0; index < tester.session.countTestCases(); index++) {
    if (index > 0) tester.session.nextTestCase();
    const { setupSql } = tester.session.getCurrentTestCase();
    tester.setTargetTable(execute(solution, setupSql));
    tester.addOutput(execute(learnerSql, setupSql));
    await tester.evaluateTestCase();
  }

  return tester;
}

const variants = [
  { name: 'Standarddatenbank' },
  { name: 'Weitere Stadt', failureHint: 'Filtere mit WHERE.', setupSql: "INSERT INTO city VALUES ('Wien', 5);" },
];
const solution = 'SELECT name FROM city WHERE pop >= 2';

describe.skipIf(!hasSqlJs)('table grading with data variants', () => {
  it('accepts a general query on every data variant', async () => {
    const tester = await grade(variants, solution, 'SELECT name FROM city WHERE pop > 1');

    expect(tester.getScore()).toBe(1);
    expect(tester.getFirstFailure()).toBeNull();
  });

  it('detects a hard-coded answer that only fits the default data', async () => {
    const tester = await grade(variants, solution, "SELECT name FROM city WHERE name IN ('Berlin', 'Paris')");

    expect(tester.results.results).toEqual([1, 0]);
    expect(tester.getScore()).toBe(0);
    expect(tester.getFirstFailure()).toMatchObject({ type: 'tableMismatch', testIndex: 1 });
    expect(document.querySelector('.tables-testcase.not-matching .testcase-hint').textContent).toContain('Filtere mit WHERE.');
  });

  it('applies author options to real result sets', async () => {
    const strict = { comparison: { rowOrder: 'strict' } };
    const reversed = 'SELECT name FROM city WHERE pop >= 2 ORDER BY pop ASC';

    expect((await grade([{}], 'SELECT name FROM city WHERE pop >= 2 ORDER BY pop DESC', reversed)).getScore()).toBe(1);
    expect((await grade([{}], 'SELECT name FROM city WHERE pop >= 2 ORDER BY pop DESC', reversed, strict)).getScore()).toBe(0);

    const aliased = 'SELECT name AS stadt FROM city WHERE pop >= 2';
    expect((await grade([{}], solution, aliased)).getScore()).toBe(0);
    expect((await grade([{}], solution, aliased, { comparison: { columnComparison: 'ignoreNames' } })).getScore()).toBe(1);
  });

  it('treats a query without result rows like the solution without result rows', async () => {
    const none = 'SELECT name FROM city WHERE pop > 100';

    expect((await grade([{}], none, none)).getScore()).toBe(1);
    expect((await grade([{}], none, solution)).getScore()).toBe(0);
  });
});
