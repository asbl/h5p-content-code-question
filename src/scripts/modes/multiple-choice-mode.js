import { getCodeQuestionL10nValue, tCodeQuestion } from '../services/codequestion-l10n';

/**
 * Owns configuration, state, scoring and DOM rendering/interaction for the
 * "multiple choice" grading method. `question` is the owning CodeQuestion
 * instance, used for cross-cutting concerns (l10n, markdown rendering,
 * unique DOM ids) that stay shared across grading methods.
 */
export default class MultipleChoiceMode {
  constructor(question, rawSettings = {}, previousSelectedChoices) {
    this.question = question;
    this.rawSettings = rawSettings;
    this.settings = this.normalizeSettings(rawSettings);
    this.selectedChoices = this.normalizeSelectedChoices(previousSelectedChoices);
    this.displayOrder = this.buildDisplayOrder();
    this.validateConfig();

    this.fieldset = null;
  }

  normalizeSettings(settings = {}) {
    const rawChoices = Array.isArray(settings.choices) ? settings.choices : [];
    const choices = rawChoices
      .map((choice, index) => ({
        id: `choice_${index}`,
        text: typeof choice?.text === 'string' ? choice.text : '',
        correct: choice?.correct === true,
      }))
      .filter((choice) => choice.text.trim() !== '');

    const hasSeveralCorrectChoices = choices.filter((choice) => choice.correct).length > 1;

    return {
      allowMultiple: settings.allowMultiple === true || hasSeveralCorrectChoices,
      shuffleAnswers: settings.shuffleAnswers === true,
      choices,
    };
  }

  normalizeSelectedChoices(selectedChoices = []) {
    return new Set(
      (Array.isArray(selectedChoices) ? selectedChoices : [])
        .map((choiceId) => String(choiceId || ''))
        .filter(Boolean),
    );
  }

  /**
   * Builds a (possibly shuffled) display order for the answer choices.
   * Choice ids stay tied to their original authoring index so xAPI
   * reporting and persisted state remain stable across shuffles.
   * @returns {number[]} Indices into `this.settings.choices`.
   */
  buildDisplayOrder() {
    const order = this.settings.choices.map((_, index) => index);

    if (!this.settings.shuffleAnswers) {
      return order;
    }

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  }

  /**
   * Returns the answer choices in display order.
   * @returns {Array<object>} Choices, shuffled when configured.
   */
  getDisplayedChoices() {
    return this.displayOrder.map((choiceIndex) => this.settings.choices[choiceIndex]);
  }

  /**
   * Warns authors/developers in the console when a multiple choice setup
   * can never be answered correctly. This is a defensive authoring aid,
   * not shown to learners (it must not leak answer-key information).
   * @returns {void}
   */
  validateConfig() {
    if (!this.question.isMultipleChoiceQuestion()) {
      return;
    }

    const correctChoiceCount = this.settings.choices.filter((choice) => choice.correct).length;

    if (correctChoiceCount === 0) {
      console.warn(
        'H5P.CodeQuestion: multiple choice grading has no answer option marked '
        + 'as correct. This question can never be answered correctly.',
      );
    }

    if (this.rawSettings.allowMultiple === false && correctChoiceCount > 1) {
      console.warn(
        'H5P.CodeQuestion: multiple choice grading marks several options as '
        + 'correct, but "Allow multiple correct answers" is off. The runtime '
        + 'will use checkboxes so learners can still answer correctly.',
      );
    }
  }

  handleChoiceChange(input) {
    if (!this.settings.allowMultiple) {
      this.selectedChoices.clear();
    }

    if (input.checked) {
      this.selectedChoices.add(input.value);
    }
    else {
      this.selectedChoices.delete(input.value);
    }

    this.question.answerGiven = this.selectedChoices.size > 0;
  }

  getSelectedChoiceIds() {
    return this.settings.choices
      .map((choice) => choice.id)
      .filter((choiceId) => this.selectedChoices.has(choiceId));
  }

  getCorrectChoiceIds() {
    return this.settings.choices
      .filter((choice) => choice.correct)
      .map((choice) => choice.id);
  }

