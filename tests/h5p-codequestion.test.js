import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTester: vi.fn(),
  manualFactoryInstances: [],
}));

vi.mock('../src/scripts/runtime/factory-runtime-manual', () => ({
  default: class ManualRuntimeFactoryMock {
    constructor(runtimeClass, resizeActionHandler, stopActionHandler, options = []) {
      this.runtimeClass = runtimeClass;
      this.resizeActionHandler = resizeActionHandler;
      this.stopActionHandler = stopActionHandler;
      this.options = options;
      mocks.manualFactoryInstances.push(this);
    }
  },
}));

vi.mock('../src/scripts/container/factory-container', () => ({
  default: class ContainerFactoryMock {},
}));

vi.mock('../src/scripts/tester/factory-tester', () => ({
  default: class CodeTesterFactoryMock {
    create() {
      return mocks.createTester();
    }
  },
}));

vi.mock('../src/scripts/runtime/factory-runtime-test', () => ({
  default: class TestRuntimeFactoryMock {},
}));

vi.mock('../src/scripts/runtime/runtime', () => ({
  Runtime: class RuntimeMock {},
}));

vi.mock('../src/scripts/container/codequestion-container', () => ({
  default: class CodeQuestionContainerMock {},
}));

const { default: CodeQuestion } = await import('../src/scripts/h5p-codequestion.js');

describe('CodeQuestion', () => {
  beforeEach(() => {
    mocks.createTester.mockReset();
    mocks.manualFactoryInstances.length = 0;
    mocks.createTester.mockReturnValue({
      getScore: vi.fn(() => 0),
      reset: vi.fn(),
      view: {
        getDOM: () => document.createElement('div'),
      },
    });
  });

  it('derives localized feedback text and applies score feedback consistently', () => {
    const question = new CodeQuestion({
      l10n: {
        successText: 'Correct',
        failedText: 'Incorrect',
        score: 'Punkte',
      },
    }, 1);
    question.setFeedback = vi.fn();
    question.success = vi.fn(() => true);

    expect(question.getFeedbackText()).toBe('Correct');

    question.applyScoreFeedback(2, 4);

    expect(question.setFeedback).toHaveBeenCalledWith('Correct', 2, 4, 'Punkte');

    question.success.mockReturnValue(false);

    expect(question.getFeedbackText()).toBe('Incorrect');
  });

  it('passes the raw content localization to runtimes', () => {
    const question = new CodeQuestion({
      l10n: {
        successText: 'Correct',
        customRuntimeLabel: 'Runtime text',
      },
    }, 1);

    expect(question.getRuntimeOptions()).toEqual({
      l10n: {
        successText: 'Correct',
        customRuntimeLabel: 'Runtime text',
      },
    });
  });

  it('uses the CodeMirror-compatible reset path in resetTask', () => {
    const question = new CodeQuestion({}, 1);
    const setCode = vi.fn();
    const legacySetValue = vi.fn();

    question.defaultCode = 'print(&quot;ok&quot;)';
    question.removeFeedback = vi.fn();
    question.showButton = vi.fn();
    question.resizeActionHandler = vi.fn();
    question.codeTester = { reset: vi.fn() };
    question.codeContainer = {
      setCode,
      reset: vi.fn(),
      session: { setValue: legacySetValue },
      set_decoded_code: vi.fn(() => 'legacy'),
    };

    question.resetTask();

    expect(setCode).toHaveBeenCalledWith('print("ok")');
    expect(legacySetValue).not.toHaveBeenCalled();
    expect(question.codeTester.reset).toHaveBeenCalledTimes(1);
    expect(question.codeContainer.reset).toHaveBeenCalledTimes(1);
    expect(question.codeContainer.stopSignal).toBe(false);
    expect(question.codeContainer.stop_signal).toBe(false);
  });

  it('resets stop signal before a manual run starts', () => {
    const question = new CodeQuestion({}, 1);
    const run = vi.fn();
    question.codeContainer = {
      stopSignal: true,
      stop_signal: true,
      run,
    };

    question.runAction();

    expect(question.codeContainer.stopSignal).toBe(false);
    expect(question.codeContainer.stop_signal).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reads shouldStop from both modern and legacy stop flags', () => {
    const question = new CodeQuestion({}, 1);

    question.codeContainer = { stopSignal: true };
    expect(question.shouldStop()).toBe(true);

    question.codeContainer = { stopSignal: false, stop_signal: true };
    expect(question.shouldStop()).toBe(true);

    question.codeContainer = { stopSignal: false, stop_signal: false };
    expect(question.shouldStop()).toBe(false);

    question.codeContainer = null;
    expect(question.shouldStop()).toBe(false);
  });

  it('wires ManualRuntimeFactory stop callback to shouldStop()', () => {
    const question = new CodeQuestion({}, 1);
    question.shouldStop = vi.fn(() => true);

    question.getManualRuntimeFactory();

    const [factory] = mocks.manualFactoryInstances;
    expect(factory).toBeDefined();
    expect(factory.stopActionHandler()).toBe(true);
    expect(question.shouldStop).toHaveBeenCalledTimes(1);
  });

  it('destroys existing code containers before rebuilding DOM', () => {
    const question = new CodeQuestion({}, 1);
    const assignmentContainer = { destroy: vi.fn() };
    const inlineContainer = { destroy: vi.fn() };

    question.codeContainer = assignmentContainer;
    question.codeContainers.set('inline-1', inlineContainer);
    question.contentType = 'text_only';
    question.setContent = vi.fn();

    question.registerDomElements();

    expect(assignmentContainer.destroy).toHaveBeenCalledTimes(1);
    expect(inlineContainer.destroy).toHaveBeenCalledTimes(1);
    expect(question.codeContainer).toBeNull();
    expect(question.codeContainers.size).toBe(0);
  });

  it('exposes a direct destroy() teardown entrypoint', () => {
    const question = new CodeQuestion({}, 1);
    const assignmentContainer = { destroy: vi.fn() };
    const inlineContainerA = { destroy: vi.fn() };
    const inlineContainerB = { destroy: vi.fn() };

    question.codeContainer = assignmentContainer;
    question.codeContainerParent = document.createElement('div');
    question.codeContainers.set('inline-a', inlineContainerA);
    question.codeContainers.set('inline-b', inlineContainerB);

    question.destroy();

    expect(assignmentContainer.destroy).toHaveBeenCalledTimes(1);
    expect(inlineContainerA.destroy).toHaveBeenCalledTimes(1);
    expect(inlineContainerB.destroy).toHaveBeenCalledTimes(1);
    expect(question.codeContainer).toBeNull();
    expect(question.codeContainerParent).toBeNull();
    expect(question.codeContainers.size).toBe(0);
  });
});