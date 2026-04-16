import { describe, expect, it, vi } from 'vitest';

import TestSession from '../src/scripts/tester/components/session-tester.js';
import CodeTester from '../src/scripts/tester/tester.js';
import { IOTesterView } from '../src/scripts/tester/io/view-tester-io.js';

class TestCodeTester extends CodeTester {
  comparatorFactory() {
    return {
      compare: vi.fn(() => true),
    };
  }
}

describe('CodeTester core edge cases', () => {
  it('normalizes missing testcases to an empty session and reports the configuration error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tester = new TestCodeTester(
      null,
      'targetImage',
      vi.fn(),
      () => ({ create: vi.fn() }),
      {},
      null,
      false,
    );

    expect(errorSpy).toHaveBeenCalledWith('No Testcases are defined for CodeTester');
    expect(tester.testcases).toEqual([]);
    expect(tester.session.countTestCases()).toBe(0);
    expect(tester.results.getMaxScore()).toBe(0);
    expect(tester.getScore()).toBe(0);

    errorSpy.mockRestore();
  });

  it('finishes immediately when no additional test case is available', async () => {
    const onEvaluateTest = vi.fn();
    const runtimeFactory = vi.fn();
    const tester = new TestCodeTester(
      [{ inputs: ['1'] }],
      'targetImage',
      onEvaluateTest,
      runtimeFactory,
      {},
      null,
      false,
    );

    await tester.nextTestCase({});

    expect(onEvaluateTest).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).not.toHaveBeenCalled();
  });
});

describe('TestSession edge cases', () => {
  it('treats missing testcase lists as empty', () => {
    const session = new TestSession(null);

    expect(session.countTestCases()).toBe(0);
    expect(session.outputs).toEqual([]);
    expect(session.hasMoreTestCases()).toBe(false);
  });

  it('throws a stable error when testcase inputs are missing', () => {
    const session = new TestSession([{}]);

    expect(() => session.getInput()).toThrow('No more input for testcase');
  });
});

describe('TestCaseView reset behavior', () => {
  it('rebuilds the IO testcase markup after a reset', () => {
    document.body.innerHTML = '';

    const view = new IOTesterView(
      {
        testInput: 'Input',
        expectedOutput: 'Expected',
        lastOutput: 'Output',
        passed: 'Passed',
        testCase: 'Test case',
        hidden: 'Hidden',
      },
      {
        testcases: [{ inputs: ['Ada'], outputs: ['3'] }],
      },
      null,
      false,
    );

    document.body.append(view.getDOM());
    document.querySelector('.output').textContent = 'old output';
    document.querySelector('.passed').textContent = '✗';

    view.resetDOM();

    expect(document.querySelector('.table-testcase-0')).not.toBeNull();
    expect(document.querySelector('.input').innerHTML).toBe('Ada');
    expect(document.querySelector('.expected').innerHTML).toBe('3');
    expect(document.querySelector('.output').textContent).toBe('');
    expect(document.querySelector('.passed').textContent).toBe('');
  });
});