import { describe, expect, it, vi } from 'vitest';

import { SolutionRuntimeMixin } from '../src/scripts/runtime/runtime-solution.js';
import { TestRuntimeMixin } from '../src/scripts/runtime/runtime-test.js';
import TestSession from '../src/scripts/tester/components/session-tester.js';

class BaseRuntime {
  constructor(_resizeActionHandler, code, options = {}) {
    this.code = code;
    this.options = options;
  }

  setup(codeContainer) {
    this.codeContainer = codeContainer;
  }

  init() {}

  prepareForRun() {}

  async runCode() {}
}

const SolutionRuntime = SolutionRuntimeMixin(BaseRuntime);
const TestRuntime = TestRuntimeMixin(BaseRuntime);

describe('SolutionRuntimeMixin', () => {
  it('advances the session input cursor when consuming input', async () => {
    const session = {
      testCaseIndex: 0,
      getInput: vi.fn(() => '42'),
      nextInput: vi.fn(),
    };

    const runtime = new SolutionRuntime(
      vi.fn(),
      'print(input())',
      { session, l10n: {} },
      {},
    );

    const value = await runtime.inputHandler();

    expect(value).toBe('42');
    expect(session.getInput).toHaveBeenCalledTimes(1);
    expect(session.nextInput).toHaveBeenCalledTimes(1);
  });

  it('tracks executed solutions by session test-case index', () => {
    const runtime = new SolutionRuntime(
      vi.fn(),
      'print(1)',
      {
        session: {
          testCaseIndex: 3,
        },
        l10n: {},
      },
      {},
    );

    runtime.setup({});

    expect(runtime.solutions[3]).toBe(true);
  });
});

describe('TestRuntimeMixin', () => {
  it('rewinds testcase inputs after the reference solution consumed them', async () => {
    const session = new TestSession([{ inputs: ['3'], outputs: [] }]);
    const solutionInputHandler = vi.fn(async () => {
      const value = session.getInput();
      session.nextInput();
      return value;
    });
    const learnerInputHandler = vi.fn(async () => {
      const value = session.getInput();
      session.nextInput();
      return value;
    });

    class ConcreteTestRuntime extends TestRuntime {
      getCode() {
        return 'print(input())';
      }

      async runCode() {
        await learnerInputHandler();
      }

      createSolutionRuntime() {
        return {
          start: async () => {
            await solutionInputHandler();
          },
        };
      }
    }

    const runtime = new ConcreteTestRuntime(
      vi.fn(),
      'print(input())',
      {
        runSolution: true,
        session,
        view: { setExpectedGenerationState: vi.fn() },
        reset: vi.fn(),
        evaluateTestCase: vi.fn(),
        nextTestCase: vi.fn(),
      },
      {},
    );

    runtime.setup({});
    runtime.init();
    await runtime.run();

    expect(solutionInputHandler).toHaveResolvedWith('3');
    expect(learnerInputHandler).toHaveResolvedWith('3');
    expect(session.inputIndex).toBe(1);
  });
});
