/**
 * Mixin that adds solution execution behavior to a Python runtime.
 *
 * Responsibilities:
 * - Executes Python solution code per test case
 * - Tracks which test cases have already been run
 * - Writes solution output to console
 *
 * Note: Canvas setup is language-specific and should remain in the concrete class.
 * @template TBase
 * @param {TBase} Base - Python runtime class to extend
 * @returns {TBase} Extended runtime class with solution behavior
 */
export const SolutionRuntimeMixin = (Base) =>
  class extends Base {
    /**
     * @param {function} resizeActionHandler - Callback for resize actions
     * @param {string} solutionCode - Python code for the solution
     * @param {object} codeTester - Object managing test cases
     * @param {object} options - Runtime options
     */
    constructor(resizeActionHandler, solutionCode, codeTester, options) {
      super(resizeActionHandler, solutionCode, options);
      this.codeTester = codeTester;
      this.type = 'Solution runtime';
      this.solutions = [];
    }

    /**
     * Executes the solution runtime for the current test case.
     * @returns {Promise<void>}
     */
    async run() {
      await this.runCode(this.getCode());
      this.resizeActionHandler();
    }

    /**
     * Returns the code to execute.
     * @returns {string}
     */
    getCode() {
      return this.code;
    }

    /**
     * Initializes runtime once per test case.
     * @param {object} codeContainer - Container for code and output
     */
    setup(codeContainer) {
      super.setup(codeContainer);

      const testCaseIndex = this.codeTester.testCaseCounter;
      if (this.solutions[testCaseIndex] === true) return;

      this.solutions[testCaseIndex] = true;
    }

    /**
     * Handles solution output and writes it to the console.
     * @param {string} text - Output text
     */
    outputHandler(text) {
      if (!this._consoleManager) return;

      const testCaseIndex = this.codeTester.session.testCaseIndex;
      this._consoleManager.write(text, `Solution: ${testCaseIndex + 1}`);
    }

    /**
     * Handles input requests from the running program.
     * @returns {Promise<string>} Input value for the current test case
     */
    async inputHandler() {
      return Promise.resolve(this.codeTester.session.getInput());
    }

    async start(codeContainer) {
      this.setup(codeContainer);
      this.init();
      this.prepareForRun();
      await this.run();
    }
  };
