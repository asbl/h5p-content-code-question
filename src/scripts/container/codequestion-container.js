import { getCodeQuestionL10nValue } from '../services/codequestion-l10n';
import ContainerFullscreenManager from '../services/container-fullscreen-manager';

export default class CodeQuestionContainer extends H5P.CodeContainer {

  getDialogTarget() {
    if (!this.parent) {
      return null;
    }

    return this.parent.closest('.h5p-codequestion')
      || this.parent.closest('.h5p-question')
      || this.parent;
  }

  getDialogQueue() {
    if (!this._dialogQueue && typeof H5P?.DialogQueue === 'function') {
      this._dialogQueue = new H5P.DialogQueue({
        target: this.getDialogTarget(),
        sweetAlertCdnUrl: this.options?.sweetAlertCdnUrl || '',
      });
    }

    if (this._dialogQueue?.setTarget) {
      this._dialogQueue.setTarget(this.getDialogTarget());
    }

    return this._dialogQueue || null;
  }

  applyTheme() {
    super.applyTheme();

    const questionRoot = this.parent.closest('.h5p-codequestion');
    if (questionRoot) {
      questionRoot.classList.remove('theme-light', 'theme-dark');
      questionRoot.classList.add(this.getThemeClassName());
    }
  }

  async setup() {
    await super.setup();
    this.restorePreferredTheme();
    this.ensureWorkspaceFeedback();
  }

  getThemeStorageKey() {
    return 'h5p-codequestion:theme';
  }

  restorePreferredTheme() {
    try {
      const theme = window.localStorage?.getItem(this.getThemeStorageKey());
      if (theme === 'light' || theme === 'dark') {
        super.setTheme(theme);
      }
    }
    catch (_) {
      // Storage can be unavailable in privacy-restricted embeds.
    }
  }

  setTheme(theme) {
    super.setTheme(theme);

    try {
      window.localStorage?.setItem(this.getThemeStorageKey(), this.getTheme());
    }
    catch (_) {
      // A theme switch must still work when persisting it is not possible.
    }
  }

  ensureWorkspaceFeedback() {
    if (this.workspaceFeedback || !this.getContainerDiv?.()) {
      return;
    }

    const feedback = document.createElement('div');
    feedback.className = 'codequestion-workspace-feedback';
    feedback.setAttribute('aria-live', 'polite');
    feedback.hidden = true;

    const status = document.createElement('span');
    status.className = 'codequestion-run-status';
    feedback.append(status);

    const error = document.createElement('div');
    error.className = 'codequestion-error-card';
    error.hidden = true;

    const errorHeader = document.createElement('div');
    errorHeader.className = 'codequestion-error-card__header';

    const errorTitle = document.createElement('strong');
    errorTitle.textContent = getCodeQuestionL10nValue(this.l10n, 'executionErrorTitle');

    const errorDismiss = document.createElement('button');
    errorDismiss.type = 'button';
    errorDismiss.className = 'codequestion-error-card__dismiss';
    errorDismiss.setAttribute('aria-label', getCodeQuestionL10nValue(this.l10n, 'dismissError'));
    errorDismiss.textContent = '×';
    errorDismiss.addEventListener('click', () => this.dismissExecutionError());

    errorHeader.append(errorTitle, errorDismiss);

    const errorMessage = document.createElement('p');
    const errorAction = document.createElement('button');
    errorAction.type = 'button';
    errorAction.className = 'codequestion-error-card__action';
    errorAction.textContent = getCodeQuestionL10nValue(this.l10n, 'jumpToError');
    errorAction.addEventListener('click', () => this.focusErrorLine());
    error.append(errorHeader, errorMessage, errorAction);
    feedback.append(error);

    this.getContainerDiv().prepend(feedback);
    this.workspaceFeedback = { root: feedback, status, error, errorMessage, errorAction, errorDismiss };
  }

  /**
   * Hides the execution error notification without waiting for the next run.
   * @returns {void}
   */
  dismissExecutionError() {
    if (!this.workspaceFeedback) {
      return;
    }

    const { root, error } = this.workspaceFeedback;
    error.hidden = true;
    root.hidden = true;
    this.lastExecutionError = null;
  }

