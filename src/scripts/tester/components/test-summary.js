import { tCodeQuestion } from '../../services/codequestion-l10n';

const SUMMARY_CLASS = 'testcases-summary';
const CASE_SELECTOR = '.table-testcase-container';

/**
 * Reads the state of a rendered test case.
 * @param {HTMLElement} testCase Test case container.
 * @returns {'passed'|'failed'|'pending'} State.
 */
function getCaseState(testCase) {
  const row = testCase.querySelector('tbody tr');
  const passedCell = testCase.querySelector('td.passed');
  const evaluated = passedCell ? passedCell.textContent.trim() !== '' : row?.classList.contains('test-passed');

  if (!evaluated) return 'pending';
  return row?.classList.contains('test-passed') ? 'passed' : 'failed';
}

/**
 * Makes a test case collapsible by its heading.
 * @param {HTMLElement} testCase Test case container.
 * @returns {HTMLButtonElement|null} Toggle button.
 */
function ensureToggle(testCase) {
  const heading = testCase.querySelector(':scope > h3');
  if (!heading) return null;

  let toggle = heading.querySelector('.testcase-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'testcase-toggle';
    toggle.append(...heading.childNodes);
    heading.replaceChildren(toggle);
    toggle.addEventListener('click', () => {
      testCase.dataset.userToggled = 'true';
      setCollapsed(testCase, testCase.dataset.collapsed !== 'true');
    });
  }

  return toggle;
}

function setCollapsed(testCase, collapsed) {
  testCase.dataset.collapsed = collapsed ? 'true' : 'false';
  const toggle = testCase.querySelector('.testcase-toggle');
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  Array.from(testCase.children).forEach((child) => {
    if (child.tagName !== 'H3') {
      child.hidden = collapsed;
    }
  });
}

/**
 * Adds a result overview above the tests and folds them so that the first
 * failing test is the one the learner sees: passed tests are collapsed, the
 * first failure stays open. Manual toggles by the learner are kept.
 * With a single test case nothing changes.
 * @param {object} view Test view providing the area and localization.
 * @returns {void}
 */
export function renderTestSummary(view) {
  const area = view.getTestCasesAreaDiv?.();
  if (!area) return;

  const cases = Array.from(area.querySelectorAll(CASE_SELECTOR));
  area.querySelector(`.${SUMMARY_CLASS}`)?.remove();
  if (cases.length < 2) return;

  const states = cases.map(getCaseState);
  const evaluated = states.filter((state) => state !== 'pending').length;
  if (evaluated === 0) return;

  const passed = states.filter((state) => state === 'passed').length;
  const firstFailed = states.indexOf('failed');

  cases.forEach((testCase, index) => {
    testCase.dataset.state = states[index];
    if (!ensureToggle(testCase) || testCase.dataset.userToggled === 'true') return;
    setCollapsed(testCase, states[index] === 'passed' || (states[index] === 'failed' && index !== firstFailed));
  });

  const constraint = view.algorithmConstraintResult;
  const constraintViolated = !!constraint && !(constraint.passed === true
    && !(Array.isArray(constraint.violations) && constraint.violations.length > 0));
  const allPassed = passed === cases.length && !constraintViolated;

  const summary = document.createElement('div');
  summary.className = `${SUMMARY_CLASS} ${allPassed ? 'matching' : 'not-matching'}`;
  summary.setAttribute('role', 'status');

  const text = document.createElement('strong');
  text.textContent = tCodeQuestion(view.l10n, 'testSummary', { passed, total: cases.length });
  if (constraintViolated) {
    text.textContent += ` · ${tCodeQuestion(view.l10n, 'testSummaryConstraintViolated')}`;
  }

  const bar = document.createElement('div');
  bar.className = 'testcases-summary-bar';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'testcases-summary-bar-fill';
  fill.style.width = `${Math.round((passed / cases.length) * 100)}%`;
  bar.append(fill);

  summary.append(text, bar);
  area.prepend(summary);
}
