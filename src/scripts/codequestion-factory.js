/**
 * Factory Class for Creating instances for CodeTester, Runtime and AceEditor.
 * Some methods must be overwritten in subclasses.
 */
export default class CodeQuestionFactory {
  constructor(question) {
    this.question = question;
    this.codeTester = null;
  }

  /**
   * Creates an CodeTester Object
   */
  createCodeTester() {
    this.codeTester = new H5P.CodeTester(this.question);
  }

  /**
   * Returns Ace-Editor-Instance
   * @param {HTMLElement} _parentDiv The div in which the editor should be rendered
   * @param {string} _code The code, if this is a custom editor
   * @param {boolean} _isAssignment is Editor Part of a CodingAssignment?
   * @private
   */
  createContainer(_parentDiv, _code, _isAssignment) {
    // implemented in subclasses
  }

  /**
   * Creates a new Runtime for your Code-Question
   * @param _editor An editor instance
   * @private
   */
  createManualRuntime(_editor) {
    // implemented in subclasses
  }

  /**
   * Creates a new Runtime for your Code-Question
   * @param _codeTester An CodeTester Instance
   * @param {string} _code The code to test as string.
   * @private
   */
  createTestRuntime(_codeTester, _code) {
    // implemented in subclasses
  }
}
