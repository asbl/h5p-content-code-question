import TestResult from './components/results-tester';
import TestCasesView from './components/view-tester';
import TestSession from './components/session-tester';

export default class CodeTester {
  constructor(
    testcases,
    gradingMethod,
    onEvaluateTest,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
  ) {
    if ((this.testcases = null))
      console.error('No Testcases are defined for CodeTester');
    this.testcases = testcases;
    this.gradingMethod = gradingMethod;
    this.onEvaluateTest = onEvaluateTest;
    this.runtimeFactory = runtimeFactory;
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.session = this.sessionFactory(testcases);
    this.results = this.resultFactory();
    this.comparator = this.comparatorFactory();
    this.view = this.viewFactory();
  }

  comparatorFactory() {
    null; // Implemented in subclasses
  }

  /**
   *
   * @returns {TestCasesView} A TestCaseView instance
   */
  viewFactory() {
    return new TestCasesView();
  }

  /**
   *
   * @param {*} testcases
   * @returns {TestSession} A TestSession Instance
   */
  sessionFactory(testcases) {
    return new TestSession(testcases);
  }

  /**
   *
   * @returns {TestResult} A TestResult Instance
   */
  resultFactory() {
    return new TestResult(this.session.countTestCases());
  }

  reset() {
    this.session.reset();
    this.results.reset();
    this.view.resetDOM();
  }

  async evaluateTestCase() {
    const indexNumber = this.session.getCurrentTestCaseIndexNumber();
    const testCase = this.session.getCurrentTestCase();
    const output = this.session.outputs[indexNumber];
    const passed = await this.comparator.compare(indexNumber, testCase, output);
    this.results.setResult(indexNumber, passed);
    this.view.update(indexNumber, output, passed);
  }

  evaluateCompletedTest() {
    this.onEvaluateTest();
  }

  getScore() {
    return this.results.getScore();
  }

  getMaxScore() {
    return this.results.getMaxScore();
  }

  async nextTestCase(codeContainer) {
    if (this.session.hasMoreTestCases()) {
      this.session.nextTestCase();
      const testRuntime = this.runtimeFactory().create();
      testRuntime.setup(codeContainer);
      await testRuntime.run();
    }
    else {
      this.evaluateCompletedTest();
    }
  }

  addOutput(outputText) {
    this.session.addOutput(outputText);
  }
}
