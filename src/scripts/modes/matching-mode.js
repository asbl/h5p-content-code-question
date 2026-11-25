import { getCodeQuestionL10nValue } from '../services/codequestion-l10n';
import { clearExplanation, normalizeExplanation, showExplanation } from './explanation';

/**
 * Strips Markdown code ticks so a pair text can be shown inside a native
 * <option>, which cannot render Markdown.
 * @param {string} text Markdown text.
 * @returns {string} Plain text.
 */
function toPlainText(text) {
  return String(text || '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Owns configuration, state, scoring and DOM rendering for the "matching"
 * grading method: every left item gets exactly one right item chosen from a
 * shuffled drop-down list. Right items may repeat (several left items can
 * share the same answer) and distractors without partner are supported.
 */
export default class MatchingMode {
  constructor(question, rawSettings = {}, previousAnswers) {
    this.question = question;
    this.settings = this.normalizeSettings(rawSettings);
    this.answers = this.normalizeAnswers(previousAnswers);
    this.rightOrder = this.buildRightOrder();
    this.fieldset = null;
    this.selects = new Map();
    this.validateConfig();
  }

  normalizeSettings(settings = {}) {
    const rawPairs = Array.isArray(settings.pairs) ? settings.pairs : [];
    const pairs = rawPairs
      .map((pair, index) => ({
        id: `pair_${index}`,
        left: typeof pair?.left === 'string' ? pair.left : '',
        right: toPlainText(pair?.right),
      }))
      .filter((pair) => pair.left.trim() !== '' && pair.right !== '');

    const distractors = (Array.isArray(settings.distractors) ? settings.distractors : [])
      .map((entry) => toPlainText(typeof entry === 'string' ? entry : entry?.text))
      .filter(Boolean);

    return { pairs, distractors, explanation: normalizeExplanation(settings.explanation) };
  }

  /**
   * Unique right-hand texts (partners plus distractors), shuffled once.
   * @returns {string[]} Option texts in display order.
   */
  buildRightOrder() {
    const unique = [...new Set([
      ...this.settings.pairs.map((pair) => pair.right),
      ...this.settings.distractors,
    ])];

    for (let i = unique.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique;
  }

  /**
   * Restores persisted answers only for pairs and options that still exist.
   * @param {object} previous Persisted pairId -> right text map.
   * @returns {object} Valid answer map.
   */
  normalizeAnswers(previous) {
    const answers = {};
    if (!previous || typeof previous !== 'object') {
      return answers;
    }
    const validRights = new Set([
      ...this.settings.pairs.map((pair) => pair.right),
      ...this.settings.distractors,
    ]);
    this.settings.pairs.forEach((pair) => {
      const value = previous[pair.id];
      if (typeof value === 'string' && validRights.has(value)) {
        answers[pair.id] = value;
      }
    });
    return answers;
  }

  validateConfig() {
    if (!this.question.isMatchingQuestion() || this.settings.pairs.length >= 2) {
      return;
    }
    console.warn('H5P.CodeQuestion: matching grading needs at least two complete pairs.');
  }

  hasAnswer() {
    return Object.keys(this.answers).length > 0;
  }

  getAnswerIds() {
    return this.settings.pairs
      .filter((pair) => this.answers[pair.id] !== undefined)
      .map((pair) => `${pair.id}->${this.answers[pair.id]}`);
  }

  getCorrectAnswerIds() {
    return this.settings.pairs.map((pair) => `${pair.id}->${pair.right}`);
  }

  countCorrect() {
    return this.settings.pairs.filter((pair) => this.answers[pair.id] === pair.right).length;
  }

  hasCorrectMatching() {
    return this.settings.pairs.length > 0 && this.countCorrect() === this.settings.pairs.length;
  }

  handleChange(pairId, value) {
    if (value === '') {
      delete this.answers[pairId];
    }
    else {
      this.answers[pairId] = value;
    }
    this.question.answerGiven = this.hasAnswer();
  }

  render() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-matching';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.question.l10n, 'matchingAnswer');
    wrapper.append(legend);

    const hint = document.createElement('p');
    hint.className = 'codequestion-matching__hint';
    hint.textContent = getCodeQuestionL10nValue(this.question.l10n, 'matchingInstructions');
    wrapper.append(hint);

    const count = document.createElement('p');
    count.className = 'codequestion-matching__count';
    count.hidden = true;
    wrapper.append(count);

    this.selects = new Map();
    this.settings.pairs.forEach((pair) => {
      const row = document.createElement('div');
      row.className = 'codequestion-matching-row';

      const label = document.createElement('div');
      label.className = 'codequestion-matching-row__left';
      const markdown = new H5P.Markdown(pair.left, this.question.getMarkdownOptions());
      this.question.appendResolvedMarkdown(label, markdown);

      const select = document.createElement('select');
      select.className = 'codequestion-matching-row__select';
      select.name = `${this.question.codeQuestionUID}-${pair.id}`;
      select.setAttribute('aria-label', toPlainText(pair.left));

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = getCodeQuestionL10nValue(this.question.l10n, 'matchingChoose');
      select.append(placeholder);

      this.rightOrder.forEach((right) => {
        const option = document.createElement('option');
        option.value = right;
        option.textContent = right;
        select.append(option);
      });

      select.value = this.answers[pair.id] ?? '';
      select.addEventListener('change', () => this.handleChange(pair.id, select.value));

      row.append(label, select);
      wrapper.append(row);
      this.selects.set(pair.id, select);
    });

    this.fieldset = wrapper;
    return wrapper;
  }

  setLocked(locked) {
    if (this.fieldset) {
      this.fieldset.disabled = locked;
    }
  }

  /**
   * Shows how many pairs are right without marking individual rows, so a
   * failed attempt does not reveal the full answer key.
   * @returns {void}
   */
  applyFeedback() {
    showExplanation(this.question, this.fieldset, this.settings.explanation);
    const count = this.fieldset?.querySelector('.codequestion-matching__count');
    if (!count) {
      return;
    }
    const template = getCodeQuestionL10nValue(this.question.l10n, 'matchingCorrectCount');
    count.textContent = template
      .replace('{correct}', String(this.countCorrect()))
      .replace('{total}', String(this.settings.pairs.length));
    count.hidden = false;
  }

  clearFeedback() {
    clearExplanation(this.fieldset);
    const count = this.fieldset?.querySelector('.codequestion-matching__count');
    if (count) {
      count.hidden = true;
    }
  }

  reset() {
    this.answers = {};
    this.rightOrder = this.buildRightOrder();
    this.selects.forEach((select) => {
      select.value = '';
    });
    this.setLocked(false);
    this.clearFeedback();
  }
}
