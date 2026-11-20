import { tCodeQuestion } from '../../services/codequestion-l10n';

/**
 * Creates a title without disclosing hidden-test metadata.
 * @param {object} l10n Localized labels.
 * @param {object} testCase Authored test case.
 * @param {number} index Zero-based test index.
 * @returns {string} Test title.
 */
export function testCaseTitle(l10n, testCase, index) {
  const title = `${l10n.testCase || 'Test case'} ${index + 1}`;
  return testCase.hidden || !testCase.name ? title : `${title}: ${testCase.name}`;
}

/**
 * Shows a specific next step only after a visible test fails.
 * @param {HTMLElement} row Test result row.
 * @param {object} testCase Authored test case.
 * @param {boolean} passed Comparison result.
 * @param {object} l10n Localized labels.
 */
export function updateTestHint(row, testCase, passed, l10n) {
  const container = row?.closest('.table-testcase-container');
  if (!container) return;
  container.querySelector('.testcase-hint')?.remove();
  if (passed || testCase?.hidden || !testCase?.failureHint) return;
  const hint = document.createElement('p');
  hint.className = 'testcase-hint';
  hint.setAttribute('aria-live', 'polite');
  hint.textContent = tCodeQuestion(l10n, 'testCaseHint', { hint: testCase.failureHint });
  container.append(hint);
}

/**
 * Summarizes visible tests by learning goal.
 * @param {object} view Test view with a session and localization.
 * @param {object} results Aggregated test results.
 */
export function renderLearningGoals(view, results) {
  const root = view.getTestCasesAreaDiv();
  if (!root) return;
  root.querySelector('.testcase-learning-goals')?.remove();
  const goals = new Map();
  view.session.testcases.forEach((testCase, index) => {
    if (testCase.hidden || !testCase.learningGoal) return;
    const goal = goals.get(testCase.learningGoal) || { passed: 0, total: 0 };
    goal.total++;
    goal.passed += results.results[index] ? 1 : 0;
    goals.set(testCase.learningGoal, goal);
  });
  if (!goals.size) return;
  const summary = document.createElement('div');
  summary.className = 'testcase-learning-goals';
  summary.setAttribute('aria-live', 'polite');
  goals.forEach((goal, name) => {
    const line = document.createElement('p');
    line.textContent = tCodeQuestion(view.l10n, 'learningGoalProgress', {
      goal: name, passed: goal.passed, total: goal.total,
    });
    summary.append(line);
  });
  root.append(summary);
}

/**
 * Marks differing text and makes whitespace visible using safe text nodes.
 * @param {HTMLElement} cell Output cell.
 * @param {*} expected Expected text.
 * @param {*} actual Actual text.
 */
export function renderOutputDifference(cell, expected, actual) {
  const left = String(expected ?? '');
  const right = String(actual ?? '');
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start++;
  let end = 0;
  while (end < left.length - start && end < right.length - start
    && left[left.length - 1 - end] === right[right.length - 1 - end]) end++;
  const visible = (text) => text.replace(/ /g, '·').replace(/\t/g, '⇥').replace(/\n/g, '↵\n');
  cell.replaceChildren(document.createTextNode(visible(right.slice(0, start))));
  const difference = document.createElement('mark');
  difference.textContent = visible(right.slice(start, right.length - end)) || '∅';
  cell.append(difference, document.createTextNode(visible(end ? right.slice(-end) : '')));
}