  /**
   * Builds the hint telling the learner how many selected answers were
   * correct. Only shown together with the feedback once an attempt has
   * been checked, never before.
   * @returns {string} Localized hint, e.g. "2 of 4 selected answers were correct."
   */
  getCorrectCountHint() {
    const selectedChoiceIds = this.getSelectedChoiceIds();
    const correctChoiceIds = this.getCorrectChoiceIds();

    return tCodeQuestion(this.question.l10n, 'multipleChoiceCorrectCount', {
      correct: selectedChoiceIds.filter((choiceId) => correctChoiceIds.includes(choiceId)).length,
      total: selectedChoiceIds.length,
      missing: correctChoiceIds.filter((choiceId) => !selectedChoiceIds.includes(choiceId)).length,
    });
  }

  /**
   * Shows/hides the correct-count hint that is rendered as part of the
   * answer options but only revealed with the feedback.
   * @param {boolean} visible True to show the hint.
   * @returns {void}
   */
  setCorrectCountHintVisible(visible) {
    const countHint = this.fieldset?.querySelector('.codequestion-multiple-choice__count');
    if (countHint) {
      countHint.hidden = !visible;
    }
  }

  hasCorrectSelection() {
    const selected = this.getSelectedChoiceIds();
    const correct = this.getCorrectChoiceIds();

    return correct.length > 0
      && selected.length === correct.length
      && selected.every((choiceId) => correct.includes(choiceId));
  }

  render() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-multiple-choice';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.question.l10n, 'multipleChoiceAnswer');
    wrapper.append(legend);

    const countHint = document.createElement('p');
    countHint.className = 'codequestion-multiple-choice__count';
    countHint.textContent = this.getCorrectCountHint();
    countHint.hidden = true;
    wrapper.append(countHint);

    this.getDisplayedChoices().forEach((choice, index) => {
      const option = document.createElement('label');
      option.className = 'codequestion-choice';

      const input = document.createElement('input');
      input.type = this.settings.allowMultiple ? 'checkbox' : 'radio';
      input.name = `${this.question.codeQuestionUID}-multiple-choice`;
      input.value = choice.id;
      input.checked = this.selectedChoices.has(choice.id);
      input.addEventListener('change', () => this.handleChoiceChange(input));

      const marker = document.createElement('span');
      marker.className = 'codequestion-choice__marker';
      marker.textContent = String.fromCharCode(65 + index);

      const body = document.createElement('span');
      body.className = 'codequestion-choice__body';
      const markdown = new H5P.Markdown(choice.text, this.question.getMarkdownOptions());
      this.question.appendResolvedMarkdown(body, markdown);

      option.append(input, marker, body);
      wrapper.append(option);
    });

    this.fieldset = wrapper;

    return wrapper;
  }

  /**
   * Enables/disables all multiple choice inputs at once, e.g. once an
   * attempt has been checked, until the learner retries.
   * @param {boolean} locked True to disable the answer options.
   * @returns {void}
   */
  setLocked(locked) {
    if (this.fieldset) {
      this.fieldset.disabled = locked;
    }
  }

  /**
   * Reveals the correct-count hint once an attempt has been checked.
   * Individual options are intentionally never marked as correct or
   * incorrect: on a failed attempt, marking the selected options would
   * disclose the answer key (e.g. after selecting every option).
   * @returns {void}
   */
  applyFeedback() {
    if (!this.fieldset) {
      return;
    }

    const countHint = this.fieldset.querySelector('.codequestion-multiple-choice__count');
    if (countHint) {
      countHint.textContent = this.getCorrectCountHint();
    }
    this.setCorrectCountHintVisible(true);
  }

  /**
   * Hides the correct-count hint again, e.g. before a retry.
   * @returns {void}
   */
  clearFeedback() {
    this.setCorrectCountHintVisible(false);
  }

  /**
   * Clears the current selection and rendered feedback, e.g. on retry. Does
   * not touch checkbox/radio DOM state directly on the option elements
   * beyond the fieldset lock/feedback classes; the caller resets checked
   * state on the input elements themselves.
   * @returns {void}
   */
  reset() {
    this.selectedChoices.clear();
    this.setLocked(false);
    this.clearFeedback();
  }
}
