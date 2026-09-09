import { describe, expect, it, vi } from 'vitest';

import TestSession from '../src/scripts/tester/components/session-tester.js';
import CodeTester from '../src/scripts/tester/tester.js';
import { IOComparator } from '../src/scripts/tester/io/comparator-io.js';
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

  it('fails closed when configured algorithm constraints have no valid result', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tester = new TestCodeTester(
      [{ inputs: [] }], 'functionTests', vi.fn(), vi.fn(), {}, null, false,
      null, null, { requireRecursion: true },
    );

    await tester.evaluateTestCase();
    expect(tester.results.getScore()).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();

    tester.setAlgorithmConstraintResult({ passed: true, violations: [] });
    await tester.evaluateTestCase();
    expect(tester.results.getScore()).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('writes diagnostic logs only when enabled', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tester = new TestCodeTester(
      [{ inputs: [] }], 'functionTests', vi.fn(), vi.fn(), {}, null, false,
      null, null, {}, {}, { enableDiagnosticLogs: true },
    );

    await tester.evaluateTestCase();

    expect(warnSpy).toHaveBeenCalledWith(
      'Code tester:',
      'evaluate test case',
      expect.objectContaining({ gradingMethod: 'functionTests' }),
    );
    warnSpy.mockRestore();
  });

  it('treats configured OOP constraints as active algorithm constraints', () => {
    const tester = new TestCodeTester(
      [{ inputs: [] }], 'functionTests', vi.fn(), vi.fn(), {}, null, false,
      null, null, { requiredClassNames: 'Person' },
    );

    expect(tester.hasAlgorithmConstraints()).toBe(true);
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

  it('can rewind testcase inputs without changing testcase position or outputs', () => {
    const session = new TestSession([{ inputs: ['3'], outputs: [] }]);

    expect(session.getInput()).toBe('3');
    session.nextInput();

    session.addOutput('solution output');
    session.resetCurrentTestCaseInputs();

    expect(session.getCurrentTestCaseIndexNumber()).toBe(0);
    expect(session.outputs[0]).toEqual(['solution output']);
    expect(session.getInput()).toBe('3');
  });

  it('reads Moodle list-field input objects as testcase input values', () => {
    const session = new TestSession([{ inputs: [{ input: '42' }], outputs: [] }]);

    expect(session.getInput()).toBe('42');
  });

  it('preserves numeric Moodle list-field input objects for int(input())', () => {
    const session = new TestSession([{ inputs: [{ input: '3' }, { input: '6' }], outputs: [] }]);

    expect(session.getInput()).toBe('3');
    session.nextInput();
    expect(session.getInput()).toBe('6');
  });

  it('replaces output for the current testcase when a tester uses a structured result protocol', () => {
    const session = new TestSession([{ inputs: [], outputs: [] }]);

    session.addOutput('noisy stdout');
    session.setCurrentTestCaseOutput({ status: 'passed', detail: '42' });

    expect(session.outputs).toEqual([[{ status: 'passed', detail: '42' }]]);
  });
});

describe('IOComparator edge cases', () => {
  it('compares Moodle list-field output objects as expected output values', () => {
    const comparator = new IOComparator();

    expect(comparator.compare(0, {
      outputs: [{ output: '42' }],
    }, ['42'])).toBe(true);
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

  it('restores a testcase area that was hidden before reset', () => {
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

    const originalContainer = document.querySelector('.testcases-area');
    originalContainer.hidden = true;
    originalContainer.style.display = 'none';

    view.resetDOM();

    const refreshedContainer = document.querySelector('.testcases-area');

    expect(refreshedContainer).not.toBeNull();
    expect(refreshedContainer).not.toBe(originalContainer);
    expect(refreshedContainer.hidden).toBe(false);
    expect(refreshedContainer.getAttribute('style')).toBeNull();
    expect(refreshedContainer.querySelector('.table-testcase-0')).not.toBeNull();
  });
});
