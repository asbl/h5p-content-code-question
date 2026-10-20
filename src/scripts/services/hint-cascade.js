import { getCodeQuestionL10nValue, tCodeQuestion } from './codequestion-l10n';

/**
 * Didactic hint cascade: authors provide up to N hints ordered from
 * conceptual to strategic to partial solution. Learners reveal them one by
 * one via a hint button; the number of revealed hints is persisted and
 * reported through xAPI so teachers can see how much scaffolding was used.
 */
export default class HintCascade {
  /**
   * @param {object} question Owning CodeQuestion instance (l10n, DOM root).
   * @param {object} rawSettings Raw hintSettings params from semantics.
   * @param {object} [previousState] Persisted learner state.
   */
  constructor(question, rawSettings = {}, previousState = {}) {
    this.question = question;
    this.enabled = rawSettings?.enableHints === true;
    this.hints = this.normalizeHints(rawSettings);
    this.hintsRevealed = this.normalizeRevealedCount(previousState?.hintsRevealed);
    this.panelElement = null;
  }

  /**
   * Normalizes authored hints into an ordered string list.
   * @param {object} rawSettings Raw hintSettings params.
   * @returns {string[]} Non-empty hint texts in authored order.
   */
  normalizeHints(rawSettings = {}) {
    const rawHints = Array.isArray(rawSettings?.hints) ? rawSettings.hints : [];

    return rawHints
      .map((hint) => (typeof hint === 'string' ? hint : String(hint?.hint ?? hint?.text ?? '')))
      .map((hint) => hint.trim())
      .filter(Boolean);
  }

  /**
   * Restores the persisted reveal count, clamped to the hint list length.
   * @param {*} count Persisted reveal count.
   * @returns {number} Number of hints already revealed.
   */
  normalizeRevealedCount(count) {
    const parsed = Number(count);

    if (!Number.isInteger(parsed) || parsed < 0) {
      return 0;
    }

    return Math.min(parsed, this.hints.length);
  }

  /**
   * Indicates whether the hint cascade is active for this content.
   * @returns {boolean} True when enabled and at least one hint is authored.
   */
  isEnabled() {
    return this.enabled && this.hints.length > 0;
  }

  /**
   * Indicates whether another unrevealed hint is available.
   * @returns {boolean} True when the cascade is enabled and the learner can
   * reveal another hint.
   */
  hasUnrevealedHints() {
    return this.isEnabled() && this.hintsRevealed < this.hints.length;
  }

  getHintsRevealed() {
    return this.hintsRevealed;
  }

  /**
   * Renders the (initially hidden) hint panel. Called once during DOM
   * registration; revealed hints are re-added on state restore.
   * @returns {HTMLElement|null} Panel element or null when disabled.
   */
  render() {
    if (!this.isEnabled() || this.panelElement) {
      return this.panelElement || null;
    }

    const panel = document.createElement('div');
    panel.className = 'codequestion-hints';
    panel.hidden = true;

    const title = document.createElement('p');
    title.className = 'codequestion-hints__title';
    title.textContent = getCodeQuestionL10nValue(this.question.l10n, 'hintsTitle');
    panel.append(title);

    const list = document.createElement('ol');
    list.className = 'codequestion-hints__list';
    panel.append(list);

    this.panelElement = panel;

    for (let index = 0; index < this.hintsRevealed; index += 1) {
      this.appendHintItem(index);
    }

    if (this.hintsRevealed > 0) {
      panel.hidden = false;
    }

    return panel;
  }

  /**
   * Appends one revealed hint to the panel list.
   * @param {number} index Hint index to append.
   * @returns {void}
   */
  appendHintItem(index) {
    const list = this.panelElement?.querySelector('.codequestion-hints__list');
    if (!list) {
      return;
    }

    const item = document.createElement('li');
    item.className = 'codequestion-hints__item';
    item.textContent = this.hints[index];
    list.append(item);
  }

  /**
   * Reveals the next hint, if any, and updates the hint button state.
   * @returns {boolean} True when a new hint was revealed.
   */
  revealNextHint() {
    if (!this.isEnabled() || !this.hasUnrevealedHints()) {
      return false;
    }

    if (!this.panelElement) {
      this.render();
    }

    if (!this.panelElement) {
      return false;
    }

    this.appendHintItem(this.hintsRevealed);
    this.hintsRevealed += 1;
    this.panelElement.hidden = false;
    this.question.updateHintButtonState?.();

    return true;
  }

  /**
   * Localized label for the hint button.
   * @returns {string} Button label.
   */
  getButtonLabel() {
    return tCodeQuestion(this.question.l10n, 'hintButton');
  }

  /**
   * Localized title attribute describing how many hints remain.
   * @returns {string} Button title text.
   */
  getButtonTitle() {
    return tCodeQuestion(this.question.l10n, 'hintButtonTitle', {
      remaining: this.hints.length - this.hintsRevealed,
    });
  }
}
