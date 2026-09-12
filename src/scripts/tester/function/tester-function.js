import CodeTester from '../tester.js';
import FunctionTesterView from './view-tester-function.js';

const RESULT_PREFIX = '__H5P_FUNCTION_TEST_RESULT__:';
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const getRandomToken = () => (
  globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
);

const toPythonLiteral = (value) => {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${toPythonLiteral(item)}`)
      .join(', ')}}`;
  }
  throw new Error('Unsupported JSON value');
};

/**
 * Tests a callable supplied by the learner instead of its standard output.
 *
 * The language runtime adds the test harness returned by getTestCode() to the
 * learner source. Keeping the comparison inside that runtime means that Python
 * literals such as lists, dictionaries and None retain their native meaning.
 */
export default class FunctionTester extends CodeTester {
  constructor(...args) {
    const functionName = args[8];
    super(...args);
    this.functionName = String(functionName || '');
    this.view.functionName = this.functionName;
    this.resultToken = null;
    this.resultTokens = new Map();
  }

  comparatorFactory() {
    return {
      compare: (_index, _testCase, output) => (
        output.length === 1 && output[0]?.status === 'passed'
      ),
    };
  }

  viewFactory() {
    return new FunctionTesterView(
      this.l10n,
      this.session,
      this.functionName,
      this.dueDate,
      this.enableDueDate,
    );
  }

  reset() {
    super.reset();
    this.resultToken = null;
    this.resultTokens.clear();
  }

  /**
   * Stores only the dedicated harness result. Learner print statements must
   * not influence function-test grading.
   * @param {*} outputText - Runtime output.
   */
  addOutput(outputText) {
    const text = String(outputText ?? '').trim();
    if (!text.startsWith(RESULT_PREFIX)) return;

    const [token, status, ...detailParts] = text.slice(RESULT_PREFIX.length).split(':');
    const index = this.resultTokens.get(token);
    if (!token || (index === undefined && token !== this.resultToken)) return;

    if (!['passed', 'failed', 'error', 'configuration'].includes(status)) return;

    const testCaseIndex = index ?? this.session.testCaseIndex;
    const output = [{
      status,
      detail: detailParts.join(':').slice(0, 500),
    }];
    this.session.outputs[testCaseIndex] = output;

    const testPassed = status === 'passed';
    const constraintsPassed = !this.hasAlgorithmConstraints()
      || this.algorithmConstraintResult?.passed === true;
    const passed = testPassed && constraintsPassed;
    const reason = !testPassed
      ? { type: 'functionResultMismatch', status, detail: output[0].detail }
      : (!constraintsPassed ? this.getAlgorithmConstraintMismatchReason() : null);

    this.results.setResult(testCaseIndex, passed);
    this.view.update(testCaseIndex, output, passed, reason);
  }

  getTestCaseValues(testCase) {
    const values = [
      ...(Array.isArray(testCase.arguments) ? testCase.arguments : []),
    ].map((argument) => String(argument?.argument ?? argument ?? '').trim());
    const expected = String(testCase.expectedResult ?? '').trim();

    if (!IDENTIFIER_PATTERN.test(this.functionName)) {
      throw new Error('Configure a valid Python function name.');
    }
    if (!expected) {
      throw new Error('Configure an expected result as JSON.');
    }

    try {
      return {
        argumentsCode: values.map((value) => toPythonLiteral(JSON.parse(value))).join(', '),
        expectedCode: toPythonLiteral(JSON.parse(expected)),
      };
    }
    catch {
      throw new Error('Arguments and expected result must be valid JSON values.');
    }
  }

  /**
   * Returns Python source that invokes the configured function for the active
   * test case. Arguments and expected result are author-entered JSON values
   * that are converted into equivalent Python literals before execution.
   * @param {string} learnerCode - Current learner source.
   * @returns {string} Learner source with a test harness appended.
   */
  getTestCode(learnerCode) {
    const testCase = this.session.getCurrentTestCase() || {};
    this.resultToken = getRandomToken();
    this.resultTokens.set(this.resultToken, this.session.getCurrentTestCaseIndexNumber());
    const functionName = JSON.stringify(String(this.functionName || ''));
    const marker = JSON.stringify(`${RESULT_PREFIX}${this.resultToken}:`);

    let values;
    try {
      values = this.getTestCaseValues(testCase);
    }
    catch (error) {
      return `print(${marker} + 'configuration:' + ${JSON.stringify(error.message)})\n`;
    }

    return `${String(learnerCode || '')}\n\n# H5P function-test harness\n__h5p_emit = print\ntry:\n    __h5p_function = globals()[${functionName}]\n    __h5p_actual = __h5p_function(${values.argumentsCode})\n    __h5p_expected = ${values.expectedCode}\n    __h5p_emit(${marker} + ('passed:' if __h5p_actual == __h5p_expected else 'failed:') + repr(__h5p_actual))\nexcept Exception as __h5p_error:\n    __h5p_emit(${marker} + 'error:' + type(__h5p_error).__name__)\n`;
  }
}
