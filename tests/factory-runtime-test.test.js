import { describe, expect, it } from 'vitest';

import TestRuntimeFactory from '../src/scripts/runtime/factory-runtime-test.js';

describe('TestRuntimeFactory constructor compatibility', () => {
  it('passes codeTester and options to runtimes that expect four constructor arguments', () => {
    class FourArgRuntime {
      constructor(resizeActionHandler, code, codeTester, options) {
        FourArgRuntime.lastArgs = [
          resizeActionHandler,
          code,
          codeTester,
          options,
        ];
      }
    }

    const resizeActionHandler = () => {};
    const codeTester = { name: 'tester' };
    const options = { l10n: { run: 'Run' } };
    const factory = new TestRuntimeFactory(
      FourArgRuntime,
      resizeActionHandler,
      'print(1)',
      codeTester,
      options,
    );

    factory.create();

    expect(FourArgRuntime.lastArgs).toEqual([
      resizeActionHandler,
      'print(1)',
      codeTester,
      options,
    ]);
  });

  it('passes options as third constructor argument for three-argument runtimes', () => {
    class ThreeArgRuntime {
      constructor(...args) {
        ThreeArgRuntime.lastArgs = args;
      }
    }

    const resizeActionHandler = () => {};
    const codeTester = { name: 'tester' };
    const options = { l10n: { run: 'Run' } };
    const factory = new TestRuntimeFactory(
      ThreeArgRuntime,
      resizeActionHandler,
      'print(2)',
      codeTester,
      options,
    );

    factory.create();

    expect(ThreeArgRuntime.lastArgs).toEqual([
      resizeActionHandler,
      'print(2)',
      options,
    ]);
  });
});