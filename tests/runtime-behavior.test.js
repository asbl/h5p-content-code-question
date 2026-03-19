import { describe, expect, it, vi } from 'vitest';

import { ManualRuntimeMixin } from '../src/scripts/runtime/runtime-manual.js';
import { Runtime } from '../src/scripts/runtime/runtime.js';

describe('Runtime page behavior', () => {
  it('returns to the code page for manual runs', () => {
    H5P.DialogQueue = class DialogQueue {};
    const runtime = new Runtime(vi.fn(), '', {});

    expect(runtime.getRunPage()).toBe('code');
  });
});

describe('ManualRuntimeMixin console behavior', () => {
  it('shows the console when manual output is written', () => {
    class BaseRuntime {
      shouldShowOutputDialog() {
        return false;
      }
    }

    const ManualRuntime = ManualRuntimeMixin(BaseRuntime);
    const showConsole = vi.fn();
    const runtime = new ManualRuntime();

    runtime._consoleManager = { write: vi.fn() };
    runtime.codeContainer = {
      getConsoleManager: () => ({ showConsole }),
    };
    runtime.dialogQueue = { enqueueAlert: vi.fn() };

    runtime.outputHandler('hello world');

    expect(runtime._consoleManager.write).toHaveBeenCalledWith('hello world');
    expect(showConsole).toHaveBeenCalledTimes(1);
  });
});