  setExecutionStatus(state, options = {}) {
    this.ensureWorkspaceFeedback();
    if (!this.workspaceFeedback) {
      return;
    }

    const { root, status, error } = this.workspaceFeedback;
    const labels = {
      running: getCodeQuestionL10nValue(this.l10n, 'executionRunning'),
      success: getCodeQuestionL10nValue(this.l10n, 'executionFinished'),
      stopped: getCodeQuestionL10nValue(this.l10n, 'executionStopped'),
    };

    root.hidden = false;
    root.dataset.state = state;
    status.textContent = labels[state] || '';
    if (state !== 'error') {
      error.hidden = true;
      this.lastExecutionError = null;
    }

    if (state === 'error') {
      this.showExecutionError(options.error || '');
    }
  }

  showExecutionError(error) {
    this.ensureWorkspaceFeedback();
    if (!this.workspaceFeedback) {
      return;
    }

    const executionError = this.normalizeExecutionError(error);
    this.lastExecutionError = executionError;

    const { root, status, error: errorCard, errorMessage, errorAction } = this.workspaceFeedback;
    root.hidden = false;
    root.dataset.state = 'error';
    status.textContent = getCodeQuestionL10nValue(this.l10n, 'executionFailed');
    errorMessage.textContent = executionError.message;
    errorAction.hidden = !this.lastExecutionError.line;
    errorCard.hidden = false;
  }

  normalizeExecutionError(error) {
    const message = this.getExecutionErrorMessage(error);
    const line = this.getExecutionErrorLine(error, message);

    return { message, line };
  }

  getExecutionErrorMessage(error) {
    if (typeof error === 'string') {
      return error.trim();
    }

    const message = String(error?.message || error?.toString?.() || error || '').trim();
    const diagnostics = Array.isArray(error?.diagnostics)
      ? error.diagnostics.filter(Boolean).map((diagnostic) => String(diagnostic).trim()).filter(Boolean)
      : [];

    return diagnostics.length
      ? `${message}\n${diagnostics.join('\n')}`.trim()
      : message;
  }

