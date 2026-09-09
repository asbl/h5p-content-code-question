import TestResult from './components/results-tester';
import TestCasesView from './components/view-tester';
import TestSession from './components/session-tester';
import { logCodeQuestionDiagnostic } from '../services/codequestion-diagnostics';

const DEBUG_PREFIX = 'Code tester:';

export default class CodeTester {
  constructor(
    testcases,
    gradingMethod,
    onEvaluateTest,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    _solutionCode,
    _functionName,
    algorithmConstraints = {},
    algorithmTrace = {},
    options = {},
  ) {
    const normalizedTestcases = Array.isArray(testcases) ? testcases : [];

    if (!Array.isArray(testcases)) {
      console.error('No Testcases are defined for CodeTester');
    }

    this.testcases = normalizedTestcases;
    this.gradingMethod = gradingMethod;
    this.onEvaluateTest = onEvaluateTest;
    this.runtimeFactory = runtimeFactory;
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.algorithmConstraints = algorithmConstraints || {};
    this.algorithmConstraintResult = null;
    this.algorithmTrace = algorithmTrace || {};
    this.algorithmTraceEvents = [];
    this.options = options || {};
    this.session = this.sessionFactory(this.testcases);
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
    this.lastComparison = null;
    this.algorithmConstraintResult = null;
    this.algorithmTraceEvents = [];
    this.view.resetDOM();
  }

  async evaluateTestCase() {
    const indexNumber = this.session.getCurrentTestCaseIndexNumber();
    const testCase = this.session.getCurrentTestCase();
    const output = this.session.outputs[indexNumber];
    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'evaluate test case', {
      indexNumber,
      gradingMethod: this.gradingMethod,
      inputCount: Array.isArray(testCase?.inputs) ? testCase.inputs.length : null,
      outputCount: Array.isArray(output) ? output.length : null,
      hasComparator: !!this.comparator,
      comparatorType: this.comparator?.constructor?.name,
    });

    const testPassed = await this.comparator.compare(indexNumber, testCase, output);
    const constraintsPassed = !this.hasAlgorithmConstraints()
      || this.algorithmConstraintResult?.passed === true;
    const passed = testPassed && constraintsPassed;
    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'test case result', {
      indexNumber,
      testPassed,
      constraintsPassed,
      passed,
    });

    this.results.setResult(indexNumber, passed);
    this.view.update(indexNumber, output, passed);
  }

  evaluateCompletedTest() {
    this.onEvaluateTest();
  }

  getScore() {
    return this.results.getFullCompletedScore();
  }

  getMaxScore() {
    return this.results.getMaxScore();
  }

  async nextTestCase(codeContainer) {
    if (this.session.hasMoreTestCases()) {
      this.session.nextTestCase();
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'next test case', {
        indexNumber: this.session.getCurrentTestCaseIndexNumber(),
      });

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

  hasAlgorithmConstraints() {
    const constraints = this.algorithmConstraints;
    return constraints.requireRecursion === true
      || constraints.requireBaseCase === true
      || Number(constraints.maxRecursiveCalls) > 0
      || constraints.requiredLoop === 'any'
      || constraints.requiredLoop === 'for'
      || constraints.requiredLoop === 'while'
      || Number(constraints.maxLoopCount) > 0
      || Number(constraints.maxLoopNesting) > 0
      || constraints.requireConditional === true
      || constraints.requireReturn === true
      || constraints.forbidTopLevelAssignments === true
      || String(constraints.forbiddenCalls || '').trim() !== ''
      || (Array.isArray(constraints.requiredDataStructures) && constraints.requiredDataStructures.length > 0)
      || (Array.isArray(constraints.forbiddenDataStructures) && constraints.forbiddenDataStructures.length > 0)
      || String(constraints.requiredDataStructures || '').trim() !== ''
      || String(constraints.forbiddenDataStructures || '').trim() !== ''
      || String(constraints.requiredClassNames || '').trim() !== ''
      || String(constraints.forbiddenClassNames || '').trim() !== ''
      || String(constraints.requiredMethodNames || '').trim() !== ''
      || String(constraints.requiredInstanceAttributes || '').trim() !== ''
      || constraints.requireConstructor === true
      || constraints.requireObjectInstantiation === true
      || constraints.requireInheritance === true
      || constraints.forbidInheritance === true;
  }

  setAlgorithmConstraintResult(result) {
    this.algorithmConstraintResult = result;
    this.view?.setAlgorithmConstraintResult?.(result);
  }

  hasAlgorithmTrace() {
    return this.algorithmTrace?.enabled === true && this.algorithmTrace?.traceType === 'array';
  }

  addAlgorithmTraceEvent(event) {
    this.algorithmTraceEvents.push(event);
    this.view?.setAlgorithmTraceEvents?.(this.algorithmTraceEvents);
  }
}
