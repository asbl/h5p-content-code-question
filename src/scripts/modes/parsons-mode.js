import { getCodeQuestionL10nValue, tCodeQuestion } from '../services/codequestion-l10n';

/**
 * Owns configuration, state, scoring and DOM rendering/interaction for the
 * drag-and-drop Parsons grading method. Learners reorder shuffled code lines
 * (indentation preserved) into the authored correct order. `question` is the
 * owning CodeQuestion instance, used for shared cross-cutting concerns
 * (l10n, markdown rendering).
 */
export default class ParsonsMode {
  constructor(question, rawSettings = {}, previousOrder) {
    this.question = question;
    this.settings = this.normalizeSettings(rawSettings);
    this.currentParsonsOrder = this.normalizeOrder(previousOrder, this.settings.lines);
    this.validateConfig();

    this.parsonsStatusElement = null;
    this.parsonsListElement = null;
    this.parsonsItemElements = null;
    this.parsonsFieldset = null;
    this.draggedParsonsItemId = null;
  }

  normalizeSettings(settings = {}) {
    const rawLines = Array.isArray(settings.lines) ? settings.lines : [];
    const lines = rawLines
      .map((line, index) => ({
        id: `line_${index}`,
        code: typeof line?.code === 'string' ? line.code.replace(/\r\n/g, '\n') : '',
      }))
      .filter((line) => line.code.trim() !== '');

    return { lines };
  }

  /**
   * Fisher-Yates shuffle used for the initial display order and on retry.
   * @param {string[]} lineIds Line ids to shuffle.
   * @returns {string[]} A new, shuffled array of line ids.
   */
  buildDisplayOrder(lineIds) {
    const order = [...lineIds];

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  }

  /**
   * Restores a persisted order if, and only if, it still matches the current
   * line set exactly. Otherwise falls back to a fresh shuffle (e.g. lines
   * were edited by the author after the learner started).
   * @param {string[]} previousOrder Persisted line id order.
   * @param {Array<object>} lines Currently configured Parsons lines.
   * @returns {string[]} A valid display order of line ids.
   */
  normalizeOrder(previousOrder, lines) {
    const validIds = lines.map((line) => line.id);
    const cleanedPrevious = (Array.isArray(previousOrder) ? previousOrder : [])
      .map((lineId) => String(lineId || ''))
      .filter((lineId) => validIds.includes(lineId));

    const isCompleteAndValid = cleanedPrevious.length === validIds.length
      && new Set(cleanedPrevious).size === validIds.length;

    return isCompleteAndValid ? cleanedPrevious : this.buildDisplayOrder(validIds);
  }

  /**
   * Warns authors/developers when a Parsons setup can never be solved.
   * Defensive authoring aid only, never shown to learners.
   * @returns {void}
   */
  validateConfig() {
    if (!this.question.isParsonsQuestion()) {
      return;
    }

    if (this.settings.lines.length < 2) {
      console.warn(
        'H5P.CodeQuestion: Parsons grading needs at least two lines to form '
        + 'an orderable program.',
      );
    }
  }

  getCorrectLineIds() {
    return this.settings.lines.map((line) => line.id);
  }

  hasCorrectOrder() {
    const correctOrder = this.getCorrectLineIds();

    return correctOrder.length > 0
      && this.currentParsonsOrder.length === correctOrder.length
      && this.currentParsonsOrder.every((lineId, index) => lineId === correctOrder[index]);
  }

  render() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-parsons';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.question.l10n, 'parsonsAnswer');
    wrapper.append(legend);

    const hint = document.createElement('p');
    hint.className = 'codequestion-parsons__hint';
    hint.textContent = getCodeQuestionL10nValue(this.question.l10n, 'parsonsInstructions');
    wrapper.append(hint);

    const status = document.createElement('div');
    status.className = 'sr-only';
    status.setAttribute('aria-live', 'polite');
    this.parsonsStatusElement = status;
    wrapper.append(status);

    const list = document.createElement('ol');
    list.className = 'codequestion-parsons-list';
    this.parsonsListElement = list;
    this.parsonsItemElements = new Map();

    this.currentParsonsOrder.forEach((lineId) => {
      list.append(this.buildItemElement(lineId));
    });

    wrapper.append(list);
    this.parsonsFieldset = wrapper;

