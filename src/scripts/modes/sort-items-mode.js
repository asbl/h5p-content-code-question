import { getCodeQuestionL10nValue, tCodeQuestion } from '../services/codequestion-l10n';

/**
 * Owns configuration, state, scoring and DOM rendering/interaction for the
 * drag-and-drop "sort items" grading method. `question` is the owning
 * CodeQuestion instance, used for cross-cutting concerns (l10n, markdown
 * rendering) that stay shared across grading methods.
 */
export default class SortItemsMode {
  constructor(question, rawSettings = {}, previousOrder) {
    this.question = question;
    this.settings = this.normalizeSettings(rawSettings);
    this.currentSortOrder = this.normalizeOrder(previousOrder, this.settings.items);
    this.validateConfig();

    this.sortStatusElement = null;
    this.sortListElement = null;
    this.sortItemElements = null;
    this.sortFieldset = null;
    this.draggedSortItemId = null;
  }

  normalizeSettings(settings = {}) {
    const rawItems = Array.isArray(settings.items) ? settings.items : [];
    const items = rawItems
      .map((item, index) => ({
        id: `item_${index}`,
        text: typeof item?.text === 'string' ? item.text : '',
      }))
      .filter((item) => item.text.trim() !== '');

    return { items };
  }

  /**
   * Fisher-Yates shuffle used both for the initial display order and for
   * building a fresh order on retry.
   * @param {string[]} itemIds Item ids to shuffle.
   * @returns {string[]} A new, shuffled array of item ids.
   */
  buildDisplayOrder(itemIds) {
    const order = [...itemIds];

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  }

  /**
   * Restores a persisted sort order if, and only if, it still matches the
   * current item set exactly. Otherwise falls back to a fresh shuffle (e.g.
   * items were edited by the author after the learner started).
   * @param {string[]} previousOrder Persisted item id order.
   * @param {Array<object>} items Currently configured sort items.
   * @returns {string[]} A valid display order of item ids.
   */
  normalizeOrder(previousOrder, items) {
    const validIds = items.map((item) => item.id);
    const cleanedPrevious = (Array.isArray(previousOrder) ? previousOrder : [])
      .map((itemId) => String(itemId || ''))
      .filter((itemId) => validIds.includes(itemId));

    const isCompleteAndValid = cleanedPrevious.length === validIds.length
      && new Set(cleanedPrevious).size === validIds.length;

    return isCompleteAndValid ? cleanedPrevious : this.buildDisplayOrder(validIds);
  }

  /**
   * Warns authors/developers when a sort grading setup can never be solved.
   * Defensive authoring aid only, never shown to learners.
   * @returns {void}
   */
  validateConfig() {
    if (!this.question.isSortQuestion()) {
      return;
    }

    if (this.settings.items.length < 2) {
      console.warn(
        'H5P.CodeQuestion: sort grading needs at least two items to form an '
        + 'orderable sequence.',
      );
    }
  }

  getCorrectItemIds() {
    return this.settings.items.map((item) => item.id);
  }

  hasCorrectOrder() {
    const correctOrder = this.getCorrectItemIds();

    return correctOrder.length > 0
      && this.currentSortOrder.length === correctOrder.length
      && this.currentSortOrder.every((itemId, index) => itemId === correctOrder[index]);
  }

  render() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-sort';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.question.l10n, 'sortQuestionAnswer');
    wrapper.append(legend);

    const hint = document.createElement('p');
    hint.className = 'codequestion-sort__hint';
    hint.textContent = getCodeQuestionL10nValue(this.question.l10n, 'sortInstructions');
    wrapper.append(hint);

    const status = document.createElement('div');
    status.className = 'sr-only';
    status.setAttribute('aria-live', 'polite');
    this.sortStatusElement = status;
    wrapper.append(status);

    const list = document.createElement('ol');
    list.className = 'codequestion-sort-list';
    this.sortListElement = list;
    this.sortItemElements = new Map();

    this.currentSortOrder.forEach((itemId) => {
      list.append(this.buildItemElement(itemId));
    });

    wrapper.append(list);
    this.sortFieldset = wrapper;