  getExecutionErrorLine(error, message = '') {
    const directLine = Number(
      error?.line
      ?? error?.lineno
      ?? error?.lineNumber
      ?? error?.position?.line
      ?? error?.traceback?.[0]?.lineno
      ?? error?.traceback?.at?.(-1)?.lineno,
    );

    if (Number.isInteger(directLine) && directLine > 0) {
      return directLine;
    }

    const lineMatch = String(message || '').match(
      /(?:line|zeile)\s*[:#]?\s*(\d+)|<exec>\s*,\s*line\s+(\d+)|File\s+"<[^"]+>"\s*,\s*line\s+(\d+)/i,
    );

    if (!lineMatch) {
      return null;
    }

    const line = Number(lineMatch[1] || lineMatch[2] || lineMatch[3]);
    return Number.isInteger(line) && line > 0 ? line : null;
  }

  focusErrorLine() {
    const line = this.lastExecutionError?.line;
    if (!line) {
      return;
    }

    this.showCodePage();
    const editor = this.getEditorManager?.().getActiveEditorInstance?.();
    if (typeof editor?.focusLine === 'function') {
      editor.focusLine(line);
      return;
    }

    const view = editor?.editorView;
    if (!view?.state?.doc || typeof view.dispatch !== 'function') {
      this.getEditorManager?.().focus?.();
      return;
    }

    const safeLine = Math.min(Math.max(1, line), view.state.doc.lines);
    const position = view.state.doc.line(safeLine).from;
    view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
    view.focus?.();
  }

  getUIRegistrations() {
    return this.mergeUIRegistrations(
      super.getUIRegistrations(),
      {
        buttons: [
          {
            identifier: 'fullscreenEnable',
            label: '',
            ariaLabel: () => getCodeQuestionL10nValue(this.l10n, 'fullscreenEnter') || 'Enter fullscreen',
            icon: 'fa-solid fa-maximize',
            class: 'fullscreenenable',
            weight: 9,
          },
          {
            identifier: 'fullscreenDisable',
            label: '',
            ariaLabel: () => getCodeQuestionL10nValue(this.l10n, 'fullscreenExit') || 'Exit fullscreen',
            icon: 'fa-solid fa-down-left-and-up-right-to-center',
            class: 'fullscreendisable',
            state: 'hidden',
            weight: 9,
          },
          {
            when: 'hasInstructionsPage',
            identifier: 'instructions',
            label: () => getCodeQuestionL10nValue(this.l10n, 'instructions'),
            icon: 'fa-solid fa-note-sticky',
            class: 'instructions',
            weight: 1,
          },
          {
            when: 'hasImagesPage',
            identifier: 'images',
            label: () => this.l10n.images,
            icon: 'fa-solid fa-image',
            class: 'images',
            weight: 0,
          },
          {
            when: 'hasSoundsPage',
            identifier: 'sounds',
            label: () => this.l10n.sounds,
            class: 'sounds',
            weight: 0,
          },
        ],
        pages: [
          {
            when: 'hasInstructionsPage',
            name: 'instructions',
            content: () => this.getInstructionsManager().getDOM(),
            additionalClass: 'instructions',
            front: true,
            visible: false,
          },
          {
            when: 'hasImagesPage',
            name: 'images',
            content: () => this.getImageManager().getDOM(),
            additionalClass: 'images',
            visible: false,
          },
          {
            when: 'hasSoundsPage',
            name: 'sounds',
            content: () => this.getSoundManager().getDOM(),
            additionalClass: 'sounds',
            visible: false,
          },
        ],
        observers: [
          {
            name: 'page:code:visible',
            type: 'page-show',
            page: 'code',
            callback: 'showCodePage',
          },
          {
            name: 'page:code:hidden',
            type: 'page-hide',
            page: 'code',
            callback: 'onHideCodePage',
          },
          {
            name: 'button:showCode',
            type: 'button-click',
            button: 'showCodeButton',
            callback: 'showCodePage',
          },
          {
            name: 'button:run:clicked',
            type: 'button-click',
            button: 'runButton',
            callback: 'run',
          },
          {
            name: 'button:stop:clicked',
            type: 'button-click',
            button: 'stopButton',
            callback: 'stop',
          },
          {
            name: 'button:fullscreen:enable',
            type: 'button-click',
            button: 'fullscreenEnable',
            callback: 'enableFullscreen',
          },
          {
            name: 'button:fullscreen:disable',
            type: 'button-click',
            button: 'fullscreenDisable',
            callback: 'disableFullscreen',
          },
          {
            when: 'hasStorageButtons',
            name: 'button:save:clicked',
            type: 'button-click',
            button: 'saveButton',
            callback: 'save',
          },
          {
            when: 'hasStorageButtons',
            name: 'button:load:clicked',
            type: 'button-click',
            button: 'loadButton',
            callback: 'load',
          },
          {
            when: 'hasInstructionsPage',
            name: 'button:instructions:clicked',
            type: 'button-click',
            button: 'instructions',
            callback: 'showInstructionsPage',
          },
          {
            when: 'hasImagesPage',
            name: 'button:images:clicked',
            type: 'button-click',
            button: 'images',
            callback: 'showImagesPage',
          },
          {
            when: 'hasSoundsPage',
            name: 'button:sounds:clicked',
            type: 'button-click',
            button: 'sounds',
            callback: 'showSoundsPage',
          },
          {
            name: 'state:run:hideRunButton',
            type: 'state-run',
            callback: 'hideRunButton',
          },
          {
            name: 'state:run:showStopButton',
            type: 'state-run',
            callback: 'showStopButton',
          },
          {
            name: 'state:stop:showRunButton',
            type: 'state-stop',
            callback: 'showRunButton',
          },
          {
            name: 'state:stop:hideStopButton',
            type: 'state-stop',
            callback: 'hideStopButton',
          },
        ],
      },
    );
  }

  hasInstructionsPage() {
    return this.getInstructionsManager().getDOM() !== null;
  }

  hasImagesPage() {
    return this.getImageManager().isEnabled();
  }

  hasSoundsPage() {
    return this.getSoundManager().isEnabled();
  }

  /**
   * Return language mode
   * @returns {string} 'codequestion' -> should be overwritten, e.g python, sql, ...
   */
  getMode() {
    return 'codequestion';
  }

  /**
   * Clears pending deferred editor focus callbacks.
   * @returns {void}
   */
  clearPendingEditorFocus() {
    if (Array.isArray(this._editorFocusRafIds) && typeof window?.cancelAnimationFrame === 'function') {
      this._editorFocusRafIds.forEach((id) => window.cancelAnimationFrame(id));
    }

    if (Array.isArray(this._editorFocusTimeoutIds) && typeof window?.clearTimeout === 'function') {
      this._editorFocusTimeoutIds.forEach((id) => window.clearTimeout(id));
    }

    this._editorFocusRafIds = [];
    this._editorFocusTimeoutIds = [];
  }

  /**
   * Returns whether focusing this instance's editor is still safe.
   * @returns {boolean} True if this instance should own editor focus now.
   */
  shouldFocusEditor() {
    if (this.getPageManager().activePageName !== 'code') {
      return false;
    }

    const hasParent = typeof this.parent?.contains === 'function';
    if (hasParent && this.parent.isConnected === false) {
      return false;
    }

    const ownerDocument = this.parent?.ownerDocument || globalThis.document;
    if (!ownerDocument) {
      return false;
    }

    const activeElement = ownerDocument?.activeElement;

    if (!activeElement || activeElement === ownerDocument.body) {
      return true;
    }

    if (!hasParent) {
      return true;
    }

    // Do not steal focus from another instance that has become active.
    return this.parent.contains(activeElement);
  }

  /**
   * Schedules deferred editor focus guarded by page and active-element checks.
   * @returns {void}
   */
  scheduleEditorFocus() {
    this._editorFocusToken = (this._editorFocusToken || 0) + 1;
    const token = this._editorFocusToken;

    const focusEditor = () => {
      if (token !== this._editorFocusToken) {
        return;
      }

      if (!this.shouldFocusEditor()) {
        return;
      }

      this.getEditorManager?.().focus?.();
    };

    if (typeof window?.requestAnimationFrame === 'function') {
      const outerId = window.requestAnimationFrame(() => {
        const innerId = window.requestAnimationFrame(focusEditor);
        this._editorFocusRafIds.push(innerId);
      });
      this._editorFocusRafIds.push(outerId);
    }
    else {
      focusEditor();
    }

    if (typeof window?.setTimeout === 'function') {
      this._editorFocusTimeoutIds.push(window.setTimeout(focusEditor, 50));
      this._editorFocusTimeoutIds.push(window.setTimeout(focusEditor, 200));
    }
  }

  /**
   * Shows the code page.
   * @returns {void}
   */
  showCodePage() {
    const wasOnCodePage = this.getPageManager().activePageName === 'code';
    this.getEditorManager?.().closeFileManager?.({ skipPageChange: true });
    this._runtime?.runner?.releaseInputFocus?.();
    this.getPageManager().showPage('code');
    if (!this.getStateManager().isRunning()) {
      this.getButtonManager().showButton('runButton');
    }

    this.getButtonManager().setActive('runButton');
    this.getButtonManager().hideButton('showCodeButton');
    if (!wasOnCodePage) {
      this.registerDOM();
    }

    this.clearPendingEditorFocus();
    this.scheduleEditorFocus();
  }

  /**
   * Shows the code page.
   * @returns {void}
   */
  onHideCodePage() {
    this.clearPendingEditorFocus();
    this.getButtonManager().hideButton('runButton');
    this.getButtonManager().showButton('showCodeButton');
  }

  showInstructionsPage() {
    this.getPageManager().showPage('instructions');
  }

  showImagesPage() {
    this.getPageManager().showPage('images');
    this.getButtonManager().setActive('images');
  }

  showSoundsPage() {
    this.getPageManager().showPage('sounds');
    this.getButtonManager().setActive('sounds');
  }

  save() {
    this.getStorageManager().downloadCode();
  }

  getLoadErrorMessage(error) {
    switch (error?.code) {
      case 'load_invalid_project_bundle':
      case 'load_project_apply_failed':
        return this.l10n.loadInvalidProjectBundle;
      case 'load_unsupported_file_type':
        return this.l10n.loadUnsupportedFileType;
      case 'load_read_failed':
        return this.l10n.loadReadError;
      default:
        return this.l10n.loadFailedMessage;
    }
  }

  async showLoadError(error) {
    console.error('[CodeQuestionContainer] Load failed.', error);

    const dialogQueue = this.getDialogQueue();
    const message = this.getLoadErrorMessage(error);

    if (!dialogQueue) {
      console.error(message);
      return;
    }

    await dialogQueue.enqueueAlert({
      title: this.l10n.loadFailedTitle,
      text: message,
      confirmButtonText: 'OK',
      showCancelButton: false,
    });
  }

  async load() {
    try {
      const loaded = await this.getStorageManager().loadFile();

      if (!loaded) {
        return false;
      }

      this.stop();
      this.reset();
      this.getCanvasManager()?.removeCanvas?.();
      this.showCodePage();
      this.hideStopButton();
      this.showRunButton();
      this.updateCanvasButton?.();

      return true;
    }
    catch (error) {
      await this.showLoadError(error);
      return false;
    }
  }

  /**
   * Starts the code runtime and switches to the runtime page.
   * @returns {void}
   */
  run() {
    this._runtime?.stop();
    this._runtime = this.runtimeFactory.create();
    this.setExecutionStatus('running');
    this.getPageManager().showPage(this._runtime.getRunPage());
    this._runtime.start(this);
  }

  /**
   * Stops the code runtime
   * @returns {void}
   */
  stop() {
    this._runtime?.stop();
    this.getStateManager().stop();
    this.setExecutionStatus('stopped');
    this.showCodePage();
  }

  /**
   * Shows the canvas page if a canvas exists and is visible.
   * @returns {void}
   */
  showCanvas() {
    if (this.getCanvasManager().hasCanvas && this.getCanvasManager().hasVisibleCanvas()) {
      this.getPageManager().showPage('canvas');
      this.getButtonManager().showButton('canvas');
    }
  }

  /**
   * Updates visibility of the canvas button based on
   * canvas visibility and active page state.
   * @returns {void}
   */
  updateCanvasButton() {
    const visible = this.getCanvasManager().hasVisibleCanvas();
    const isActive = this.getPageManager().activePageName === 'canvas';

    this.updateButtonVisibility('canvas', visible && !isActive);
  }

  /**
   * Helper method to show or hide a button based on visibility state.
   * @param {string} buttonName
   *   Identifier of the button.
   * @param {boolean} isVisible
   *   Whether the button should be visible.
   * @returns {void}
   */
  updateButtonVisibility(buttonName, isVisible) {
    if (isVisible) {
      this.getButtonManager().showButton(buttonName);
    }
    else {
      this.getButtonManager().hideButton(buttonName);
    }
  }

  /**
   * Hides the run button.
   * @returns {void}
   */
  hideRunButton() {
    this.getButtonManager().hideButton('runButton');
  }

  /**
   * Shows the run button.
   * @returns {void}
   */
  showRunButton() {
    this.getButtonManager().showButton('runButton');
  }


  hideCodeButton() {
    this.getButtonManager().hideButton('showCodeButton');
  }

  /**
   * Hides the stop button.
   * @returns {void}
   */
  hideStopButton() {
    this.getButtonManager().hideButton('stopButton');
  }

  /**
   * Shows the stop button.
   * @returns {void}
   */
  showStopButton() {
    this.getButtonManager().showButton('stopButton');
  }

  /**
   * Returns the fullscreen manager, created lazily since the container's
   * parent/DOM refs are not guaranteed to exist yet at construction time.
   * @returns {ContainerFullscreenManager} Fullscreen manager instance.
   */
  getFullscreenManager() {
    if (!this._fullscreenManager) {
      this._fullscreenManager = new ContainerFullscreenManager(this);
    }

    return this._fullscreenManager;
  }

  /**
   * Enters fullscreen and reveals the task panel, if entering succeeded.
   * @returns {void}
   */
  enableFullscreen() {
    this.getFullscreenManager().enableFullscreen();
  }

  /**
   * Hides the task panel and exits fullscreen.
   * @returns {void}
   */
  disableFullscreen() {
    this.getFullscreenManager().disableFullscreen();
  }

  /**
   * Returns the DOM element that should receive fullscreen styling.
   * @returns {HTMLElement|null} Fullscreen host element.
   */
  getFullscreenHost() {
    return this.getFullscreenManager().getFullscreenHost();
  }

  /**
   * Returns the surrounding H5P container element.
   * @returns {HTMLElement|null} H5P container element.
   */
  getH5PContainer() {
    return this.getFullscreenManager().getH5PContainer();
  }

  /**
   * Resolves the H5P instance that owns the given container.
   * @param {HTMLElement|null} h5pContainer H5P container element.
   * @returns {object|null} H5P content instance.
   */
  getFullscreenInstance(h5pContainer) {
    return this.getFullscreenManager().getFullscreenInstance(h5pContainer);
  }

  /**
   * Enters fullscreen via H5P.fullScreen(), if all prerequisites resolve.
   * @returns {boolean} True if fullscreen was entered.
   */
  setFullscreen() {
    return this.getFullscreenManager().setFullscreen();
  }

  /**
   * Exits fullscreen and restores non-fullscreen button/theme state.
   * @param {object} [options] Exit options.
   * @returns {void}
   */
  unsetFullscreen(options = {}) {
    return this.getFullscreenManager().unsetFullscreen(options);
  }

}
