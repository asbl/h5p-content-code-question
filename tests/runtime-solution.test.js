import { describe, expect, it, vi } from 'vitest';

import { SolutionRuntimeMixin } from '../src/scripts/runtime/runtime-solution.js';

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
