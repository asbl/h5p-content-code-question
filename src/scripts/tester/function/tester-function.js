import CodeTester from '../tester.js';
import FunctionTesterView from './view-tester-function.js';
import { normalizeFunctionTestValue, toPythonLiteral } from '../../services/function-test-values.js';

const RESULT_PREFIX = '__H5P_FUNCTION_TEST_RESULT__:';
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const getRandomToken = () => (
  globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
);

/**
 * Builds Python source that, after the learner's code, calls the function with
 * the visible test cases and prints each call with its result. It is used by
 * the plain "Run" button so learners can try their function without grading.
 * @param {string} learnerCode Current learner source.
 * @param {object} options Options.
 * @param {string} options.functionName Name of the function under test.
 * @param {Array} options.testcases Configured test cases.
 * @param {string} [options.heading] Line printed before the calls.
 * @param {number} [options.maxCalls] Maximum number of calls.
 * @returns {string|null} Source to run, or null if no trial applies.
 */
export function buildFunctionTrialCode(learnerCode, { functionName, testcases, heading = '', maxCalls = 5 } = {}) {
  const name = String(functionName || '');
  const source = String(learnerCode || '');
  if (!IDENTIFIER_PATTERN.test(name) || !new RegExp(`^\\s*def\\s+${name}\\s*\\(`, 'm').test(source)) {
    return null;
  }

  const calls = (Array.isArray(testcases) ? testcases : [])
    .filter((testCase) => testCase && testCase.hidden !== true)
    .slice(0, maxCalls)
    .map((testCase) => {
      try {
        const args = (Array.isArray(testCase.arguments) ? testCase.arguments : [])
          .map((argument) => toPythonLiteral(JSON.parse(normalizeFunctionTestValue(argument?.argument ?? argument))))
          .join(', ');
        return `${name}(${args})`;
      }
      catch {
        return null;
      }
    })
    .filter(Boolean);

  if (calls.length === 0) {
    return null;
  }

  const lines = ['', '', '# H5P: try the function with the visible test calls'];
  if (heading) {
    lines.push(`print(${JSON.stringify(heading)})`);
  }
  calls.forEach((call) => {
    lines.push(
      'try:',
      `    print(${JSON.stringify(call)} + " -> " + repr(${call}))`,
      'except Exception as __h5p_trial_error:',
      `    print(${JSON.stringify(call)} + " -> " + type(__h5p_trial_error).__name__ + ": " + str(__h5p_trial_error))`,
    );
  });

  return `${source}${lines.join('\n')}\n`;
}

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

    if (!['passed', 'failed', 'limit', 'error', 'configuration'].includes(status)) return;

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
    this.view.updateLearningGoals?.(this.results);
  }

  getTestCaseValues(testCase) {
    const values = [
      ...(Array.isArray(testCase.arguments) ? testCase.arguments : []),
    ].map((argument) => normalizeFunctionTestValue(argument?.argument ?? argument));
    const expected = normalizeFunctionTestValue(testCase.expectedResult);

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

    const maxOperations = Math.floor(Number(testCase.maxOperations));
    const hasOperationLimit = Number.isFinite(maxOperations) && maxOperations > 0;
    const source = String(learnerCode || '');
    const learnerLines = source.split('\n').length;
    const harness = [
      '# H5P function-test harness',
      // The origin line lets the harness map absolute line numbers (which
      // include any prepended preamble) back to lines of the learner's code.
      'try:',
      `    __h5p_origin = __import__('sys')._getframe().f_lineno - ${learnerLines + 4}`,
      'except Exception:',
      '    __h5p_origin = None',
      '__h5p_emit = print',
      'try:',
      `    __h5p_function = globals()[${functionName}]`,
      ...(hasOperationLimit ? ['    ops.reset()'] : []),
      `    __h5p_actual = __h5p_function(${values.argumentsCode})`,
      `    __h5p_expected = ${values.expectedCode}`,
      ...(hasOperationLimit
        ? [
          `    if __h5p_actual == __h5p_expected and ops.total > ${maxOperations}:`,
          `        __h5p_emit(${marker} + 'limit:' + str(ops.total) + ':' + '${maxOperations}')`,
          '    else:',
          `        __h5p_emit(${marker} + ('passed:' if __h5p_actual == __h5p_expected else 'failed:') + repr(__h5p_actual))`,
        ]
        : [
          `    __h5p_emit(${marker} + ('passed:' if __h5p_actual == __h5p_expected else 'failed:') + repr(__h5p_actual))`,
        ]),
      'except Exception as __h5p_error:',
      '    __h5p_text = type(__h5p_error).__name__',
      '    try:',
      '        __h5p_message = " ".join(str(__h5p_error).split())',
      '        if __h5p_message:',
      '            __h5p_text += ": " + __h5p_message',
      '    except Exception:',
      '        pass',
      '    try:',
      '        import traceback as __h5p_traceback',
      '        if __h5p_origin is None:',
      '            raise ValueError("no line offset")',
      '        __h5p_frames = __h5p_traceback.extract_tb(__h5p_error.__traceback__)',
      '        __h5p_own = [f.lineno - __h5p_origin for f in __h5p_frames if f.filename == __h5p_frames[0].filename]',
      `        __h5p_own = [n for n in __h5p_own if 1 <= n <= ${learnerLines}]`,
      '        if __h5p_own:',
      '            __h5p_text += " @" + str(__h5p_own[-1])',
      '    except Exception:',
      '        pass',
      `    __h5p_emit(${marker} + 'error:' + __h5p_text)`,
    ].join('\n');

    return `${source}\n\n${harness}\n`;
  }
}
