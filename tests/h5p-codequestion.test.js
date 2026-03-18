import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTester: vi.fn(),
}));

vi.mock('../src/scripts/runtime/factory-runtime-manual', () => ({
  default: class ManualRuntimeFactoryMock {},
}));

vi.mock('../src/scripts/container/factory-container', () => ({
  default: class ContainerFactoryMock {},
}));

vi.mock('../src/scripts/tester/factory-tester', () => ({
  default: class CodeTesterFactoryMock {
    create() {
      return mocks.createTester();
    }
  },
}));

vi.mock('../src/scripts/runtime/factory-runtime-test', () => ({
  default: class TestRuntimeFactoryMock {},
}));

vi.mock('../src/scripts/runtime/runtime', () => ({
  Runtime: class RuntimeMock {},
}));

vi.mock('../src/scripts/container/codequestion-container', () => ({
  default: class CodeQuestionContainerMock {},
}));

const { default: CodeQuestion } = await import('../src/scripts/h5p-codequestion.js');

describe('CodeQuestion', () => {
  beforeEach(() => {
    mocks.createTester.mockReset();
    mocks.createTester.mockReturnValue({
      getScore: vi.fn(() => 0),
      reset: vi.fn(),
      view: {
        getDOM: () => document.createElement('div'),
      },
    });
  });

  it('derives localized feedback text and applies score feedback consistently', () => {
    const question = new CodeQuestion({
      l10n: {
        successText: 'Correct',
        failedText: 'Incorrect',
        score: 'Punkte',
      },
    }, 1);
    question.setFeedback = vi.fn();
    question.success = vi.fn(() => true);

    expect(question.getFeedbackText()).toBe('Correct');

    question.applyScoreFeedback(2, 4);

    expect(question.setFeedback).toHaveBeenCalledWith('Correct', 2, 4, 'Punkte');

    question.success.mockReturnValue(false);

    expect(question.getFeedbackText()).toBe('Incorrect');
  });

  it('passes the raw content localization to runtimes', () => {
    const question = new CodeQuestion({
      l10n: {
        successText: 'Correct',
        customRuntimeLabel: 'Runtime text',
      },
    }, 1);

    expect(question.getRuntimeOptions()).toEqual({
      l10n: {
        successText: 'Correct',
        customRuntimeLabel: 'Runtime text',
      },
    });
  });
});