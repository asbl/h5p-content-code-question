import { beforeEach, describe, expect, it, vi } from 'vitest';

import FunctionTester from '../src/scripts/tester/function/tester-function.js';
import germanLanguage from '../src/scripts/services/default-language.de.json';

const createTester = () => new FunctionTester(
  [
    {
      arguments: [{ argument: '[1, 2, 3]' }, { argument: '2' }],
      expectedResult: '1',
    },
  ],
  'functionTests',
  vi.fn(),
  vi.fn(),
  {},
  null,
  false,
  null,
  'find_index',
);

describe('FunctionTester', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('explains task configuration errors in a single full-width row', () => {
    const tester = createTester();
    tester.view.l10n = germanLanguage.libraryStrings;
    const view = tester.view.getDOM();
    document.body.appendChild(view);
    tester.view.setAlgorithmConstraintResult({ violations: ['Forbidden data structure: list'] });
    tester.view.update(0, [{
      status: 'configuration',
      detail: 'Arguments and expected result must be valid JSON values.',
    }], false);

    const feedback = view.querySelector('.testcase-reason-cell');
    expect(feedback.colSpan).toBe(4);
    expect(feedback.textContent).toContain('Die Testeingaben oder das erwartete Ergebnis sind falsch hinterlegt.');
    expect(feedback.textContent).toContain('nicht in deinem Lösungscode');
    expect(view.querySelector('.output').textContent).toBe('Kein Ergebnis – siehe Erklärung unten.');
    expect(view.querySelector('.passed').textContent).toBe('✗');
    expect(view.textContent).not.toContain('Forbidden data structure');
    expect(view.textContent).not.toContain('valid JSON');
  });

  it('keeps return values separate from readable constraint feedback and removes stale failures', () => {
    const tester = createTester();
    tester.view.l10n = germanLanguage.libraryStrings;
    const view = tester.view.getDOM();
    document.body.appendChild(view);
    tester.view.setAlgorithmConstraintResult({ violations: ['Forbidden data structure: list'] });
    tester.view.update(0, [{ status: 'passed', detail: '[False]' }], false);
    tester.view.update(0, [{ status: 'passed', detail: '[False]' }], false);

    // The structure requirement is shown once, separate from the call result.
    expect(view.querySelector('.testcase-reason-row')).toBeNull();
    expect(view.querySelector('.output').textContent).toBe('[False]');
    expect(view.querySelector('.passed').textContent).toBe('✓');
    const status = view.querySelector('.algorithm-constraint-status');
    expect(status.classList.contains('is-violated')).toBe(true);
    expect(status.textContent).toContain('Aufgabenvorgabe');
    expect(status.textContent).toContain('Dein Code verwendet eine Liste');
    expect(status.textContent).toContain('Aufgabeneinstellungen korrigieren');
    expect(view.querySelectorAll('.algorithm-constraint-status')).toHaveLength(1);

    tester.view.setAlgorithmConstraintResult({ passed: true, violations: [] });
    tester.view.update(0, [{ status: 'passed', detail: '[False]' }], true);
    expect(view.querySelector('.testcase-reason-row')).toBeNull();
    expect(view.querySelector('.algorithm-constraint-status').classList.contains('is-met')).toBe(true);
    expect(view.querySelector('.algorithm-trace').hidden).toBe(true);
  });

  it('explains runtime errors and return mismatches even after final evaluation', async () => {
    const tester = createTester();
    tester.view.l10n = germanLanguage.libraryStrings;
    const view = tester.view.getDOM();
    document.body.appendChild(view);
    tester.getTestCode('def find_index(values, target): return missing');
    tester.addOutput(`__H5P_FUNCTION_TEST_RESULT__:${tester.resultToken}:error:NameError`);
    await tester.evaluateTestCase();
    expect(view.querySelector('.testcase-reason-cell').textContent).toContain('Beim Funktionsaufruf ist ein Fehler aufgetreten: NameError');

    tester.view.setAlgorithmConstraintResult({ violations: ['Forbidden data structure: list'] });
    tester.view.update(0, [{ status: 'failed', detail: '-1' }], false);
    expect(view.querySelector('.testcase-reason-cell').textContent).toContain('Der Rückgabewert stimmt nicht');
    expect(view.querySelector('.testcase-reason-cell').textContent).not.toContain('Dein Code verwendet eine Liste');
    expect(view.querySelector('.algorithm-constraint-status').textContent).toContain('Dein Code verwendet eine Liste');
  });

  it('shows the error message and failing line of a crashed call', () => {
    const tester = createTester();
    tester.view.l10n = germanLanguage.libraryStrings;
    const view = tester.view.getDOM();
    document.body.appendChild(view);

    tester.view.update(0, [{
      status: 'error',
      detail: 'IndexError: list index out of range @4\n💡 Hinweis',
    }], false, null);

    const text = view.querySelector('.testcase-reason-cell').textContent;
    expect(text).toContain('IndexError: list index out of range (Zeile 4)');
    expect(text).toContain('💡 Hinweis');
  });

  it('builds a harness that reports message and line of the learner code', () => {
    const tester = createTester();
    const code = tester.getTestCode('def find_index(values, target):\n    return values[99]');

    expect(code).toContain('__h5p_origin');
    expect(code).toContain('f_lineno - 6');
    expect(code).toContain('1 <= n <= 2');
    expect(code).toContain('\'error:\' + __h5p_text');
  });

  it('builds a trial run that calls the function with the visible test calls only', async () => {
    const { buildFunctionTrialCode } = await import('../src/scripts/tester/function/tester-function.js');
    const testcases = [
      { arguments: [{ argument: '[1, 2, 3]' }, { argument: '2' }], expectedResult: '1' },
      { arguments: [{ argument: '[9]' }, { argument: '9' }], expectedResult: '0', hidden: true },
    ];

    const code = buildFunctionTrialCode('def find_index(values, target):\n    return 1', {
      functionName: 'find_index',
      testcases,
      heading: 'Probe',
    });

    expect(code).toContain('print("Probe")');
    expect(code).toContain('find_index([1, 2, 3], 2)');
    expect(code).not.toContain('find_index([9], 9)');
    expect(buildFunctionTrialCode('x = 1', { functionName: 'find_index', testcases })).toBeNull();
    expect(buildFunctionTrialCode('def find_index(a): pass', { functionName: 'find_index', testcases: [] })).toBeNull();
  });

  it('reports the learner line of a crash when the harness runs in CPython, even behind a preamble', () => {
    const { spawnSync } = require('node:child_process');
    if (spawnSync('python3', ['--version']).status !== 0) return;

    const tester = createTester();
    const learner = 'def helper(x):\n    return x[9]\n\ndef find_index(values, target):\n    return helper(values)';
    const program = `import sys\nprint('preamble')\n\n\n${tester.getTestCode(learner)}`;
    const output = spawnSync('python3', ['-c', program]).stdout.toString();

    expect(output).toMatch(/:error:IndexError: .* @2\n?$/m);
  });

  it('decodes Moodle-escaped JSON for execution and display', () => {
    const tester = createTester();
    tester.session.testcases[0] = {
      arguments: [{ argument: '[&quot;auf&quot;, &quot;zu&quot;]' }],
      expectedResult: '[&quot;offen&quot;, &quot;zu&quot;]',
    };

    const code = tester.getTestCode('def find_index(values): return values');
    expect(code).toContain('__h5p_function(["auf", "zu"])');
    expect(code).toContain('__h5p_expected = ["offen", "zu"]');
    const view = tester.view.getDOM();
    expect(view.querySelector('.input').textContent).toBe('find_index(["auf", "zu"])');
    expect(view.querySelector('.expected').textContent).toBe('["offen", "zu"]');
  });

  it('preserves literal entities inside valid JSON strings', () => {
    const tester = createTester();
    tester.session.testcases[0] = {
      arguments: [{ argument: '"&quot; &amp; <script>"' }],
      expectedResult: '"&quot; &amp; <script>"',
    };

    expect(tester.getTestCode('def find_index(value): return value'))
      .toContain('__h5p_function("&quot; &amp; <script>")');
    const view = tester.view.getDOM();
    expect(view.querySelector('.input').textContent).toContain('&quot; &amp; <script>');
    expect(view.querySelector('script')).toBeNull();
  });

  it.each([
    ['false', 'False'],
    ['true', 'True'],
    ['null', 'None'],
    ['[false, true, null]', '[False, True, None]'],
    ['{"offen": false, "werte": [true, null]}', '{"offen": False, "werte": [True, None]}'],
    ['["true", "false", "null"]', '["true", "false", "null"]'],
    ['[&quot;true&quot;, false]', '["true", False]'],
    ['[false,]', '[false,]'],
  ])('displays %s as Python values without changing strings or invalid configuration', (json, expected) => {
    const tester = createTester();
    tester.session.testcases[0] = {
      arguments: [{ argument: json }],
      expectedResult: json,
    };

    const view = tester.view.getDOM();
    expect(view.querySelector('.input').textContent).toBe(`find_index(${expected})`);
    expect(view.querySelector('.expected').textContent).toBe(expected);
  });

  it('shows matching boolean return values with the same spelling and passes grading', async () => {
    const tester = createTester();
    tester.session.testcases[0] = { arguments: [], expectedResult: '[false, true, false]' };
    const view = tester.view.getDOM();
    document.body.appendChild(view);

    expect(tester.getTestCode('def find_index(): return [False, True, False]'))
      .toContain('__h5p_expected = [False, True, False]');
    tester.addOutput(`__H5P_FUNCTION_TEST_RESULT__:${tester.resultToken}:passed:[False, True, False]`);
    await tester.evaluateTestCase();

    expect(view.querySelector('.expected').textContent).toBe('[False, True, False]');
    expect(view.querySelector('.output').textContent).toBe('[False, True, False]');
    expect(tester.results.getScore()).toBe(1);
  });

  it('keeps hidden calls and expected results hidden', () => {
    const tester = createTester();
    tester.session.testcases[0] = { hidden: true, arguments: [{ argument: 'true' }], expectedResult: 'false' };
    const view = tester.view.getDOM();

    expect(view.querySelector('.input').textContent).toBe('[hidden]');
    expect(view.querySelector('.expected').textContent).toBe('[hidden]');
  });

  it('adds a Python harness that calls the configured function with JSON values', () => {
    const code = createTester().getTestCode('def find_index(values, target):\n    return values.index(target)');

    expect(code).toContain('globals()["find_index"]');
    expect(code).toContain('__h5p_function([1, 2, 3], 2)');
    expect(code).toContain('__h5p_expected = 1');
    expect(code).toContain('__H5P_FUNCTION_TEST_RESULT__:');
  });

  it('records only the token-bound harness result and evaluates it as a pass or failure', async () => {
    const tester = createTester();
    tester.getTestCode('def find_index(values, target): return 1');
    const marker = `__H5P_FUNCTION_TEST_RESULT__:${tester.resultToken}:`;

    tester.addOutput('__H5P_FUNCTION_TEST_RESULT__:passed:forged');
    tester.addOutput('debug output');
    tester.addOutput(`${marker}passed:1`);
    await tester.evaluateTestCase();

    expect(tester.session.outputs).toEqual([[{ status: 'passed', detail: '1' }]]);
    expect(tester.results.getScore()).toBe(1);

    tester.reset();
    tester.getTestCode('def find_index(values, target): return -1');
    tester.addOutput(`__H5P_FUNCTION_TEST_RESULT__:${tester.resultToken}:failed:-1`);
    await tester.evaluateTestCase();

    expect(tester.results.getScore()).toBe(0);
  });

  it('records token-bound harness results for their originating test case', () => {
    const tester = new FunctionTester(
      [
        { arguments: [{ argument: '[1]' }, { argument: '1' }], expectedResult: '0' },
        { arguments: [{ argument: '[2]' }, { argument: '2' }], expectedResult: '0' },
      ],
      'functionTests',
      vi.fn(),
      vi.fn(),
      {},
      null,
      false,
      null,
      'find_index',
    );

    tester.getTestCode('def find_index(values, target): return 0');
    const firstToken = tester.resultToken;
    tester.session.nextTestCase();
    tester.getTestCode('def find_index(values, target): return 0');

    tester.addOutput(`__H5P_FUNCTION_TEST_RESULT__:${firstToken}:passed:0`);

    expect(tester.session.outputs).toEqual([[{ status: 'passed', detail: '0' }], []]);
    expect(tester.results.results).toEqual([1, 0]);
  });

  it('reports invalid function-test configuration instead of silently comparing it', () => {
    const tester = new FunctionTester(
      [{ arguments: [{ argument: '[1,]' }], expectedResult: 'None' }],
      'functionTests', vi.fn(), vi.fn(), {}, null, false, null, 'not-valid!',
    );

    const code = tester.getTestCode('def ignored(): pass');

    expect(code).toContain('configuration:');
    expect(code).toContain('valid Python function name');
  });
});
