import { describe, expect, it, vi } from 'vitest';

import XAPIReporter from '../src/scripts/services/xapi-reporter';

function createQuestion(overrides = {}) {
  const statement = {
    object: { id: 'https://example.org/activity/1', definition: {} },
  };
  const event = {
    data: { statement },
    setVerb: vi.fn(),
    getVerifiedStatementValue: (path) => path.reduce((node, key) => node[key], statement),
  };

  return {
    createXAPIEventTemplate: vi.fn(() => event),
    trigger: vi.fn(),
    getScore: () => 1,
    getMaxScore: () => 2,
    success: () => true,
    getResponse: () => 'print(1)',
    getTitle: () => 'Title',
    getDescription: () => 'Description',
    getCodingLanguage: () => 'python',
    isMultipleChoiceQuestion: () => false,
    isSortQuestion: () => false,
    isParsonsQuestion: () => false,
    codeTester: { results: { weights: [2, 5] } },
    event,
    ...overrides,
  };
}

describe('XAPIReporter test case events', () => {
  it('sends an interacted statement with the test case as sub-activity', () => {
    const question = createQuestion();
    const reporter = new XAPIReporter(question);

    reporter.sendTestCaseEvent(0, true, { name: 'Adds', learningGoal: 'addition', weight: 2 });

    expect(question.trigger).toHaveBeenCalledTimes(1);
    const event = question.event;
    expect(event.setVerb).toHaveBeenCalledWith(expect.objectContaining({
      id: 'http://adlnet.gov/expapi/verbs/interacted',
    }));

    const statement = event.data.statement;
    expect(statement.object.id).toBe('https://example.org/activity/1#testcase-1');
    expect(statement.object.definition.interactionType).toBe('other');
    expect(statement.object.definition.name['en-US']).toBe('Adds');
    expect(statement.result.success).toBe(true);
    expect(statement.result.score).toEqual({ raw: 2, min: 0, max: 2, scaled: 1 });
    expect(statement.result.extensions).toMatchObject({
      'https://opencoding.de/xapi/extension/testcase/index': 1,
      'https://opencoding.de/xapi/extension/testcase/name': 'Adds',
      'https://opencoding.de/xapi/extension/testcase/learning-goal': 'addition',
      'https://opencoding.de/xapi/extension/testcase/hidden': false,
      'https://opencoding.de/xapi/extension/testcase/weight': 2,
    });
    expect(statement.context.contextActivities.parent).toEqual([
      { objectType: 'Activity', id: 'https://example.org/activity/1' },
    ]);
    expect(statement.context.registration).toBeTruthy();
    expect(statement.id).toMatch(/^interacted-testcase-1-/);
  });

  it('reports a failed test case with zero raw score', () => {
    const question = createQuestion();
    const reporter = new XAPIReporter(question);

    reporter.sendTestCaseEvent(1, false, { name: 'Subtracts' });

    const statement = question.event.data.statement;
    expect(statement.object.id).toBe('https://example.org/activity/1#testcase-2');
    expect(statement.result.success).toBe(false);
    // Weight comes from the tester results (index 1 -> 5), not the test case.
    expect(statement.result.score).toEqual({ raw: 0, min: 0, max: 5, scaled: 0 });
  });

  it('never leaks name or learning goal of hidden test cases', () => {
    const question = createQuestion();
    const reporter = new XAPIReporter(question);

    reporter.sendTestCaseEvent(0, true, { name: 'Secret', learningGoal: 'hidden goal', hidden: true });

    const statement = question.event.data.statement;
    expect(statement.object.definition.name['en-US']).toBe('Test case 1');
    expect(statement.object.definition.description['en-US']).toBe('');
    expect(statement.result.extensions['https://opencoding.de/xapi/extension/testcase/name']).toBe('');
    expect(statement.result.extensions['https://opencoding.de/xapi/extension/testcase/learning-goal']).toBe('');
    expect(statement.result.extensions['https://opencoding.de/xapi/extension/testcase/hidden']).toBe(true);
  });

  it('does nothing when the host cannot create xAPI events', () => {
    const question = createQuestion({ createXAPIEventTemplate: undefined });
    const reporter = new XAPIReporter(question);

    expect(() => reporter.sendTestCaseEvent(0, true, {})).not.toThrow();
    expect(question.trigger).not.toHaveBeenCalled();
  });
});
