import { getCodeQuestionL10nValue } from '../services/codequestion-l10n';

export default class CodeQuestionContainer extends H5P.CodeContainer {

  getDialogQueue() {
    if (!this._dialogQueue && typeof H5P?.DialogQueue === 'function') {
      this._dialogQueue = new H5P.DialogQueue();
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
  }

  getUIRegistrations() {
    return this.mergeUIRegistrations(
      super.getUIRegistrations(),
      {
        buttons: [
          {
            identifier: 'fullscreenEnable',
            label: '',
            icon: 'fa-solid fa-maximize',
            class: 'fullscreenenable',
            weight: 9,
          },
          {
            identifier: 'fullscreenDisable',
            label: '',
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
            weight: 1,
          },
          {
            when: 'hasSoundsPage',
            identifier: 'sounds',
            label: () => this.l10n.sounds,
            icon: 'fa-solid fa-music',
            class: 'sounds',
            weight: 1,
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
   * Shows the code page.
   * @returns {void}
   */
  showCodePage() {
    this.getEditorManager?.().closeFileManager?.({ skipPageChange: true });
    this.getPageManager().showPage('code');
    if (!this.getStateManager().isRunning()) {
      this.getButtonManager().showButton('runButton');
    }

    this.getButtonManager().setActive('runButton');
    this.getButtonManager().hideButton('showCodeButton');
    this.registerDOM();
  }

  /**
   * Shows the code page.
   * @returns {void}
   */
  onHideCodePage() {
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
      if (typeof window?.alert === 'function') {
        window.alert(message);
      }
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

  enableFullscreen() {

    this.setFullscreen();
  }

  disableFullscreen() {
    this.unsetFullscreen();
  }

  getFullscreenHost() {
    return this.containerDiv?.parentNode?.parentNode || null;
  }

  getH5PContainer() {
    return this.parent?.closest?.('.h5p-container') || null;
  }

  getFullscreenInstance(h5pContainer) {
    if (this.h5pInstance) {
      return this.h5pInstance;
    }

    const instances = Array.isArray(H5P?.instances) ? H5P.instances : [];

    return instances.find((instance) => {
      const candidateContainer = instance?.$container?.[0]
        || instance?.$container?.get?.(0)
        || instance?.container?.[0]
        || instance?.container
        || null;

      return candidateContainer === h5pContainer;
    }) || null;
  }

  setFullscreen() {
    const fullscreenHost = this.getFullscreenHost();
    const h5pContainer = this.getH5PContainer();
    const fullscreenInstance = this.getFullscreenInstance(h5pContainer);

    if (!fullscreenHost
      || !h5pContainer
      || !fullscreenInstance
      || typeof H5P?.fullScreen !== 'function'
      || typeof H5P?.jQuery !== 'function') {
      return false;
    }

    this.getButtonManager().hideButton('fullscreenEnable');
    this.getButtonManager().showButton('fullscreenDisable');
    this.fullscreen = true;
    fullscreenHost.classList.add('fullscreen', 'codequestion-fullscreen-host');
    fullscreenHost.classList.remove('theme-light', 'theme-dark');
    fullscreenHost.classList.add(this.getThemeClassName());

    h5pContainer?.classList.remove('theme-light', 'theme-dark');
    h5pContainer?.classList.add(this.getThemeClassName());

    H5P.fullScreen(H5P.jQuery(h5pContainer), fullscreenInstance);

    return true;
  }

  unsetFullscreen(options = {}) {
    const { skipNativeExit = false } = options;
    const fullscreenHost = this.getFullscreenHost();
    const h5pContainer = this.getH5PContainer();

    this.getButtonManager().hideButton('fullscreenDisable');
    this.getButtonManager().showButton('fullscreenEnable');
    this.fullscreen = false;
    fullscreenHost?.classList.remove('fullscreen', 'codequestion-fullscreen-host', 'theme-light', 'theme-dark');

    h5pContainer?.classList.remove('theme-light', 'theme-dark');

    this.getEditorManager().restoreDynamicHeight();
    this.getConsoleManager().restoreConsoleHeight();

    if (!skipNativeExit && typeof H5P.exitFullScreen === 'function') {
      H5P.exitFullScreen();
    }
  }

}
