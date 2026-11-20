import { beforeEach, describe, expect, it } from 'vitest';
import TestResult from '../src/scripts/tester/components/results-tester';
import { IOTesterView } from '../src/scripts/tester/io/view-tester-io';
import TestSession from '../src/scripts/tester/components/session-tester';

beforeEach(() => { document.body.replaceChildren(); });

describe('test feedback and weighted results', () => {
  it('awards integer weights, preserves all-or-nothing results and resets scores', () => {
    const results = new TestResult(3, [2, 5, -1]);
    expect(results.getMaxScore()).toBe(8);
    results.setResult(0, true);
    expect(results.getScore()).toBe(2);
    expect(results.getFullCompletedScore()).toBe(0);
    results.setResult(1, true);
    results.setResult(2, true);
    expect(results.getFullCompletedScore()).toBe(1);
    results.reset();
    expect(results.getScore()).toBe(0);
  });

  it('shows test-specific hints and goal progress without leaking hidden metadata', () => {
    const session = new TestSession([
      { name: '<b>Empty</b>', learningGoal: 'Edges', failureHint: '<script>hint</script>', inputs: [], outputs: ['1 2'] },
      { name: 'Secret name', learningGoal: 'Secret goal', failureHint: 'Secret hint', hidden: true, inputs: [], outputs: ['secret'] },
    ]);
    const view = new IOTesterView({ testCase: 'Test' }, session);
    document.body.append(view.getDOM());
    const results = new TestResult(2);
    view.update(0, ['1 3'], false, { type: 'lineContentMismatch', line: 1, expectedValue: '1 2', actualValue: '1 3' });
    view.updateLearningGoals(results);
    expect(document.querySelector('h3').textContent).toContain('<b>Empty</b>');
    expect(document.querySelector('.testcase-hint').textContent).toContain('<script>hint</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('mark').textContent).toBe('3');
    expect(document.querySelector('.output').textContent).toBe('1·3');
    expect(document.querySelector('.testcase-learning-goals').textContent).toContain('0 of 1');
    expect(document.body.textContent).not.toContain('Secret');
    view.update(1, ['wrong'], false, { type: 'lineContentMismatch', line: 1, expectedValue: 'secret', actualValue: 'wrong' });
    expect(document.querySelector('.table-testcase-1').textContent).not.toContain('secret');
    expect(document.querySelector('.table-testcase-1').textContent).not.toContain('Secret');
    view.update(0, ['1 2'], true);
    expect(document.querySelector('.testcase-hint')).toBeNull();
  });
});
