import { getCodeQuestionL10nValue } from './codequestion-l10n';

/**
 * Renders the authored `contents` array (text/code/image/solution-code
 * parts) into DOM nodes for a CodeQuestion instance. Kept independent of
 * the rest of the question lifecycle (buttons, hints, worked example) so
 * the markdown/editor wiring for one content part can be reasoned about on
 * its own.
 */
export default class ContentPartRenderer {
  /**
   * @param {object} question Owning CodeQuestion instance.
   */
  constructor(question) {
    this.question = question;
  }

  /**
   * Creates the outer wrapper that holds all rendered content parts.
   * @returns {HTMLDivElement} Empty content container.
   */
  createContentContainer() {
    const div = document.createElement('div');
    div.classList.add('content');
    return div;
  }

  /**
   * Renders every authored content part into one wrapper element.
   * @returns {HTMLDivElement} Wrapper containing all rendered content parts.
   */
  renderContentParts() {
    const wrapper = document.createElement('div');
    const fragment = document.createDocumentFragment();

    (this.question.contents || []).forEach((content, index) => {
      const part = this.renderContentPart(content, index);
      if (part) fragment.append(part);
    });

    wrapper.append(fragment);
    return wrapper;
  }

  /**
   * Renders one authored content part based on its type.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement|null} Rendered content part, or null for unknown types.
   */
  renderContentPart(content, index) {
    const container = document.createElement('div');
    container.classList.add('content-part');

    switch (content.type) {
      case 'text':
        return this.renderTextContent(container, content, index);
      case 'code':
        return this.renderCodeContent(container, content, index);
      case 'image':
        return this.renderImageContent(container, content, index);
      case 'solution-code':
        return this.renderSolutionCodeContent(container, content, index);
      default:
        console.warn(`Unknown content type: ${content.type}`);
        return null;
    }
  }

  /**
   * Renders a markdown text content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} _index Position within the contents array (unused).
   * @returns {HTMLElement} The populated container.
   */
  renderTextContent(container, content, _index) {
    container.classList.add('text');
    const markdown = new H5P.Markdown(
      content.text ?? '',
      this.getMarkdownOptions(),
    );
    this.appendResolvedMarkdown(container, markdown);
    return container;
  }

  /**
   * Resolves markdown asynchronously and appends the resulting DOM node.
   * This avoids rendering Promise objects as text when markdown rendering is async.
   * @param {HTMLElement} container Target container.
   * @param {object} markdown H5P markdown instance.
   * @returns {void}
   */
  appendResolvedMarkdown(container, markdown) {
    const markdownDiv = markdown.getMarkdownDiv();
    const fallbackText = markdown.text ?? '';

    const notifyRendered = () => {
      try {
        this.question.resizeActionHandler();
      }
      catch (_error) {
        // Rendering text is more important than surfacing resize failures from test doubles.
      }
    };

    const appendFallback = () => {
      const fallback = document.createElement('div');
      fallback.className = 'markdown-fallback';
      fallback.textContent = fallbackText;
      container.append(fallback);
      notifyRendered();
    };

    if (typeof markdownDiv?.then === 'function') {
      markdownDiv
        .then((resolvedMarkdownDiv) => {
          if (resolvedMarkdownDiv) {
            container.append(resolvedMarkdownDiv);
            notifyRendered();
            return;
          }

          appendFallback();
        })
        .catch((error) => {
          console.error('Failed to render markdown content', error);
          appendFallback();
        });

      return;
    }

    if (markdownDiv) {
      container.append(markdownDiv);
      notifyRendered();
      return;
    }

    appendFallback();
  }

  /**
   * Determines whether an inline content code editor should be shown.
   * Supports both legacy top-level `showEditor` and nested `options.showEditor`.
   * @param {object} content - Inline content item params.
   * @returns {boolean} True if an editor should be rendered.
   */
  shouldShowInlineEditor(content = {}) {
    if (typeof content?.showEditor === 'boolean') {
      return content.showEditor;
    }

    if (typeof content?.options?.showEditor === 'boolean') {
      return content.options.showEditor;
    }

    return true;
  }

  /**
   * Returns markdown renderer options shared with CodeContainer-based views.
   * @param {object|null} [contentParams] Optional inline content item params.
   * @returns {object} Markdown runtime options.
   */
  getMarkdownOptions(contentParams = null) {
    const options = this.question.getCodeContainerOptions(contentParams) || {};

    return {
      codeMirrorCdnUrl: options.codeMirrorCdnUrl || '',
      markdownCdnUrl: options.markdownCdnUrl || '',
      mermaidCdnUrl: options.mermaidCdnUrl || '',
    };
  }

  /**
   * Renders an inline code content part, either as a read-only markdown
   * code block or as a live inline editor.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement} The populated container.
   */
  renderCodeContent(container, content, index) {
    const question = this.question;
    container.classList.add('code');
    if (!this.shouldShowInlineEditor(content)) {
      const md = '```' + question.getCodingLanguage() + '\n' +
        question.getDecodedCode(content.code) + '\n```';
      const markdown = new H5P.Markdown(md, this.getMarkdownOptions(content));
      this.appendResolvedMarkdown(container, markdown);
    }
    else {
      const editorWrapper = document.createElement('div');
      const containerId = content.id || index;
      // Saved learner work (including Blockly blocks) is restored via the
      // workspace snapshot only. It must not be passed as content params,
      // because those define the authored starting state a reset returns to.
      const savedState = question.extras?.previousState?.contentItemStates?.[containerId];
      const factory = question.getContainerFactory(
        editorWrapper,
        question.getDecodedCode(content.code),
        false,
        content,
      );
      const codeContainer = factory.create();
      question.applyContainerState(codeContainer, savedState);
      container.append(codeContainer.getDOM());

      question.codeContainers.set(containerId, codeContainer);
    }
    return container;
  }

  /**
   * Renders a collapsible reference-solution code content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} _index Position within the contents array (unused).
   * @returns {HTMLElement} The populated container.
   */
  renderSolutionCodeContent(container, content, _index) {
    const question = this.question;
    container.classList.add('code');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const body = document.createElement('div');
    details.classList.add('solution-code');
    const md = '```' + question.getCodingLanguage() + '\n' +
      question.getDecodedCode(content.code) + '\n```';
    const markdown = new H5P.Markdown(md, this.getMarkdownOptions(content));
    summary.textContent = getCodeQuestionL10nValue(question.l10n, 'solutionCode');
    this.appendResolvedMarkdown(body, markdown);
    details.append(summary, body);
    container.append(details);
    return container;
  }

  /**
   * Renders an image content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} _index Position within the contents array (unused).
   * @returns {HTMLElement} The populated container.
   */
  renderImageContent(container, content, _index) {
    const question = this.question;
    container.classList.add('image');
    const img = document.createElement('img');
    img.classList.add('description-image');
    img.src = H5P.getPath(content.image.path, question.contentId);
    img.alt = content.image.copyright?.title ?? '';
    container.append(img);
    return container;
  }
}