    return wrapper;
  }

  buildItemElement(lineId) {
    const line = this.settings.lines.find((candidate) => candidate.id === lineId);

    const li = document.createElement('li');
    li.className = 'codequestion-parsons-item';
    li.draggable = true;
    li.dataset.lineId = lineId;
    li.addEventListener('dragstart', (event) => this.handleDragStart(event, lineId));
    li.addEventListener('dragover', (event) => this.handleDragOver(event, lineId));
    li.addEventListener('drop', (event) => this.handleDrop(event));
    li.addEventListener('dragend', () => this.handleDragEnd());

    const handle = document.createElement('span');
    handle.className = 'codequestion-parsons-item__handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const body = document.createElement('pre');
    body.className = 'codequestion-parsons-item__code';
    const code = document.createElement('code');
    code.textContent = line?.code || '';
    body.append(code);

    const state = document.createElement('span');
    state.className = 'codequestion-parsons-item__state sr-only';

    const controls = document.createElement('span');
    controls.className = 'codequestion-parsons-item__controls';

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.className = 'codequestion-parsons-item__move codequestion-parsons-item__move--up';
    upButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.question.l10n, 'moveItemUp'));
    upButton.addEventListener('click', () => this.moveItem(lineId, -1));

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.className = 'codequestion-parsons-item__move codequestion-parsons-item__move--down';
    downButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.question.l10n, 'moveItemDown'));
    downButton.addEventListener('click', () => this.moveItem(lineId, 1));

    controls.append(upButton, downButton);
    li.append(handle, body, state, controls);

    this.parsonsItemElements.set(lineId, li);

    return li;
  }

  /**
   * Moves a line up/down via the keyboard-accessible controls, reorders the
   * underlying array and DOM, and announces the new position.
   * @param {string} lineId Id of the line to move.
   * @param {number} direction -1 to move up, 1 to move down.
   * @returns {void}
   */
  moveItem(lineId, direction) {
    const fromIndex = this.currentParsonsOrder.indexOf(lineId);
    const toIndex = fromIndex + direction;

    if (fromIndex === -1 || toIndex < 0 || toIndex >= this.currentParsonsOrder.length) {
      return;
    }

    this.currentParsonsOrder.splice(fromIndex, 1);
    this.currentParsonsOrder.splice(toIndex, 0, lineId);
    this.question.answerGiven = true;

    this.reorderListDOM();
    this.announcePosition(toIndex);
    this.focusMoveButton(lineId, direction);
  }

  /**
   * Re-appends the existing line elements in `currentParsonsOrder`, without
   * recreating them, so DOM identity (and thus event listeners) survives.
   * @returns {void}
   */
  reorderListDOM() {
    if (!this.parsonsListElement || !this.parsonsItemElements) {
      return;
    }

    this.currentParsonsOrder.forEach((lineId) => {
      const element = this.parsonsItemElements.get(lineId);
      if (element) {
        this.parsonsListElement.append(element);
      }
    });
  }

  announcePosition(index) {
    if (!this.parsonsStatusElement) {
      return;
    }

    this.parsonsStatusElement.textContent = tCodeQuestion(this.question.l10n, 'itemMovedTo', {
      position: index + 1,
      total: this.currentParsonsOrder.length,
    });
  }

  focusMoveButton(lineId, direction) {
    const selector = direction < 0
      ? '.codequestion-parsons-item__move--up'
      : '.codequestion-parsons-item__move--down';

    this.parsonsItemElements?.get(lineId)?.querySelector?.(selector)?.focus?.();
  }

  handleDragStart(event, lineId) {
    if (this.parsonsFieldset?.disabled) {
      event.preventDefault();
      return;
    }

    this.draggedParsonsItemId = lineId;
    event.dataTransfer?.setData('text/plain', lineId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    event.currentTarget?.classList?.add('is-dragging');
  }

  handleDragOver(event, lineId) {
    if (this.parsonsFieldset?.disabled || !this.draggedParsonsItemId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    if (this.draggedParsonsItemId === lineId) {
      return;
    }

    const fromIndex = this.currentParsonsOrder.indexOf(this.draggedParsonsItemId);
    const toIndex = this.currentParsonsOrder.indexOf(lineId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    this.currentParsonsOrder.splice(fromIndex, 1);
    this.currentParsonsOrder.splice(toIndex, 0, this.draggedParsonsItemId);
    this.reorderListDOM();
  }

  handleDrop(event) {
    event.preventDefault();
    if (this.draggedParsonsItemId) {
      this.question.answerGiven = true;
    }
  }

  handleDragEnd() {
    this.parsonsListElement
      ?.querySelectorAll?.('.codequestion-parsons-item.is-dragging')
      ?.forEach((element) => element.classList.remove('is-dragging'));

    this.draggedParsonsItemId = null;
  }

  /**
   * Enables/disables the Parsons controls, e.g. once an attempt has been
   * checked, until the learner retries.
   * @param {boolean} locked True to disable further reordering.
   * @returns {void}
   */
  setLocked(locked) {
    if (this.parsonsFieldset) {
      this.parsonsFieldset.disabled = locked;
    }
  }

  /**
   * Marks each line as correctly/incorrectly placed after checking.
   * @returns {void}
   */
  applyFeedback() {
    if (!this.parsonsFieldset) {
      return;
    }

    const correctOrder = this.getCorrectLineIds();

    this.currentParsonsOrder.forEach((lineId, index) => {
      const element = this.parsonsItemElements?.get(lineId);
      if (!element) {
        return;
      }

      const isCorrect = correctOrder[index] === lineId;
      element.classList.remove('codequestion-parsons-item--correct', 'codequestion-parsons-item--incorrect');
      element.classList.add(
        isCorrect ? 'codequestion-parsons-item--correct' : 'codequestion-parsons-item--incorrect',
      );

      const state = element.querySelector('.codequestion-parsons-item__state');
      if (state) {
        state.textContent = getCodeQuestionL10nValue(
          this.question.l10n,
          isCorrect ? 'choiceCorrect' : 'choiceIncorrect',
        );
      }
    });
  }

  /**
   * Removes any correct/incorrect markup from the lines, e.g. before a
   * retry.
   * @returns {void}
   */
  clearFeedback() {
    this.parsonsItemElements?.forEach((element) => {
      element.classList.remove('codequestion-parsons-item--correct', 'codequestion-parsons-item--incorrect');
      const state = element.querySelector('.codequestion-parsons-item__state');
      if (state) {
        state.textContent = '';
      }
    });
  }

  /**
   * Re-shuffles the line order and clears rendered feedback, e.g. on retry.
   * @returns {void}
   */
  reset() {
    this.currentParsonsOrder = this.buildDisplayOrder(this.getCorrectLineIds());
    this.setLocked(false);
    this.clearFeedback();
    this.reorderListDOM();
  }
}
