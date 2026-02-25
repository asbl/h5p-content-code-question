export default class ConsoleRuntimeManager {
  /**
   * @param {*} codeContainer Reference to the H5P code container
   * @param {string} runtimeType Prefix for the output (Runtime/Test/Solution)
   */
  constructor(codeContainer, runtimeType = "Runtime") {
    this.codeContainer = codeContainer;
    this.runtimeType = runtimeType;
    this.editorConsole = null;
  }

  /**
   * Writes a line to the editor console.
   * @param {string} text
   * @param {string} identifier optional
   */
  write(text, identifier) {
    this.codeContainer.getConsoleManager().write(text, identifier);
    this.codeContainer.getConsoleManager().showConsole(text);
  }

  /**
   * Clears the console.
   */
  clear() {
    this.codeContainer.getConsoleManager().clearConsole();
  }
}
