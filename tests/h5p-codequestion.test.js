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

  it('treats placeholder grading selection as disabled grading', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'please_choose',
      },
    }, 1);

    expect(question.gradingMethod).toBeNull();
    expect(question.codeTester).toBeNull();
    expect(question.getScore()).toBe(0);
    expect(mocks.createTester).not.toHaveBeenCalled();
  });

  it('disables grading safely if the grading method is unsupported', () => {
    mocks.createTester.mockReturnValueOnce(null);

    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'unsupportedMethod',
      },
    }, 1);

    expect(question.gradingMethod).toBeNull();
    expect(question.codeTester).toBeNull();
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

  it('shows a busy label on the check-answer button while tests are running', async () => {
    const question = new CodeQuestion({
      l10n: {
        checkAnswer: 'Check Answer',
        checkingAnswer: 'Checking...',
      },
    }, 1);
    const runtime = { start: vi.fn().mockResolvedValue() };
    const button = document.createElement('button');
    button.className = 'h5p-question-check-answer';
    button.textContent = 'Check Answer';

    question.codeTester = {
      reset: vi.fn(),
      getScore: vi.fn(() => 1),
    };
    question.codeContainer = {};
    question.getContainer = vi.fn(() => {
      const container = document.createElement('div');
      container.appendChild(button);
      return container;
    });
    question.getTestRuntimeFactory = vi.fn(() => ({ create: () => runtime }));
    question.sendAttemptedEvent = vi.fn();
    question.applyScoreFeedback = vi.fn();
    question.sendAnsweredEvent = vi.fn();
    question.resizeActionHandler = vi.fn();
    question.scheduleEvaluationFrameSync = vi.fn();

    const pendingCheck = question.checkAction();

    expect(button.textContent).toBe('Checking...');
    expect(button.disabled).toBe(true);

    await pendingCheck;

    expect(button.textContent).toBe('Check Answer');
    expect(button.disabled).toBe(false);
    expect(question.scheduleEvaluationFrameSync).toHaveBeenCalledTimes(1);
  });

  it('clears prior check-answer feedback before a manual run starts', () => {
    const question = new CodeQuestion({}, 1);
    const run = vi.fn();

    question.removeFeedback = vi.fn();
    question.codeTester = { reset: vi.fn() };
    question.codeContainer = {
      stopSignal: true,
      stop_signal: true,
      run,
    };

    question.runAction();

    expect(question.removeFeedback).toHaveBeenCalledTimes(1);
    expect(question.codeTester.reset).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('clears prior run output before check-answer evaluation starts', async () => {
    const question = new CodeQuestion({
      l10n: {
        checkAnswer: 'Check Answer',
        checkingAnswer: 'Checking...',
      },
    }, 1);
    const runtime = { start: vi.fn().mockResolvedValue() };

    question.codeTester = {
      reset: vi.fn(),
      getScore: vi.fn(() => 1),
    };
    question.codeContainer = {
      clearRunOutput: vi.fn(),
    };
    question.getContainer = vi.fn(() => {
      const container = document.createElement('div');
      const button = document.createElement('button');
      button.className = 'h5p-question-check-answer';
      button.textContent = 'Check Answer';
      container.appendChild(button);
      return container;
    });
    question.getTestRuntimeFactory = vi.fn(() => ({ create: () => runtime }));
    question.sendAttemptedEvent = vi.fn();
    question.applyScoreFeedback = vi.fn();
    question.sendAnsweredEvent = vi.fn();
    question.scheduleEvaluationFrameSync = vi.fn();

    await question.checkAction();

    expect(question.codeContainer.clearRunOutput).toHaveBeenCalledTimes(1);
  });

  it('syncs iframe height after evaluation in framed mode', async () => {
    vi.useFakeTimers();

    const question = new CodeQuestion({}, 1);
    const originalWindow = globalThis.window;
    const iframeStyle = {};

    globalThis.window = {
      ...originalWindow,
      H5P: {
        isFramed: true,
        externalEmbed: false,
      },
      frameElement: {
        style: iframeStyle,
      },
    };

    Object.defineProperty(globalThis.document.body, 'scrollHeight', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(globalThis.document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 630,
    });

    question.resizeActionHandler = vi.fn();

    try {
      question.scheduleEvaluationFrameSync();
      await vi.runAllTimersAsync();

      expect(iframeStyle.height).toBe('640px');
      expect(question.resizeActionHandler).not.toHaveBeenCalled();
    }
    finally {
      globalThis.window = originalWindow;
      vi.useRealTimers();
    }
  });

  it('syncs framed height after dom registration and on window resize', async () => {
    vi.useFakeTimers();

    const question = new CodeQuestion({}, 1);
    const originalWindow = globalThis.window;
    const iframeStyle = {};
    const resizeListeners = new Set();
    const resizeObserverInstances = [];
    class ResizeObserverMock {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        resizeObserverInstances.push(this);
      }
    }

    globalThis.window = {
      ...originalWindow,
      H5P: {
        isFramed: true,
        externalEmbed: false,
      },
      frameElement: {
        style: iframeStyle,
      },
      addEventListener: vi.fn((event, listener) => {
        if (event === 'resize') {
          resizeListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn((event, listener) => {
        if (event === 'resize') {
          resizeListeners.delete(listener);
        }
      }),
      ResizeObserver: ResizeObserverMock,
    };

    Object.defineProperty(globalThis.document.body, 'scrollHeight', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(globalThis.document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 630,
    });

    question.contentType = 'text_only';
    question.setContent = vi.fn();

    try {
      question.registerDomElements();
      await vi.runAllTimersAsync();

      expect(iframeStyle.height).toBe('640px');
      expect(globalThis.window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(resizeListeners.size).toBe(1);
      expect(resizeObserverInstances).toHaveLength(1);
      expect(resizeObserverInstances[0].observe).toHaveBeenCalledTimes(3);

      Object.defineProperty(globalThis.document.body, 'scrollHeight', {
        configurable: true,
        value: 780,
      });
      Object.defineProperty(globalThis.document.documentElement, 'scrollHeight', {
        configurable: true,
        value: 760,
      });

      for (const listener of resizeListeners) {
        listener();
      }
      await vi.runAllTimersAsync();

      expect(iframeStyle.height).toBe('780px');

      question.destroy();

      expect(globalThis.window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(resizeListeners.size).toBe(0);
      expect(resizeObserverInstances[0].disconnect).toHaveBeenCalledTimes(1);
    }
    finally {
      globalThis.window = originalWindow;
      vi.useRealTimers();
    }
  });

  it('marks framed evaluation resize suppression as active only during iframe sync', async () => {
    vi.useFakeTimers();

    const question = new CodeQuestion({}, 1);
    const originalWindow = globalThis.window;

    globalThis.window = {
      ...originalWindow,
      H5P: {
        isFramed: true,
        externalEmbed: false,
      },
      frameElement: {
        style: {},
      },
    };

    Object.defineProperty(globalThis.document.body, 'scrollHeight', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(globalThis.document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 630,
    });

    try {
      question.scheduleEvaluationFrameSync();

      expect(question.suppressInternalFrameResizeEvents).toBe(true);

      await vi.runAllTimersAsync();

      expect(question.suppressInternalFrameResizeEvents).toBe(false);
    }
    finally {
      globalThis.window = originalWindow;
      vi.useRealTimers();
    }
  });

  it('normalizes showConsole and enableDueDate flags from params', () => {
    const questionHiddenConsole = new CodeQuestion({
      editorSettings: {
        showConsole: false,
      },
      gradingSettings: {
        dueDateGroup: {
          enableDueDate: true,
        },
      },
    }, 1);

    expect(questionHiddenConsole.hasConsole).toBe(false);
    expect(questionHiddenConsole.enableDueDate).toBe(true);
    expect(questionHiddenConsole.getCodeContainerOptions()).toEqual({ hasConsole: false });

    const questionDefaultConsole = new CodeQuestion({}, 2);
    expect(questionDefaultConsole.hasConsole).toBe(true);
    expect(questionDefaultConsole.enableDueDate).toBe(false);
    expect(questionDefaultConsole.getCodeContainerOptions()).toEqual({ hasConsole: true });
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
    question.removeFeedback = vi.fn();
    question.codeTester = { reset: vi.fn() };
    question.codeContainer = {
      stopSignal: true,
      stop_signal: true,
      run,
    };

    question.runAction();

    expect(question.codeContainer.stopSignal).toBe(false);
    expect(question.codeContainer.stop_signal).toBe(false);
    expect(question.removeFeedback).toHaveBeenCalledTimes(1);
    expect(question.codeTester.reset).toHaveBeenCalledTimes(1);
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

  it('adds the concrete question class to the outer H5P question root', () => {
    const question = new CodeQuestion({}, 1);
    const root = document.createElement('div');
    root.className = 'h5p-question';

    question.contentType = 'text_only';
    question.setContent = vi.fn((content) => {
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'h5p-question-content';
      contentWrapper.append(content);
      root.append(contentWrapper);
    });

    question.registerDomElements();

    expect(root.classList.contains('h5p-codequestion')).toBe(true);
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

  it('renders inline code editor when options.showEditor is true', () => {
    const question = new CodeQuestion({}, 1);
    const inlineContainer = {
      getDOM: () => document.createElement('div'),
    };

    question.getContainerFactory = vi.fn(() => ({
      create: () => inlineContainer,
    }));

    const wrapper = document.createElement('div');
    question.renderCodeContent(wrapper, {
      id: 'inline-1',
      code: 'print(1)',
      options: {
        showEditor: true,
      },
    }, 0);

    expect(question.getContainerFactory).toHaveBeenCalledTimes(1);
    expect(question.codeContainers.get('inline-1')).toBe(inlineContainer);
  });

  it('hides inline code editor when options.showEditor is false', () => {
    const question = new CodeQuestion({}, 1);
    question.getContainerFactory = vi.fn();
    const originalMarkdown = H5P.Markdown;

    H5P.Markdown = class MarkdownMock {
      constructor(markdown) {
        this.markdown = markdown;
      }

      getMarkdownDiv() {
        const pre = document.createElement('pre');
        pre.textContent = this.markdown;
        return pre;
      }
    };

    const wrapper = document.createElement('div');
    try {
      question.renderCodeContent(wrapper, {
        code: 'print(1)',
        options: {
          showEditor: false,
        },
      }, 0);

      expect(question.getContainerFactory).not.toHaveBeenCalled();
      expect(wrapper.querySelector('pre, code')).not.toBeNull();
    }
    finally {
      H5P.Markdown = originalMarkdown;
    }
  });
});