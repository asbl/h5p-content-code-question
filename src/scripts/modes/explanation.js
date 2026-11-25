import { getCodeQuestionL10nValue } from '../services/codequestion-l10n';

const EXPLANATION_CLASS = 'codequestion-explanation';

/**
 * Normalizes an authored explanation text.
 * @param {*} value - Raw semantics value.
 * @returns {string} Trimmed explanation, empty when none was authored.
 */
export function normalizeExplanation(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Removes a previously rendered explanation from a host element.
 * @param {HTMLElement|null} host - Element that contains the explanation.
 * @returns {void}
 */
export function clearExplanation(host) {
  host?.querySelectorAll?.(`:scope > .${EXPLANATION_CLASS}`).forEach((node) => node.remove());
}

/**
 * Renders the authored explanation below an answered question. It is shown
 * after every check, correct or not, because the reasoning is what turns
 * a right/wrong verdict into learning. Markdown is supported.
 * @param {object} question - Owning CodeQuestion (l10n and markdown rendering).
 * @param {HTMLElement|null} host - Element to append the explanation to.
 * @param {string} explanation - Authored explanation text.
 * @returns {HTMLElement|null} The rendered element, or null when nothing is shown.
 */
export function showExplanation(question, host, explanation) {
  clearExplanation(host);
  if (!host || !explanation) {
    return null;
  }

  const box = document.createElement('div');
  box.className = EXPLANATION_CLASS;
  box.setAttribute('role', 'status');

  const heading = document.createElement('strong');
  heading.className = `${EXPLANATION_CLASS}__heading`;
  heading.textContent = getCodeQuestionL10nValue(question.l10n, 'explanationHeading');

  const body = document.createElement('div');
  body.className = `${EXPLANATION_CLASS}__body`;
  const markdown = new H5P.Markdown(explanation, question.getMarkdownOptions());
  question.appendResolvedMarkdown(body, markdown);

  box.append(heading, body);
  host.append(box);
  return box;
}
