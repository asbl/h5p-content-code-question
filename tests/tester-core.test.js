import { describe, expect, it, vi } from 'vitest';

import TestSession from '../src/scripts/tester/components/session-tester.js';
import CodeTester from '../src/scripts/tester/tester.js';

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