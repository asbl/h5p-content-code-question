// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderTestSummary } from '../src/scripts/tester/components/test-summary';

function buildView(states) {
  const area = document.createElement('div');
  states.forEach((state, index) => {
    const container = document.createElement('div');
    container.className = 'table-testcase-container';
    container.innerHTML = `<h3>Test ${index + 1}</h3><table><tbody><tr class="${state === 'passed' ? 'test-passed' : ''}"><td class="passed">${state === 'pending' ? '' : 'x'}</td></tr></tbody></table>`;
    area.append(container);
  });

  return { l10n: { testSummary: '{passed} of {total}', testSummaryConstraintViolated: 'structure missing' }, getTestCasesAreaDiv: () => area, area };
}

describe('renderTestSummary', () => {
  it('shows the count, collapses passed tests and keeps the first failure open', () => {
    const view = buildView(['passed', 'failed', 'failed', 'passed']);
    renderTestSummary(view);

    expect(view.area.querySelector('.testcases-summary').textContent).toContain('2 of 4');
    const cases = [...view.area.querySelectorAll('.table-testcase-container')];
    expect(cases.map((entry) => entry.dataset.collapsed)).toEqual(['true', 'false', 'true', 'true']);
    expect(cases[1].querySelector('.testcase-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a manual toggle on later updates', () => {
    const view = buildView(['passed', 'failed']);
    renderTestSummary(view);
    view.area.querySelector('.testcase-toggle').click();
    renderTestSummary(view);

    expect(view.area.querySelector('.table-testcase-container').dataset.collapsed).toBe('false');
  });

  it('does nothing for a single test case', () => {
    const view = buildView(['failed']);
    renderTestSummary(view);

    expect(view.area.querySelector('.testcases-summary')).toBeNull();
  });

  it('flags a violated structure requirement even if all calls passed', () => {
    const view = buildView(['passed', 'passed', 'passed']);
    view.algorithmConstraintResult = { passed: false, violations: [{ type: 'while' }] };
    renderTestSummary(view);

    const summary = view.area.querySelector('.testcases-summary');
    expect(summary.textContent).toContain('3 of 3');
    expect(summary.textContent).toContain('structure missing');
    expect(summary.classList.contains('not-matching')).toBe(true);
  });

  it('stays positive when the structure requirement is met', () => {
    const view = buildView(['passed', 'passed']);
    view.algorithmConstraintResult = { passed: true, violations: [] };
    renderTestSummary(view);

    const summary = view.area.querySelector('.testcases-summary');
    expect(summary.textContent).not.toContain('structure missing');
    expect(summary.classList.contains('matching')).toBe(true);
  });
});
