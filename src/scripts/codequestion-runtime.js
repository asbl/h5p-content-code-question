import Swal from 'sweetalert2-uncensored';

/**
 * A Runtime Evironment stores Information on how code should be executed. 
 * (E.g.: The PythonRuntime stores Information how python code can be executed)
 */
export default class Runtime {

  /**
   * @param {CodeQuestion} [question] - Optional: A Codequestion-Instance - Needed if answer can be evaluated. 
   * @param {AceEditor} editor
   */
  constructor(question, editor = null) {
    this.question = question;
    this.codeTester = question.codeTester;
    this.isTest = false;
    this.editor = editor ? editor : this.question.editor;
  }

  /**
   * Sets the console div
   * @param {HTMLElement} console The element containing the console
   */
  setConsole(console) {
    this.console = console;
  }

  /**
   * Gets a prompt from user
   * @returns {Promise} A Promise containing the prompt. 
   */
  getPrompt() {
    return (title, description, defaultValue) => new Promise(async (resolve) =>  {
      const inputValue = await Swal.fire({
        title: title,
        input: 'text',
        inputLabel: description,
        defaultValue: defaultValue
      }
      );
      resolve(inputValue.value);
    });
  }

  notifyError(message) {
    alertify.notify('ERROR: ' + message, 'error', 5);
  }

  setupEnvironment() {
    this.setConsole(this.editor.getConsole());
  }

  /**
   * Called when runtime Promise resolves successfully.
   */
  async onSuccess() {   
  }

  onError() {

  }

  reset() {
    if (this.codeTester) {
      this.codeTester.reset();
    }
  }
}