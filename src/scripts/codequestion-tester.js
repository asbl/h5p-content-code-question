/**
 * A Codetester runs Test against code (usually created by user)
 */
export default class CodeTester {
  constructor(codeQuestion) {
    this.question = codeQuestion;
    this.testcases = this.question.testcases;
    this.checkedTestCases = [];
    this.maxScore = this.testcases.length;
    this.inputCounter = 0;
    this.testCaseCounter = 0;
    this.outputArray = [];
    this.code = "";
    this.l10n = codeQuestion.l10n;
    this.testCasesAreaID = `h5p_testcases_area_${H5P.createUUID()}`;
  }

  getTestCasesArea() {
    return document.getElementById(this.testCasesAreaID);
  }

  startTest() {
    this.inputCounter = 0;
  }

  /**
   * Resets the tester:
   */
  reset() {
    this.question.answerGiven = true;
    this.checkedTestCases = [];
    this.inputCounter = 0;
    this.testCaseCounter = 0;
    this.outputArray = [];
    this.outputArray.push([]);
  }

  /**
   * Increments testCaseCouter and resets InputCounter
   */
  nextTest() {
    this.testCaseCounter = this.testCaseCounter + 1;
    this.inputCounter = 0;
    this.outputArray.push([]); // pushes an empty array to outputArray. The array is filled in addOutput
  }

  /**
   * Adds output from stdout to outputArray
   * Usually overwritten in subclasses.
   * @param {string} outputText stdout as string
   */
  addOutput(outputText) {
    if (!this.outputArray[this.testCaseCounter]) {
      this.outputArray[this.testCaseCounter] = [];
    }
    this.outputArray[this.testCaseCounter].push(outputText);
  }

  setcode(code) {
    this.code = code;
  }
  /**
   * Gets input from testCase, determined by current testCase and inputCounter.
   * @returns {string} The input for the test.
   */
  getInput() {
    const result =
      this.testcases[this.testCaseCounter].inputs[this.inputCounter];
    this.inputCounter++;
    return result;
  }

  /**
   * Generates the testcases-area (after editor) - Called from registerDomElements
   * @returns {HTMLElement} The area for testcases
   */
  generateTestCasesArea() {
    let testCasesArea = document.createElement("div");
    testCasesArea.id = this.testCasesAreaID;
    testCasesArea.classList.add("testcases-area");
    return testCasesArea;
  }

  /**
   * Gets the score for all Testcases as sum from all testCases.
   * Halves the score if due date is set and overdue.
   * @returns {number} Sum of all correct Testcases (possibly halved).
   */
  getScore() {
    // 1. Summe der Testcases berechnen
    let binaryArray = [];
    this.checkedTestCases.forEach(function (element) {
      if (typeof element === "boolean") {
        binaryArray.push(element ? 1 : 0);
      } else {
        binaryArray.push(element);
      }
    });

    let totalScore = binaryArray.reduce((a, b) => a + b, 0);
    return totalScore;
  }

  /**
   * Get max score
   * @returns {number} Max score which can be achived.
   */
  getMaxScore() {
    return this.maxScore;
  }

  /**
   * Updates Testcase-Table
   */
  async updateTestCaseTable() {
    // overwritten in subclasses
  }

  /**
   * Called after a succesfull test.
   * Checks all Testcases and updates TestCaseTable
   */
  async onSuccessTest() {
    this.checkedTestCases[this.testCaseCounter] = await this.checkTestCase();
    await this.updateTestCaseTable(this.testCaseCounter);
  }

  /**
   * Checks if a testcase passes.
   * @returns {boolean} True, if all Tests return True
   */
  async checkTestCase() {
    throw new Error("Implemented in subclasses");
  }

  /**
   * Checks if Testcase with testCaseCounter is the last TestCase in TestSuite.
   * @returns {boolean} true, if TestSuite has more TestCases
   */
  hasMoreTestCases() {
    return this.testCaseCounter < this.testcases.length - 1;
  }

  onError(_errorMessage, _errorInstance) {
    //Implemented in subclasses
  }
}
