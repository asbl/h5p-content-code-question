import ImageTesterView from './view-tester-image';
import { ImageTestCaseComparator } from './comparator-image';
import CodeTester from '../tester';

/**
 * @class ImageTester
 * @augments CodeTester
 * @description Core class for running image-based test cases in coding exercises.
 * Handles test execution, outputs, and delegates DOM rendering and comparison to submodules.
 */
export default class ImageTester extends CodeTester {
  constructor(
    testcases,
    gradingMethod,
    onEvaluateTest,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    solutionCode,
  ) {
    super(
      testcases,
      gradingMethod,
      onEvaluateTest,
      runtimeFactory,
      l10n,
      dueDate,
      enableDueDate,
    );
    this.runSolution = true;
    this.solutionCode = solutionCode;
  }

  comparatorFactory() {
    const getOutputCanvas = (testCaseIndex) => {
      return this.view.mergeOutputImage(testCaseIndex);
    };
    const getExpectedCanvas = (testCaseIndex) => {
      return this.view.mergeExpectedImage(testCaseIndex);
    };
    return new ImageTestCaseComparator(
      getOutputCanvas,
      getExpectedCanvas,
    );
  }

  viewFactory() {
    return new ImageTesterView(
      this.l10n,
      this.session,
      this.results,
      this.dueDate,
      this.enableDueDate,
    );
  }
}
