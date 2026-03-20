import { describe, expect, it, vi } from 'vitest';

import { ManualRuntimeMixin } from '../src/scripts/runtime/runtime-manual.js';
import { Runtime } from '../src/scripts/runtime/runtime.js';

describe('Runtime page behavior', () => {
  it('returns to the code page for manual runs', () => {
    H5P.DialogQueue = class DialogQueue {};
    const runtime = new Runtime(vi.fn(), '', {});

    expect(runtime.getRunPage()).toBe('code');
  });

  it('stops state and returns to code page when runtime errors occur', () => {
    H5P.DialogQueue = class DialogQueue {};
    const runtime = new Runtime(vi.fn(), '', {});
    const stop = vi.fn();
    const showCodePage = vi.fn();

    runtime._consoleManager = { write: vi.fn() };
    runtime.codeContainer = {
      getStateManager: () => ({ stop }),
      showCodePage,
      getPageManager: () => ({ showPage: vi.fn() }),
    };

    runtime.onError('boom');

    expect(runtime._consoleManager.write).toHaveBeenCalledWith('boom', '!>');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(showCodePage).toHaveBeenCalledTimes(1);
  });

  it('stops state even if runner.stop() reports false', () => {
    H5P.DialogQueue = class DialogQueue {};
    const runtime = new Runtime(vi.fn(), '', {});
    const stop = vi.fn();

    runtime.runner = {
      stop: vi.fn(() => false),
    };
    runtime.codeContainer = {
      getStateManager: () => ({ stop }),
    };

    expect(runtime.stop()).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
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