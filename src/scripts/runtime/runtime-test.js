const DEBUG_PREFIX = 'Test runtime:';

function normalizeInputValue(value) {
  return value == null ? '' : String(value);
}

/**
 * Mixin that adds test execution behavior to a runtime.
 *
 * Responsibilities:
 * - Orchestrates solution execution before student code
 * - Manages test lifecycle (setup, run, reset)
 * - Integrates with CodeTester for inputs, outputs, and evaluation
 *
 * This mixin is runtime-agnostic and must be combined with
 * a concrete language/runtime implementation.
 * @template TBase
 * @param {TBase} Base - Base runtime class to extend
 * @returns {TBase} Extended runtime class with test functionality
 */
export const TestRuntimeMixin = (Base) =>
  class extends Base {
    /**
     * @param {function} resizeActionHandler - Callback for resize actions
     * @param {string} solutionCode - Reference solution source code
     * @param {object} codeTester - Test case controller and evaluator
     * @param {object} options - Runtime options
     */
    constructor(resizeActionHandler, solutionCode, codeTester, options) {
      super(resizeActionHandler, solutionCode, options);
      this.solutionCode = solutionCode;
      this.codeTester = codeTester;
      this.type = 'Test runtime';
      this.solutions = [];
      this.options = options;
    }

    /**
     * Executes the test run.
     *
     * Order of execution:
     * 1. Run reference solution (optional)
     * 2. Prepare runtime for test execution
     * 3. Run student code
     * @returns {Promise<void>}
     */
    async run() {
      const testCaseIndex = this.codeTester?.session?.testCaseIndex;
      console.warn(DEBUG_PREFIX, 'run start', { testCaseIndex, phase: 'solution' });

      await this.runSolution();
      console.warn(DEBUG_PREFIX, 'run', { testCaseIndex, phase: 'solution done' });

      this.codeTester?.session?.resetCurrentTestCaseInputs?.();
      await this.prepareForRun();
      console.warn(DEBUG_PREFIX, 'run', { testCaseIndex, phase: 'prepared, running learner code' });

      await this.runCode(this.getCode());
      console.warn(DEBUG_PREFIX, 'run', { testCaseIndex, phase: 'learner code call returned' });
    }

    /**
     * Executes the reference solution for the current test case,
     * if solution execution is enabled.
     * @returns {Promise<void>}
     */
    async runSolution() {
      if (!this.codeTester.runSolution) {
        console.warn(DEBUG_PREFIX, 'runSolution skipped', { runSolution: this.codeTester.runSolution });
        return;
      }

      const testCaseIndex = this.codeTester.session.testCaseIndex;
      const startedAt = Date.now();
      console.warn(DEBUG_PREFIX, 'runSolution start', { testCaseIndex, startedAt });

      this.codeTester.view?.setExpectedGenerationState?.(testCaseIndex, true);

      const solutionRuntime = this.createSolutionRuntime();

      try {
        await solutionRuntime.start(this.codeContainer);
        console.warn(DEBUG_PREFIX, 'runSolution finished', {
          testCaseIndex,
          durationMs: Date.now() - startedAt,
        });
      }
      finally {
        this.codeTester.view?.setExpectedGenerationState?.(testCaseIndex, false);
      }
    }

    /**
     * Hook called before executing student code.runCode(
     * Intended to be overridden by concrete runtimes.
     */
    prepareForRun() { }

    /**
     * Handles program output produced during execution.
     * Intended to be overridden by concrete runtimes.
     * @param {string} _text - Output text
     */
    outputHandler(_text) { }

    /**
     * Called after successful execution of a test case.
     * Triggers evaluation and advances to the next test case.
     * @returns {Promise<void>}
     */
    async onSuccess() {
      console.warn(DEBUG_PREFIX, 'onSuccess', { testCaseIndex: this.codeTester?.session?.testCaseIndex });
      await this.codeTester.evaluateTestCase();
      await this.codeTester.nextTestCase(this.codeContainer);
    }

    onError(error) {
      console.warn(DEBUG_PREFIX, 'onError before comparison', {
        testCaseIndex: this.codeTester?.session?.testCaseIndex,
        inputIndex: this.codeTester?.session?.inputIndex,
        error,
      });

      super.onError?.(error);
    }

    /**
     * Resets the runtime state.
     * Clears console output, removes canvases, and resets the CodeTester.
     */
    reset() {
      console.warn(DEBUG_PREFIX, 'reset', { testCaseIndex: this.codeTester?.session?.testCaseIndex });
      this.codeTester?.reset();
      this._consoleManager?.clear();
    }

    /**
     * Handles input requests from the running program.
     * @returns {Promise<string>} Input value for the current test case
     */
    async inputHandler() {
      const session = this.codeTester.session;
      const testCaseIndex = session.testCaseIndex;
      const inputIndex = session.inputIndex;
      const rawValue = session.getInput();
      const value = normalizeInputValue(rawValue);

      console.warn(DEBUG_PREFIX, 'input', {
        testCaseIndex,
        inputIndex,
        rawValue,
        rawValueType: typeof rawValue,
        value,
        isEmptyString: value === '',
      });

      if (value === '') {
        console.warn(DEBUG_PREFIX, 'empty input may break int(input())', {
          testCaseIndex,
          inputIndex,
        });
      }

      Promise.resolve(session.nextInput());
      return Promise.resolve(value);
    }

    /**
     * Creates a runtime instance used to execute the reference solution.
     * Must be implemented by the concrete test runtime.
     * @abstract
     * @returns {object} Solution runtime instance
     */
    createSolutionRuntime() {
      throw new Error('createSolutionRuntime not implemented');
    }

    async start(codeContainer) {
      this.setup(codeContainer);
      this.reset();
      this.init();
      await this.run();
    }
  };
