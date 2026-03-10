export default class CodeQuestionContainer extends H5P.CodeContainer {

  async setup() {
    await super.setup();
    this.getObserverManager().register(
      'page:code:visible',
      new H5P.PageShowObserver(
        this.getPageManager().getPage('code'),
        () => this.showCodePage()
      )
    );

    this.getObserverManager().register(
      'page:code:hidden',
      new H5P.PageHideObserver(
        this.getPageManager().getPage('code'),
        () => this.onHideCodePage()
      )
    );

    // Button click observers
    this.getObserverManager().register(
      'button:showCode',
      new H5P.ButtonClickedObserver(
        this.getButtonManager().getButton('showCodeButton'),
        () => this.showCodePage()
      )
    );

    this.getObserverManager().register(
      'button:run:clicked',
      new H5P.ButtonClickedObserver(
        this.getButtonManager().getButton('runButton'),
        () => this.run()
      )
    );

    this.getObserverManager().register(
      'button:stop:clicked',
      new H5P.ButtonClickedObserver(
        this.getButtonManager().getButton('stopButton'),
        () => {
          this._runtime?.stop();
          this.getPageManager().showPage('code');
        }
      )
    );

    this.getObserverManager().register(
      'button:save:clicked',
      new H5P.ButtonClickedObserver(
        this.getButtonManager().getButton('saveButton'),
        () => this.save()
      )
    );

    this.getObserverManager().register(
      'button:load:clicked',
      new H5P.ButtonClickedObserver(
        this.getButtonManager().getButton('loadButton'),
        () => this.load()
      )
    );

    // State observers
    this.getObserverManager().register(
      'state:run:hideRunButton',
      new H5P.StateRunObserver(
        this.getStateManager(),
        () => this.hideRunButton()
      )
    );

    this.getObserverManager().register(
      'state:run:showStopButton',
      new H5P.StateRunObserver(
        this.getStateManager(),
        () => {
          this.showStopButton();
        }
      )
    );

    this.getObserverManager().register(
      'state:stop:showRunButton',
      new H5P.StateStopObserver(
        this.getStateManager(),
        () => this.showRunButton()
      )
    );

    this.getObserverManager().register(
      'state:stop:hideStopButton',
      new H5P.StateStopObserver(
        this.getStateManager(),
        () => this.hideStopButton()
      )
    );
    this.registerDOM();
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

  save() {
    this.getStorageManager().downloadCode();
  }

  load() {
    this.getStorageManager().loadFile();
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
    this.getPageManager().showPage('code');
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




}
