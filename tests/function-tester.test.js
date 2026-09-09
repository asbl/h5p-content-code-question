import { describe, expect, it, vi } from 'vitest';

import FunctionTester from '../src/scripts/tester/function/tester-function.js';

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
