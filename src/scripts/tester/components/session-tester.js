/**
 * Manages the execution of a sequence of test cases within a test session.
 * Tracks the current test case, input consumption, and produced outputs.
 */
export default class TestSession {
  /**
   * Creates a new TestSession instance.
   * @param {object[]} testcases - The list of test cases to execute.
   * Each test case is expected to provide an `inputs` array.
   */
  constructor(testcases) {
    /**
     * All test cases belonging to this session.
     * @type {object[]}
     */
    this.testcases = Array.isArray(testcases) ? testcases : [];

    /**
     * Index of the currently active test case.
     * @type {number}
     */
    this.testCaseIndex = 0;

    /**
     * Index of the next input to be consumed within the current test case.
     * @type {number}
     */
    this.inputIndex = 0;

    /**
     * Collected outputs per test case.
     * Each entry in the outer array corresponds to one test case.
     * @type {string[][]}
     */
    this.outputs = [[]];

    // Initialize the session state
    this.reset();
  }

  /**
   * Returns the total number of test cases in this session.
   * @returns {number} The number of test cases.
   */
  countTestCases() {
    return this.testcases.length;
  }

  /**
   * Resets the session to its initial state.
   * Starts again from the first test case and clears all outputs.
   * @returns {void}
   */
  reset() {
    this.testCaseIndex = 0;
    this.inputIndex = 0;
    this.outputs = this.testcases.map(() => []);
  }

  /**
   * Advances to the next test case.
   * @throws {Error} If no further test cases are available.
   * @returns {void}
   */
  nextTestCase() {
    if (!this.hasMoreTestCases()) {
      throw new Error('No more testcases');
    }
    this.testCaseIndex++;
    this.inputIndex = 0;
  }

  /**
   * Returns the actual input value for the current test case.
   * Advances the internal input pointer.
   * @throws {Error} If no further input is available for the current test case.
   * @returns {*} The next input value.
   */
  getInput() {
    const testCase = this.testcases[this.testCaseIndex];

    if (!testCase || !Array.isArray(testCase.inputs) || this.inputIndex >= testCase.inputs.length) {
      throw new Error('No more input for testcase');
    }

    return testCase.inputs[this.inputIndex];
  }

  nextInput() {
    this.inputIndex++;
  }


  /**
   * Records an output value for the current test case.
   * @param {*} text - The output to record. It will be converted to a string.
   * @returns {void}
   */
  addOutput(text) {
    this.outputs[this.testCaseIndex].push(String(text));
  }

  /**
   * Returns the currently active test case.
   * @returns {object} The current test case.
   */
  getCurrentTestCase() {
    return this.testcases[this.testCaseIndex];
  }

  /**
   *
   * @returns The index-number of the current test case.
   */
  getCurrentTestCaseIndexNumber() {
    return this.testCaseIndex;
  }

  /**
   * Indicates whether more test cases are available after the current one.
   * @returns {boolean} `true` if another test case exists, otherwise `false`.
   */
  hasMoreTestCases() {
    return this.testCaseIndex < this.testcases.length - 1;
  }
}
