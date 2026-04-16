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
      await this.runSolution();
      await this.prepareForRun();
      await this.runCode(this.getCode());
    }

    /**
     * Executes the reference solution for the current test case,
     * if solution execution is enabled.
     * @returns {Promise<void>}
     */
    async runSolution() {
      if (!this.codeTester.runSolution) return;

      const testCaseIndex = this.codeTester.session.testCaseIndex;
      this.codeTester.view?.setExpectedGenerationState?.(testCaseIndex, true);

      const solutionRuntime = this.createSolutionRuntime();

      try {
        await solutionRuntime.start(this.codeContainer);
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
      await this.codeTester.evaluateTestCase();
      await this.codeTester.nextTestCase(this.codeContainer);
    }

    /**
     * Resets the runtime state.
     * Clears console output, removes canvases, and resets the CodeTester.
     */
    reset() {
      this.codeTester?.reset();
      this._consoleManager?.clear();
    }

    /**
     * Handles input requests from the running program.
     * @returns {Promise<string>} Input value for the current test case
     */
    async inputHandler() {
      const result = Promise.resolve(this.codeTester.session.getInput());
      Promise.resolve(this.codeTester.session.nextInput());
      return result;
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
