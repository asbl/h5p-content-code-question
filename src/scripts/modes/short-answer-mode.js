import { getCodeQuestionL10nValue } from '../services/codequestion-l10n';
import { clearExplanation, normalizeExplanation, showExplanation } from './explanation';

/**
 * Parses a learner or author string as a number. Accepts a decimal comma and
 * thousands separators written with spaces, apostrophes or thin spaces.
 * @param {string} value Raw text.
 * @returns {number|null} The number, or null when the text is not numeric.
 */
export function parseNumber(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/[\s  ']/g, '')
    .replace(',', '.');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(text)) {
    return null;
  }
  return Number(text);
}

/**
 * Normalizes free text for comparison: case folded, whitespace removed and
 * superscript digits mapped to `^n`, so `O(n²)`, `o(n^2)` and `O( n ^2 )`
 * are the same answer.
 * @param {string} value Raw text.
 * @param {boolean} ignoreCase Whether to fold case.
 * @returns {string} Comparable text.
 */
export function normalizeText(value, ignoreCase = true) {
  const superscripts = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n' };
  let text = String(value ?? '')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+/g, (run) => `^${[...run].map((ch) => superscripts[ch]).join('')}`)
    .replace(/[\s ]+/g, '')
    .replace(/[*·]/g, '*');
  if (ignoreCase) {
    text = text.toLowerCase();
  }
  return text;
}

/**
 * Owns configuration, state, scoring and DOM rendering for the "short
 * answer" grading method: one input field, graded numerically (with a
 * tolerance) or as normalized text against a list of accepted answers.
 */
export default class ShortAnswerMode {
  constructor(question, rawSettings = {}, previousValue) {
    this.question = question;
    this.settings = this.normalizeSettings(rawSettings);
    this.value = typeof previousValue === 'string' ? previousValue : '';
    this.input = null;
    this.feedbackElement = null;
    this.fieldset = null;
    this.validateConfig();
  }

  normalizeSettings(settings = {}) {
    const rawAnswers = Array.isArray(settings.answers) ? settings.answers : [];
    const answers = rawAnswers
      .map((entry) => (typeof entry === 'string' ? entry : entry?.value ?? entry?.text))
      .map((entry) => (entry === undefined || entry === null ? '' : String(entry)))
      .filter((entry) => entry.trim() !== '');
    const tolerance = Number(settings.tolerance);

    return {
      answers,
      tolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0,
      ignoreCase: settings.ignoreCase !== false,
      unit: typeof settings.unit === 'string' ? settings.unit.trim() : '',
      placeholder: typeof settings.placeholder === 'string' ? settings.placeholder : '',
      explanation: normalizeExplanation(settings.explanation),
    };
  }

  validateConfig() {
    if (this.question.isShortAnswerQuestion() && this.settings.answers.length === 0) {
      console.warn('H5P.CodeQuestion: short answer grading has no accepted answer.');
    }
  }

  hasAnswer() {
    return this.value.trim() !== '';
  }

  /**
   * Removes the configured unit when a learner types it behind the value
   * ("999 Vergleiche"), so the unit shown next to the field is never wrong.
   * @param {string} value Raw learner input.
   * @returns {string} Input without a trailing unit.
   */
  stripUnit(value) {
    const unit = this.settings.unit;
    if (!unit) {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.toLowerCase().endsWith(unit.toLowerCase())
      ? trimmed.slice(0, trimmed.length - unit.length).trim()
      : value;
  }

  isCorrect(value = this.value) {
    const given = this.stripUnit(String(value ?? ''));
    if (given.trim() === '') {
      return false;
    }
    const givenNumber = parseNumber(given);
    return this.settings.answers.some((accepted) => {
      const acceptedNumber = parseNumber(accepted);
      if (acceptedNumber !== null) {
        return givenNumber !== null
          && Math.abs(givenNumber - acceptedNumber) <= this.settings.tolerance + Number.EPSILON * Math.abs(acceptedNumber);
      }
      return normalizeText(given, this.settings.ignoreCase) === normalizeText(accepted, this.settings.ignoreCase);
    });
  }

  render() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-short-answer';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.question.l10n, 'shortAnswerLabel');
    wrapper.append(legend);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'codequestion-short-answer__input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = this.settings.placeholder
      || getCodeQuestionL10nValue(this.question.l10n, 'shortAnswerPlaceholder');
    input.setAttribute('aria-label', getCodeQuestionL10nValue(this.question.l10n, 'shortAnswerLabel'));
    input.value = this.value;
    input.addEventListener('input', () => {
      this.value = input.value;
      this.question.answerGiven = this.hasAnswer();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.question.checkAction?.();
      }
    });
    this.input = input;
    wrapper.append(input);

    if (this.settings.unit) {
      const unit = document.createElement('span');
      unit.className = 'codequestion-short-answer__unit';
      unit.textContent = this.settings.unit;
      wrapper.append(unit);
    }

    this.fieldset = wrapper;
    return wrapper;
  }

  setLocked(locked) {
    if (this.fieldset) {
      this.fieldset.disabled = locked;
    }
  }

  applyFeedback() {
    this.fieldset?.classList.toggle('is-correct', this.isCorrect());
    this.fieldset?.classList.toggle('is-wrong', !this.isCorrect());
    showExplanation(this.question, this.fieldset, this.settings.explanation);
  }

  clearFeedback() {
    this.fieldset?.classList.remove('is-correct', 'is-wrong');
    clearExplanation(this.fieldset);
  }

  reset() {
    this.value = '';
    if (this.input) {
      this.input.value = '';
    }
    this.setLocked(false);
    this.clearFeedback();
  }
}
