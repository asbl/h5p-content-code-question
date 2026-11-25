import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import MatchingMode from '../src/scripts/modes/matching-mode.js';
import MultipleChoiceMode from '../src/scripts/modes/multiple-choice-mode.js';
import ShortAnswerMode from '../src/scripts/modes/short-answer-mode.js';
import { normalizeExplanation, showExplanation } from '../src/scripts/modes/explanation.js';

function createQuestion() {
  return {
    l10n: { explanationHeading: 'Explanation' },
    isShortAnswerQuestion: () => true,
    isMatchingQuestion: () => true,
    isMultipleChoiceQuestion: () => true,
    getUniqueDomId: (name) => `uid-${name}`,
    getMarkdownOptions: () => ({}),
    appendResolvedMarkdown: (container, markdown) => container.append(markdown.getMarkdownDiv()),
  };
}

describe('explanation after checking', () => {
  let originalMarkdown;

  beforeEach(() => {
    originalMarkdown = H5P.Markdown;
    H5P.Markdown = class {
      constructor(text) {
        this.text = text;
      }

      getMarkdownDiv() {
        const div = document.createElement('div');
        div.textContent = this.text;
        return div;
      }
    };
  });

  afterEach(() => {
    H5P.Markdown = originalMarkdown;
  });

  it('normalizes authored text', () => {
    expect(normalizeExplanation('  Because n  ')).toBe('Because n');
    expect(normalizeExplanation(undefined)).toBe('');
    expect(normalizeExplanation(5)).toBe('');
  });

  it('renders a heading and replaces an earlier explanation', () => {
    const host = document.createElement('div');
    const question = createQuestion();

    showExplanation(question, host, 'First');
    showExplanation(question, host, 'Second');

    expect(host.querySelectorAll('.codequestion-explanation')).toHaveLength(1);
    expect(host.querySelector('.codequestion-explanation__heading').textContent).toBe('Explanation');
    expect(host.querySelector('.codequestion-explanation__body').textContent).toBe('Second');
  });

  it('renders nothing without text', () => {
    const host = document.createElement('div');
    expect(showExplanation(createQuestion(), host, '')).toBeNull();
    expect(host.children).toHaveLength(0);
  });

  it('shows it for a wrong and a right short answer and hides it on reset', () => {
    const mode = new ShortAnswerMode(createQuestion(), { answers: ['42'], explanation: 'Because 6*7.' });
    const fieldset = mode.render();

    mode.value = '1';
    mode.applyFeedback();
    expect(fieldset.classList.contains('is-wrong')).toBe(true);
    expect(fieldset.querySelector('.codequestion-explanation__body').textContent).toBe('Because 6*7.');

    mode.value = '42';
    mode.applyFeedback();
    expect(fieldset.querySelectorAll('.codequestion-explanation')).toHaveLength(1);

    mode.reset();
    expect(fieldset.querySelector('.codequestion-explanation')).toBeNull();
  });

  it('shows it for multiple choice and removes it on reset', () => {
    const mode = new MultipleChoiceMode(createQuestion(), {
      choices: [{ text: 'A', correct: true }, { text: 'B', correct: false }],
      explanation: 'A is right because...',
    });
    const fieldset = mode.render();

    mode.applyFeedback();
    expect(fieldset.querySelector('.codequestion-explanation__body').textContent).toBe('A is right because...');

    mode.reset();
    expect(fieldset.querySelector('.codequestion-explanation')).toBeNull();
  });

  it('shows it for matching and removes it on reset', () => {
    const mode = new MatchingMode(createQuestion(), {
      pairs: [{ left: 'a', right: 'b' }],
      explanation: 'Pairs share a topic.',
    });
    const fieldset = mode.render();

    mode.applyFeedback();
    expect(fieldset.querySelector('.codequestion-explanation__body').textContent).toBe('Pairs share a topic.');

    mode.reset();
    expect(fieldset.querySelector('.codequestion-explanation')).toBeNull();
  });

  it('omits the box when no explanation is authored', () => {
    const mode = new ShortAnswerMode(createQuestion(), { answers: ['42'] });
    const fieldset = mode.render();
    mode.applyFeedback();
    expect(fieldset.querySelector('.codequestion-explanation')).toBeNull();
  });
});
