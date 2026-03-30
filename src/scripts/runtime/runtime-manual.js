/**
 * Mixin that adds "manual run" behavior to a Python runtime.
 *
 * Responsibilities:
 * - Executes Python code manually
 * - Manages console output
 * - Initializes runtime environment (without Python-specific canvas)
 * @template TBase
 * @param {TBase} Base - Python runtime class to extend
 * @returns {TBase} Extended runtime class with manual execution behavior
 */
export const ManualRuntimeMixin = (Base) =>
  class extends Base {

    /**
     * Main entry point for manual execution.
     * @returns {Promise<void>}
     */
    async run() {
      await this.runCode(this.getCode());
    }

    /**
     * Writes runtime output to console.
     * @param {string} text TheOutput-Text
     * @param {boolean} dialog Should a popup dialog be used for output? 
     */
    outputHandler(text, dialog = true) {
      this._consoleManager.write(text);
      this.codeContainer.getConsoleManager().showConsole();
      if (dialog && this.shouldShowOutputDialog() && !this.containsCanvasCode?.()) {
        this.dialogQueue.enqueueAlert(text);
      }
      
    }

    setup(codeContainer) {
      super.setup(codeContainer);
      this.isTest = false;
      this._consoleManager?.clear();
      this.canvasManager?.removeCanvas();
    }

    /**
     * Executes code via runner.
     * @param {string} code - The code to execute
     */
    async runCode(code) {
      this.codeContainer.getStateManager().start();
      this.resizeActionHandler();
      await this.runner.execute(code);
    }


  };