    return wrapper;
  }

  buildItemElement(itemId) {
    const item = this.settings.items.find((candidate) => candidate.id === itemId);

    const li = document.createElement('li');
    li.className = 'codequestion-sort-item';
    li.draggable = true;
    li.dataset.itemId = itemId;
    li.addEventListener('dragstart', (event) => this.handleDragStart(event, itemId));
    li.addEventListener('dragover', (event) => this.handleDragOver(event, itemId));
    li.addEventListener('drop', (event) => this.handleDrop(event));
    li.addEventListener('dragend', () => this.handleDragEnd());

    const handle = document.createElement('span');
    handle.className = 'codequestion-sort-item__handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const body = document.createElement('span');
    body.className = 'codequestion-sort-item__body';
    const markdown = new H5P.Markdown(item?.text || '', this.question.getMarkdownOptions());
    this.question.appendResolvedMarkdown(body, markdown);

    const state = document.createElement('span');
    state.className = 'codequestion-sort-item__state sr-only';

    const controls = document.createElement('span');
    controls.className = 'codequestion-sort-item__controls';

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.className = 'codequestion-sort-item__move codequestion-sort-item__move--up';
    upButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.question.l10n, 'moveItemUp'));
    upButton.addEventListener('click', () => this.moveItem(itemId, -1));

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.className = 'codequestion-sort-item__move codequestion-sort-item__move--down';
    downButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.question.l10n, 'moveItemDown'));
    downButton.addEventListener('click', () => this.moveItem(itemId, 1));

    controls.append(upButton, downButton);
    li.append(handle, body, state, controls);

    this.sortItemElements.set(itemId, li);

    return li;
  }

  /**
   * Moves an item up/down via the keyboard-accessible controls, reorders
   * the underlying array and DOM, and announces the new position.
   * @param {string} itemId Id of the item to move.
   * @param {number} direction -1 to move up, 1 to move down.
   * @returns {void}
   */
  moveItem(itemId, direction) {
    const fromIndex = this.currentSortOrder.indexOf(itemId);
    const toIndex = fromIndex + direction;

    if (fromIndex === -1 || toIndex < 0 || toIndex >= this.currentSortOrder.length) {
      return;
    }

    this.currentSortOrder.splice(fromIndex, 1);
    this.currentSortOrder.splice(toIndex, 0, itemId);
    this.question.answerGiven = true;

    this.reorderListDOM();
    this.announcePosition(toIndex);
    this.focusMoveButton(itemId, direction);
  }

  /**
   * Re-appends the existing item elements in `currentSortOrder`, without
   * recreating them, so DOM identity (and thus event listeners) survives.
   * @returns {void}
   */
  reorderListDOM() {
    if (!this.sortListElement || !this.sortItemElements) {
      return;
    }

    this.currentSortOrder.forEach((itemId) => {
      const element = this.sortItemElements.get(itemId);
      if (element) {
        this.sortListElement.append(element);
      }
    });
  }

  announcePosition(index) {
    if (!this.sortStatusElement) {
      return;
    }

    this.sortStatusElement.textContent = tCodeQuestion(this.question.l10n, 'itemMovedTo', {
      position: index + 1,
      total: this.currentSortOrder.length,
    });
  }

  focusMoveButton(itemId, direction) {
    const selector = direction < 0
      ? '.codequestion-sort-item__move--up'
      : '.codequestion-sort-item__move--down';

    this.sortItemElements?.get(itemId)?.querySelector?.(selector)?.focus?.();
  }

  handleDragStart(event, itemId) {
    if (this.sortFieldset?.disabled) {
      event.preventDefault();
      return;
    }

    this.draggedSortItemId = itemId;
    event.dataTransfer?.setData('text/plain', itemId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    event.currentTarget?.classList?.add('is-dragging');
  }

  handleDragOver(event, itemId) {
    if (this.sortFieldset?.disabled || !this.draggedSortItemId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    if (this.draggedSortItemId === itemId) {
      return;
    }

    const fromIndex = this.currentSortOrder.indexOf(this.draggedSortItemId);
    const toIndex = this.currentSortOrder.indexOf(itemId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    this.currentSortOrder.splice(fromIndex, 1);
    this.currentSortOrder.splice(toIndex, 0, this.draggedSortItemId);
    this.reorderListDOM();
  }

  handleDrop(event) {
    event.preventDefault();
    if (this.draggedSortItemId) {
      this.question.answerGiven = true;
    }
  }

  handleDragEnd() {
    this.sortListElement
      ?.querySelectorAll?.('.codequestion-sort-item.is-dragging')
      ?.forEach((element) => element.classList.remove('is-dragging'));

    this.draggedSortItemId = null;
  }

  /**
   * Enables/disables the sort item controls, e.g. once an attempt has been
   * checked, until the learner retries.
   * @param {boolean} locked True to disable further reordering.
   * @returns {void}
   */
  setLocked(locked) {
    if (this.sortFieldset) {
      this.sortFieldset.disabled = locked;
    }
  }

  /**
   * Marks each sort item as correctly/incorrectly placed after checking.
   * @returns {void}
   */
  applyFeedback() {
    if (!this.sortFieldset) {
      return;
    }

    const correctOrder = this.getCorrectItemIds();

    this.currentSortOrder.forEach((itemId, index) => {
      const element = this.sortItemElements?.get(itemId);
      if (!element) {
        return;
      }

      const isCorrect = correctOrder[index] === itemId;
      element.classList.remove('codequestion-sort-item--correct', 'codequestion-sort-item--incorrect');
      element.classList.add(
        isCorrect ? 'codequestion-sort-item--correct' : 'codequestion-sort-item--incorrect',
      );

      const state = element.querySelector('.codequestion-sort-item__state');
      if (state) {
        state.textContent = getCodeQuestionL10nValue(
          this.question.l10n,
          isCorrect ? 'choiceCorrect' : 'choiceIncorrect',
        );
      }
    });
  }

  /**
   * Removes any correct/incorrect markup from the sort items, e.g. before a
   * retry.
   * @returns {void}
   */
  clearFeedback() {
    this.sortItemElements?.forEach((element) => {
      element.classList.remove('codequestion-sort-item--correct', 'codequestion-sort-item--incorrect');
      const state = element.querySelector('.codequestion-sort-item__state');
      if (state) {
        state.textContent = '';
      }
    });
  }

  /**
   * Re-shuffles the sort order and clears rendered feedback, e.g. on retry.
   * @returns {void}
   */
  reset() {
    this.currentSortOrder = this.buildDisplayOrder(this.getCorrectItemIds());
    this.setLocked(false);
    this.clearFeedback();
    this.reorderListDOM();
  }
}
