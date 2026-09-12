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

  it('shows only "Run" when no grading is configured', () => {
    // "Check answer" would be a no-op without test cases to evaluate against.
    const question = new CodeQuestion({}, 1);

    expect(question.codeTester).toBeNull();
    expect(question.hasRunButton).toBe(true);
    expect(question.hasCheckButton).toBe(false);
  });

  it('shows only "Check answer" once test cases are configured', () => {
    // "Run" executes interactively against whatever the editor currently
    // contains instead of the test cases' input values, which is confusing
    // next to "Check answer" once grading exists.
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'ioTestCases',
      },
    }, 1);

    expect(question.codeTester).not.toBeNull();
    expect(question.hasCheckButton).toBe(true);
    expect(question.hasRunButton).toBe(false);
  });

  it('shows "Check answer" for IDE-only content with grading configured too', () => {
    // Regression test: IDE-only content used to hide "Check answer"
    // unconditionally, which left graded IDE-only assignments with no way
    // to check the answer at all once "Run" was hidden for having grading.
    const question = new CodeQuestion({
      contentType: 'ide_only',
      gradingSettings: {
        gradingMethod: 'ioTestCases',
      },
    }, 1);

    expect(question.codeTester).not.toBeNull();
    expect(question.hasCheckButton).toBe(true);
    expect(question.hasRunButton).toBe(false);
  });

  it('shows only "Run" for IDE-only content without grading configured', () => {
    const question = new CodeQuestion({
      contentType: 'ide_only',
    }, 1);

    expect(question.codeTester).toBeNull();
    expect(question.hasCheckButton).toBe(false);
    expect(question.hasRunButton).toBe(true);
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
      enableDiagnosticLogs: false,
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
    question.showButton = vi.fn();
    question.hideButton = vi.fn();
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

  it('clears a stale execution-error banner before check-answer evaluation starts', async () => {
    // Regression test: checkAction() used to call the non-existent
    // codeContainer.clearRunOutput(), which silently did nothing (optional
    // chaining on an undefined method). A stale "Program could not be run"
    // banner from an earlier manual run therefore kept showing even after a
    // fully correct submission passed the automated tests. checkAction()
    // must instead clear it via the real dismissExecutionError() API.
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
      dismissExecutionError: vi.fn(),
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
    question.showButton = vi.fn();
    question.hideButton = vi.fn();

    await question.checkAction();

    expect(question.codeContainer.dismissExecutionError).toHaveBeenCalledTimes(1);
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
    expect(questionHiddenConsole.getCodeContainerOptions()).toMatchObject({
      hasConsole: false,
      workspaceAutosaveEnabled: false,
    });

    const questionDefaultConsole = new CodeQuestion({}, 2);
    expect(questionDefaultConsole.hasConsole).toBe(true);
    expect(questionDefaultConsole.enableDueDate).toBe(false);
    expect(questionDefaultConsole.getCodeContainerOptions()).toMatchObject({
      hasConsole: true,
      workspaceAutosaveEnabled: false,
    });

    const ideQuestion = new CodeQuestion({ contentType: 'ide_only' }, 3);
    expect(ideQuestion.getCodeContainerOptions()).toMatchObject({
      workspaceAutosaveEnabled: true,
      workspaceAutosaveKey: 'h5p-codequestion:3:pseudocode',
    });
  });

  it('uses the CodeMirror-compatible reset path in resetTask', () => {
    const question = new CodeQuestion({}, 1);
    const setCode = vi.fn();
    const legacySetValue = vi.fn();

    question.defaultCode = 'print(&quot;ok&quot;)';
    question.removeFeedback = vi.fn();
    question.showButton = vi.fn();
    question.hideButton = vi.fn();
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

  it('persists assignment and inline editor workspace snapshots', () => {
    const question = new CodeQuestion({}, 1);
    const assignmentSnapshot = {
      entryFileName: 'main.py',
      activeFileName: 'main.py',
      files: [
        {
          name: 'main.py',
          code: 'print("answer")',
          visible: true,
          editable: true,
          isEntry: true,
        },
      ],
    };
    const inlineSnapshot = {
      entryFileName: 'main.py',
      activeFileName: 'main.py',
      files: [
        {
          name: 'main.py',
          code: 'x = [[blank:1]]',
          visible: true,
          editable: true,
          isEntry: true,
          blankValues: { 1: '5' },
        },
      ],
    };

    question.codeContainer = {
      getWorkspaceSnapshot: vi.fn(() => assignmentSnapshot),
    };
    question.codeContainers.set('inline-1', {
      getWorkspaceSnapshot: vi.fn(() => inlineSnapshot),
    });

    expect(question.getState()).toEqual({
      assignmentState: {
        workspaceSnapshot: assignmentSnapshot,
      },
      contentItemStates: {
        'inline-1': {
          workspaceSnapshot: inlineSnapshot,
        },
      },
    });
  });

  it('does not persist unchanged editor workspace snapshots', () => {
    const question = new CodeQuestion({}, 1);
    const defaultSnapshot = {
      entryFileName: 'main.py',
      activeFileName: 'main.py',
      files: [
        {
          name: 'main.py',
          code: 'print("default")',
          visible: true,
          editable: true,
          isEntry: true,
        },
      ],
    };

    question.codeContainer = {
      getWorkspaceSnapshot: vi.fn(() => defaultSnapshot),
      getDefaultWorkspaceSnapshot: vi.fn(() => defaultSnapshot),
    };

    expect(question.getState()).toBeUndefined();
  });

  it('keeps legacy inline Blockly restore while applying workspace snapshots with precedence', () => {
    const question = new CodeQuestion({}, 1, {
      previousState: {
        contentItemStates: {
          inline: {
            blocklyWorkspaceState: { legacy: true },
            workspaceSnapshot: {
              entryFileName: 'main.py',
              activeFileName: 'main.py',
              files: [
                {
                  name: 'main.py',
                  code: 'print("workspace")',
                  visible: true,
                  editable: true,
                  isEntry: true,
                },
              ],
            },
          },
        },
      },
    });
    const codeContainer = {
      getDOM: vi.fn(() => document.createElement('div')),
    };
    const factory = {
      create: vi.fn(() => codeContainer),
    };
    const target = document.createElement('div');

    question.getContainerFactory = vi.fn(() => factory);
    question.applyContainerState = vi.fn();

    question.renderCodeContent(target, {
      id: 'inline',
      type: 'code',
      code: 'print("default")',
    }, 0);

    expect(question.getContainerFactory).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'print("default")',
      false,
      expect.objectContaining({
        blocklyWorkspaceState: { legacy: true },
      }),
    );
    expect(question.applyContainerState).toHaveBeenCalledWith(
      codeContainer,
      expect.objectContaining({
        workspaceSnapshot: expect.any(Object),
      }),
    );
  });

  it('restores assignment workspace snapshot when creating the main code container', () => {
    const workspaceSnapshot = {
      entryFileName: 'main.py',
      activeFileName: 'main.py',
      files: [
        {
          name: 'main.py',
          code: 'print("restored")',
          visible: true,
          editable: true,
          isEntry: true,
        },
      ],
    };
    const codeContainer = {
      setWorkspaceSnapshot: vi.fn(),
    };
    const question = new CodeQuestion({}, 1, {
      previousState: {
        assignmentState: { workspaceSnapshot },
      },
    });

    question.getContainerFactory = vi.fn(() => ({
      create: () => codeContainer,
    }));

    question.createCodeContainer();

    expect(codeContainer.setWorkspaceSnapshot).toHaveBeenCalledWith(workspaceSnapshot);
    expect(question.codeContainer).toBe(codeContainer);
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

  it('keeps the shared codequestion class when a subtype provides its own class', () => {
    class CustomQuestion extends CodeQuestion {
      getQuestionName() {
        return 'h5p-custom-question';
      }
    }

    const question = new CustomQuestion({}, 1);
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
    expect(root.classList.contains('h5p-custom-question')).toBe(true);
    expect(question.parentDiv.classList.contains('h5p-codequestion')).toBe(true);
    expect(question.parentDiv.classList.contains('h5p-custom-question')).toBe(true);
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

  it('passes shared runtime options to read-only inline code rendering', () => {
    class CustomQuestion extends CodeQuestion {
      getCodingLanguage() {
        return 'python';
      }

      getCodeContainerOptions() {
        return {
          codeMirrorCdnUrl: 'https://cdn.example/codemirror/',
          markdownCdnUrl: 'https://cdn.example/markdown/',
          mermaidCdnUrl: 'https://cdn.example/mermaid/',
        };
      }
    }

    const question = new CustomQuestion({}, 1);
    const originalMarkdown = H5P.Markdown;
    const markdownCalls = [];

    H5P.Markdown = class MarkdownMock {
      constructor(markdown, options) {
        markdownCalls.push({ markdown, options });
      }

      getMarkdownDiv() {
        return document.createElement('div');
      }
    };

    try {
      question.renderCodeContent(document.createElement('div'), {
        code: 'print(1)',
        options: {
          showEditor: false,
        },
      }, 0);

      expect(markdownCalls[0].markdown).toBe('```python\nprint(1)\n```');
      expect(markdownCalls[0].options).toEqual({
        codeMirrorCdnUrl: 'https://cdn.example/codemirror/',
        markdownCdnUrl: 'https://cdn.example/markdown/',
        mermaidCdnUrl: 'https://cdn.example/mermaid/',
      });
    }
    finally {
      H5P.Markdown = originalMarkdown;
    }
  });

  it('shows fallback text and resizes when markdown content rendering fails', async () => {
    const question = new CodeQuestion({}, 1);
    question.resizeActionHandler = vi.fn();
    const container = document.createElement('div');

    question.appendResolvedMarkdown(container, {
      text: 'Visible fallback',
      getMarkdownDiv: () => Promise.reject(new Error('markdown unavailable')),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector('.markdown-fallback')?.textContent).toBe('Visible fallback');
    expect(question.resizeActionHandler).toHaveBeenCalledTimes(1);
  });

  it('uses built-in multiple choice grading without creating a code tester', () => {
    const question = new CodeQuestion({
      contentType: 'text_only',
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'Wrong', correct: false },
            { text: 'Correct', correct: true },
          ],
        },
      },
    }, 1);

    expect(mocks.createTester).not.toHaveBeenCalled();
    expect(question.isMultipleChoiceQuestion()).toBe(true);
    expect(question.codeTester).toBeNull();
    expect(question.hasCheckButton).toBe(true);
    expect(question.hasRunButton).toBe(false);
    expect(question.getMaxScore()).toBe(1);

    question.selectedChoices.add('choice_1');

    expect(question.getScore()).toBe(1);
    expect(question.success()).toBe(true);
  });

  it('disables code-test grading for text-only content defensively', () => {
    const question = new CodeQuestion({
      contentType: 'text_only',
      gradingSettings: {
        gradingMethod: 'ioTestCases',
      },
    }, 1);

    expect(question.gradingMethod).toBeNull();
    expect(question.codeTester).toBeNull();
    expect(question.hasCheckButton).toBe(false);
    expect(question.hasRunButton).toBe(true);
  });

  it('requires an exact selected set for multiple-answer choices', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          allowMultiple: true,
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: true },
            { text: 'C', correct: false },
          ],
        },
      },
    }, 1);

    question.selectedChoices.add('choice_0');
    expect(question.getScore()).toBe(0);

    question.selectedChoices.add('choice_1');
    expect(question.getScore()).toBe(1);

    question.selectedChoices.add('choice_2');
    expect(question.getScore()).toBe(0);
  });

  it('renders multiple choice answers as markdown and restores selected choices', () => {
    const originalMarkdown = H5P.Markdown;
    const markdownCalls = [];
    H5P.Markdown = class MarkdownMock {
      constructor(markdown, options) {
        markdownCalls.push({ markdown, options });
        this.markdown = markdown;
      }

      getMarkdownDiv() {
        const div = document.createElement('div');
        div.textContent = this.markdown;
        return div;
      }
    };

    const question = new CodeQuestion({
      contentType: 'text_only',
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: '```python\nprint(1)\n```', correct: true },
            { text: '```mermaid\nclassDiagram\nA <|-- B\n```', correct: false },
          ],
        },
      },
    }, 1, {
      previousState: {
        selectedChoices: ['choice_0'],
      },
    });
    question.setContent = vi.fn();
    question.addButton = vi.fn();

    try {
      question.registerDomElements();

      const inputs = question.parentDiv.querySelectorAll('.codequestion-multiple-choice input');
      expect(inputs).toHaveLength(2);
      expect(inputs[0].type).toBe('radio');
      expect(inputs[0].checked).toBe(true);
      expect(question.getAnswerGiven()).toBe(true);

      inputs[1].checked = true;
      inputs[1].dispatchEvent(new Event('change'));

      expect(question.getAnswerGiven()).toBe(true);
      expect(question.getSelectedChoiceIds()).toEqual(['choice_1']);
      expect(markdownCalls.map((call) => call.markdown)).toEqual([
        '```python\nprint(1)\n```',
        '```mermaid\nclassDiagram\nA <|-- B\n```',
      ]);
      expect(question.addButton).toHaveBeenCalledWith(
        'check-answer',
        expect.any(String),
        expect.any(Function),
      );
    }
    finally {
      H5P.Markdown = originalMarkdown;
    }
  });

  it('persists multiple choice state and exposes choice xAPI metadata', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          allowMultiple: true,
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
            { text: 'C', correct: true },
          ],
        },
      },
    }, 1);

    question.selectedChoices.add('choice_0');
    question.selectedChoices.add('choice_2');

    expect(question.getState()).toEqual({
      selectedChoices: ['choice_0', 'choice_2'],
    });
    expect(question.buildResultStatement().response).toBe('choice_0[,]choice_2');
    expect(question.getxAPIDefinition()).toMatchObject({
      interactionType: 'choice',
      correctResponsesPattern: ['choice_0[,]choice_2'],
      choices: [
        { id: 'choice_0' },
        { id: 'choice_1' },
        { id: 'choice_2' },
      ],
    });
  });

  it('sends multiple choice answered before completed during check', async () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
          ],
        },
      },
    }, 1);
    const events = [];
    question.sendAttemptedEvent = vi.fn(() => events.push('attempted'));
    question.sendAnsweredEvent = vi.fn(() => events.push('answered'));
    question.sendCompletedEvent = vi.fn(() => events.push('completed'));
    question.applyScoreFeedback = vi.fn();
    question.scheduleEvaluationFrameSync = vi.fn();
    question.showButton = vi.fn();
    question.hideButton = vi.fn();

    await question.checkAction();

    expect(events).toEqual(['attempted', 'answered', 'completed']);
  });

  it('does not expose an empty correct response pattern for invalid multiple choice setup', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'A', correct: false },
            { text: 'B', correct: false },
          ],
        },
      },
    }, 1);

    expect(question.getScore()).toBe(0);
    expect(question.getxAPIDefinition()).toMatchObject({
      interactionType: 'choice',
      correctResponsesPattern: [],
    });
  });

  it('adds a hidden retry button and swaps it in after checking a multiple choice answer', async () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
          ],
        },
      },
    }, 1);

    const addButtonCalls = [];
    question.addButton = vi.fn((id, text, clicked, visible) => {
      addButtonCalls.push({ id, visible });
    });
    question.showButton = vi.fn();
    question.hideButton = vi.fn();
    question.sendAttemptedEvent = vi.fn();
    question.sendAnsweredEvent = vi.fn();
    question.sendCompletedEvent = vi.fn();
    question.applyScoreFeedback = vi.fn();
    question.scheduleEvaluationFrameSync = vi.fn();

    question.addButtons();

    expect(addButtonCalls).toContainEqual({ id: 'retry', visible: false });

    await question.checkAction();

    expect(question.hideButton).toHaveBeenCalledWith('check-answer');
    expect(question.showButton).toHaveBeenCalledWith('retry');
  });

  it('does not add a retry button when behaviour.enableRetry is disabled', () => {
    const question = new CodeQuestion({
      behaviour: { enableRetry: false },
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
          ],
        },
      },
    }, 1);

    question.addButton = vi.fn();

    question.addButtons();

    expect(question.addButton).not.toHaveBeenCalledWith(
      'retry',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('marks selected multiple choice options as correct/incorrect and locks them after checking', async () => {
    const originalMarkdown = H5P.Markdown;
    H5P.Markdown = class MarkdownMock {
      constructor(markdown) {
        this.markdown = markdown;
      }

      getMarkdownDiv() {
        const div = document.createElement('div');
        div.textContent = this.markdown;
        return div;
      }
    };

    try {
      const question = new CodeQuestion({
        contentType: 'text_only',
        gradingSettings: {
          gradingMethod: 'multipleChoice',
          multipleChoice: {
            allowMultiple: true,
            choices: [
              { text: 'A', correct: true },
              { text: 'B', correct: false },
            ],
          },
        },
      }, 1);
      question.setContent = vi.fn();
      question.addButton = vi.fn();
      question.showButton = vi.fn();
      question.hideButton = vi.fn();
      question.removeFeedback = vi.fn();
      question.resizeActionHandler = vi.fn();
      question.sendAttemptedEvent = vi.fn();
      question.sendAnsweredEvent = vi.fn();
      question.sendCompletedEvent = vi.fn();
      question.applyScoreFeedback = vi.fn();
      question.scheduleEvaluationFrameSync = vi.fn();

      question.registerDomElements();

      const options = question.parentDiv.querySelectorAll('.codequestion-choice');
      options[0].querySelector('input').checked = true;
      options[0].querySelector('input').dispatchEvent(new Event('change'));
      options[1].querySelector('input').checked = true;
      options[1].querySelector('input').dispatchEvent(new Event('change'));

      await question.checkAction();

      expect(options[0].classList.contains('codequestion-choice--correct')).toBe(true);
      expect(options[1].classList.contains('codequestion-choice--incorrect')).toBe(true);
      expect(question.multipleChoiceFieldset.disabled).toBe(true);

      question.resetTask();

      expect(question.multipleChoiceFieldset.disabled).toBe(false);
      expect(options[0].classList.contains('codequestion-choice--correct')).toBe(false);
      expect(options[1].classList.contains('codequestion-choice--incorrect')).toBe(false);
    }
    finally {
      H5P.Markdown = originalMarkdown;
    }
  });

  it('keeps the original answer order when shuffling is disabled', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
          ],
        },
      },
    }, 1);

    expect(question.getDisplayedChoices().map((choice) => choice.id)).toEqual([
      'choice_0',
      'choice_1',
    ]);
  });

  it('shuffles the multiple choice display order without changing choice identity', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'multipleChoice',
        multipleChoice: {
          shuffleAnswers: true,
          choices: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
            { text: 'C', correct: false },
          ],
        },
      },
    }, 1);

    const displayedIds = question.getDisplayedChoices().map((choice) => choice.id);

    expect(displayedIds.slice().sort()).toEqual(['choice_0', 'choice_1', 'choice_2']);
    // Correctness/xAPI reporting must stay tied to the original id, not the
    // shuffled display position.
    expect(question.getCorrectChoiceIds()).toEqual(['choice_0']);
  });

  it('warns when no answer option is marked correct', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const question = new CodeQuestion({
        gradingSettings: {
          gradingMethod: 'multipleChoice',
          multipleChoice: {
            choices: [
              { text: 'A', correct: false },
              { text: 'B', correct: false },
            ],
          },
        },
      }, 1);

      expect(question.isMultipleChoiceQuestion()).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('never be answered correctly'));
    }
    finally {
      warnSpy.mockRestore();
    }
  });

  it('warns when a single-answer multiple choice question marks several options as correct', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const question = new CodeQuestion({
        gradingSettings: {
          gradingMethod: 'multipleChoice',
          multipleChoice: {
            allowMultiple: false,
            choices: [
              { text: 'A', correct: true },
              { text: 'B', correct: true },
            ],
          },
        },
      }, 1);

      expect(question.isMultipleChoiceQuestion()).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Allow multiple correct answers'),
      );
    }
    finally {
      warnSpy.mockRestore();
    }
  });

  it('uses built-in sort grading without creating a code tester', () => {
    const question = new CodeQuestion({
      contentType: 'text_only',
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
            { text: 'Third' },
          ],
        },
      },
    }, 1);

    expect(mocks.createTester).not.toHaveBeenCalled();
    expect(question.isSortQuestion()).toBe(true);
    expect(question.codeTester).toBeNull();
    expect(question.hasCheckButton).toBe(true);
    expect(question.hasRunButton).toBe(false);
    expect(question.getMaxScore()).toBe(1);
    expect(question.currentSortOrder.sort()).toEqual(['item_0', 'item_1', 'item_2']);
  });

  it('requires the exact original order for sort grading', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
            { text: 'Third' },
          ],
        },
      },
    }, 1);

    question.currentSortOrder = ['item_0', 'item_2', 'item_1'];
    expect(question.getScore()).toBe(0);
    expect(question.success()).toBe(false);

    question.currentSortOrder = ['item_0', 'item_1', 'item_2'];
    expect(question.getScore()).toBe(1);
    expect(question.success()).toBe(true);
  });

  it('renders sort items as markdown and allows reordering via move buttons', () => {
    const originalMarkdown = H5P.Markdown;
    H5P.Markdown = class MarkdownMock {
      constructor(markdown) {
        this.markdown = markdown;
      }

      getMarkdownDiv() {
        const div = document.createElement('div');
        div.textContent = this.markdown;
        return div;
      }
    };

    const question = new CodeQuestion({
      contentType: 'text_only',
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
            { text: 'Third' },
          ],
        },
      },
    }, 1);
    // Pin a deterministic initial order for the assertions below.
    question.currentSortOrder = ['item_0', 'item_1', 'item_2'];
    question.setContent = vi.fn();
    question.addButton = vi.fn();

    try {
      question.registerDomElements();

      const items = question.parentDiv.querySelectorAll('.codequestion-sort-item');
      expect(items).toHaveLength(3);
      expect(question.getAnswerGiven()).toBe(false);

      items[0].querySelector('.codequestion-sort-item__move--down').click();

      expect(question.currentSortOrder).toEqual(['item_1', 'item_0', 'item_2']);
      expect(question.getAnswerGiven()).toBe(true);

      const reorderedItems = question.parentDiv.querySelectorAll('.codequestion-sort-item');
      expect(reorderedItems[0].dataset.itemId).toBe('item_1');
      expect(reorderedItems[1].dataset.itemId).toBe('item_0');
    }
    finally {
      H5P.Markdown = originalMarkdown;
    }
  });

  it('persists sort order state and exposes sequencing xAPI metadata', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
          ],
        },
      },
    }, 1);

    question.currentSortOrder = ['item_1', 'item_0'];
    question.answerGiven = true;

    expect(question.getState()).toEqual({
      sortOrder: ['item_1', 'item_0'],
    });
    expect(question.buildResultStatement().response).toBe('item_1[,]item_0');
    expect(question.getxAPIDefinition()).toMatchObject({
      interactionType: 'sequencing',
      correctResponsesPattern: ['item_0[,]item_1'],
      choices: [
        { id: 'item_0' },
        { id: 'item_1' },
      ],
    });
  });

  it('sends sort answered before completed during check', async () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
          ],
        },
      },
    }, 1);
    const events = [];
    question.sendAttemptedEvent = vi.fn(() => events.push('attempted'));
    question.sendAnsweredEvent = vi.fn(() => events.push('answered'));
    question.sendCompletedEvent = vi.fn(() => events.push('completed'));
    question.applyScoreFeedback = vi.fn();
    question.scheduleEvaluationFrameSync = vi.fn();
    question.showButton = vi.fn();
    question.hideButton = vi.fn();

    await question.checkAction();

    expect(events).toEqual(['attempted', 'answered', 'completed']);
  });

  it('restores a valid persisted sort order across reloads', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
            { text: 'Third' },
          ],
        },
      },
    }, 1, {
      previousState: {
        sortOrder: ['item_2', 'item_0', 'item_1'],
      },
    });

    expect(question.currentSortOrder).toEqual(['item_2', 'item_0', 'item_1']);
    expect(question.getAnswerGiven()).toBe(true);
  });

  it('falls back to a fresh shuffle when the persisted sort order no longer matches the items', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
            { text: 'Third' },
          ],
        },
      },
    }, 1, {
      previousState: {
        // Stale: missing item_2, e.g. items were edited after the learner started.
        sortOrder: ['item_0', 'item_1'],
      },
    });

    expect(question.currentSortOrder.slice().sort()).toEqual(['item_0', 'item_1', 'item_2']);
  });

  it('re-shuffles the sort order and clears feedback on retry', () => {
    const question = new CodeQuestion({
      gradingSettings: {
        gradingMethod: 'sortItems',
        sortItems: {
          items: [
            { text: 'First' },
            { text: 'Second' },
          ],
        },
      },
    }, 1);
    question.showButton = vi.fn();
    question.hideButton = vi.fn();
    question.removeFeedback = vi.fn();
    question.resizeActionHandler = vi.fn();

    question.currentSortOrder = ['item_0', 'item_1'];
    question.answerGiven = true;
    question.setSortLocked(true);

    question.resetTask();

    expect(question.answerGiven).toBe(false);
    expect(question.currentSortOrder.slice().sort()).toEqual(['item_0', 'item_1']);
  });
});
