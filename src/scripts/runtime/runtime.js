import ConsoleRuntimeManager from './runtime-manager-console';

export class Runtime {

  constructor(resizeActionHandler, code, options) {
    this.type = 'Runtime (general)';

    this.resizeActionHandler = resizeActionHandler;
    this.isTest = false;
    this.editorConsole = null;
    this.code = code;
    this.codeContainer = null; // set in setup

    /** @type {ConsoleRuntimeManager|null} */
    this._consoleManager = null;
    this.runner = null;
    this.options = options;
    this.dialogQueue = new H5P.DialogQueue();
  }

  getConsoleManager() {
    return this._consoleManager;
  }

  getRunner() {
    console.error('H5P Base Question has no runner');
    return null;
  }

  setup(codeContainer) {
    this.codeContainer = codeContainer || null;
    if (this.codeContainer) {
      this._consoleManager ||= new ConsoleRuntimeManager(
        this.codeContainer,
        'Runtime',
      );
    }

  }

  getRunPage() {
    return 'show_code';
  }

  /**
   * Returns the current code from the editor.
   * @returns {string} Code from EditorManager associated with runtime.
   */
  getCode() {
    return this.codeContainer.getEditorManager().getCode();
  }

  /**
   * Sets the console element
   * @param editorConsole The console which should be associated with runtime
   */
  setConsole(editorConsole) {
    this.editorConsole = editorConsole;
  }

  /**
   * Shows a prompt to the user and returns the entered text.
   *
   * @param {string} promptText  The text that Python passed to input().
   * @returns {Promise<string>}   Resolves with the user's input.
   */
  inputHandler(promptText) {
    // The DialogQueue already knows how to build a SweetAlert input modal.
    // We just forward the prompt text; the queue returns a Promise<string>.
    return this.dialogQueue.enqueueInput(promptText);
  }

  /**
   * Writes output text to the console manager.
   * @param {string} text The text which should be printed by outputHandler.
   */
  outputHandler(text) {
    this._consoleManager.write(text);
    this.codeContainer.getConsoleManageR().showConsole(text);

  }


  /**
   * Setup the runtime environment
   */
  init() {
    this.setConsole(this.codeContainer.getConsoleManager().getConsole());
  }

  /**
   * Called when runtime Promise resolves successfully.
   */
  async onSuccess() {
  }

  /**
   * Called when runtime encounters an error.
   * @param {String} error The error as string
   */
  onError(error) {
    console.warn('Error while executing code:\n', error);
    this._consoleManager.write(error, '!>');
    this.codeContainer.getPageManager().showPage('code');
  }

  /**
   * Reset codeTester if available
   */
  reset() {
  }

  prepareForRun() {
    this.runner.setup();
  }

  /**
   * Stops the currently running code.
   */
  stop() {
    const stopped = this.runner.stop();
    if (stopped) {
      this.codeContainer.getStateManager().stop();
    }
  }

  /**
   * Executes Python code via runner.
   * @param {string} code - The code to execute
   */
  async runCode(code) {
    this.resizeActionHandler();
    await this.runner.execute(code);
  }

  async run() {
    await this.runCode(this.code);
  }


  start(codeContainer) {
    this.setup(codeContainer); //has to be first, because this setups this.codeContainer
    this.reset();
    this.init();
    this.prepareForRun();
    this.run();
  }

}
