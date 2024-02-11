import Util from './services/util';
import CodeQuestionFactory from './codequestion-factory';
import Swal from 'sweetalert2-uncensored';

export default class CodeQuestion extends H5P.Question {
  /**
   * @class
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super('codequestion');
    this.params = params;
    this.l10n = this.params.l10n;
    this.contentId = contentId;
    this.extras = extras;
    // Make sure all variables are set
    this.params = Util.extend({
      behaviour: {
        enableSolutionsButton: true,
        enableRetry: true,
        enableCheckButton: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false
      }
    }, this.params);
    this.score = 0;
    this.answerGiven = false;
    this.passed = false;
    this.maxScore = 2;
    this.parentDiv = document.createElement('div');
    // load values from semantics.json.
    this.contents = params.contents;
   
    this.defaultCode = (params.editorSettings.startingCode !== undefined) ? params.editorSettings.startingCode : '';
    this.editor = null; // set in registerDOM Elements
    this.factory = this.getFactory();

    this.contentType = (params.contentType);
    this.instructions = (params.editorSettings.instructions !== undefined) ? params.editorSettings.instructions : null;
    this.instructionsImage = (params.editorSettings.instructionsImage !== undefined) ? params.editorSettings.instructionsImage : null;

    this.preCode = (params.editorSettings.preCode !== undefined) ? params.editorSettings.preCode : null;
    this.postCode = (params.editorSettings.postCode !== undefined) ? params.editorSettings.postCode : null;

    this.gradingMethod = params.gradingSettings.gradingMethod !== 'none' ? params.gradingSettings.gradingMethod : null;
    this.assetsAreaUID = `h5p_assets_area_${H5P.createUUID()}`;
    this.codeQuestionUID = `h5p_code_question_${H5P.createUUID()}`;
    this.testcases =  params.gradingSettings.testCases !== undefined ? params.gradingSettings.testCases : [];
    this.codeTester = this.factory.createCodeTester(this.testcases);
    this.hasCanvas = true;
    this.hasConsole = true;
    this.hasRunButton = true;
    this.hasCheckButton = true;
    this.hasStopButton = true;
    this.hasTestCaseArea = true;
    this.language = 'python';
    this.hasAssets = false;
    this.targetCode = params.gradingSettings.targetCode;
  } // end of constructor
  
  getL10n() {
    return this.l10n;
  }

  /**
    Used for css
    @returns {string} question name as string for css-class.
   */
  getQuestionName() {
    return 'h5p-code-question';
  }
  
  getFactory() {
    return new CodeQuestionFactory(this);
  }

  getTitle() {
    return 'Code-Question';
  }

  /**
   * Get description.
   * @returns {string} Description.
   */
  getDescription() {
    return 'Code-Question';
  }

  getSolution() {
    return '';
  }

  /**
   * Removes special chars from a string. This is need for loading code and other values from 
   * settings.
   * @param {string} code The code which should be converted
   * @returns {string} Converted code
   */
  getDecodedCode(code) {
    code = typeof code === 'string' ? code : '';
    code = code.replace(/&lt;/g, '<');
    code = code.replace(/&gt;/g, '>');
    code = code.replace(/&quot;/g, '"');
    code = code.replace(/&#39;/g, '\'');
    code = code.replace(/&#039;/g, '\'');
    code = code.replace(/&amp;/g, '&');
    return code;
  }

  runAction() {
    const runtime = this.factory.createManualRuntime(this.editor);
    runtime.reset();
    runtime.run();
  }

  checkAction() {
    const runtime = this.factory.createTestRuntime(this.codeTester, this.editor.getCode());
    runtime.reset();
    runtime.run();
  }

  /**
   * Add H5P-Buttons below Question (Run, stop, Check, ...)
   */
  addButtons() {
    if (this.hasRunButton) {
      this.addButton('run', this.l10n.run, () => {
        this.runAction();
      });
    }
    if (this.hasCheckButton) {
      this.addButton('check-answer', this.l10n.checkAnswer, () => {
        this.checkAction();
      });
    }
  }

  /**
   * Registers DOM Elements for Code Question.
   */
  registerDomElements() {
    this.parentDiv.id = this.codeQuestionUID;
    this.parentDiv.classList.add(this.getQuestionName());
    let contentDiv = document.createElement('div');
    contentDiv.classList.add('content');
    if (this.contentType !== 'ide_only') {
      this.contents.forEach((content) => {
        let contentPartDiv = document.createElement('div');
        contentPartDiv.classList.add('content-part');
        if (content.type === 'text') {
          content.text = content.text ? content.text : '';
          contentPartDiv.classList.add('text');
          const textMD = new H5P.Markdown(content.text);
          contentPartDiv.append(textMD.getMarkdownDiv());
          contentDiv.append(contentPartDiv);
        }
        else if (content.type === 'code') {
          contentPartDiv.classList.add('code');
          if (!content.showEditor) {
            let code = '```' + this.language  + '\n' + this.getDecodedCode(content.code) + '\n```';
            const textMD = new H5P.Markdown(code);
            contentPartDiv.append(textMD.getMarkdownDiv());
          }
          else {
            let codeFieldEditorParent = document.createElement('div');
            const editor = this.factory.createEditor(codeFieldEditorParent, content.code, false);
            contentPartDiv.innerHTML = editor.getDOM().outerHTML;
          }
          contentDiv.append(contentPartDiv);
        }
        else if (content.type === 'image') {
          contentPartDiv.classList.add('image');
          const path = H5P.getPath(content.image.path, this.contentId);
          const alt = content.image.copyright.title ? content.image.copyright.title : '';
          let html = `<img class="description-image" alt="${alt}" src="${path}">`;
          contentPartDiv.innerHTML = html;
          contentDiv.append(contentPartDiv);
        }
      });
    }
    if (this.contentType === 'text_and_ide' || this.contentType === 'ide_only')  {
      this.editorParent = document.createElement('div');
      this.editorParent.id = `assignment-editor-wrapper-${H5P.createUUID()}`;
      this.editor = this.factory.createEditor(this.editorParent, this.defaultCode, true);
      this.editorParent.innerHTML = this.editor.getDOM().outerHTML;
      contentDiv.append(this.editorParent);
      if (this.instructions) {
        const instructionsDiv = document.createElement('div');
        instructionsDiv.classList.add('instructions');
        const instructionsMD = new H5P.Markdown(this.instructions);
        instructionsDiv.append(instructionsMD.getMarkdownDiv());
        if (this.instructionsImage) {
          const imageDIV = document.createElement('div');
          const path = H5P.getPath(this.instructionsImage.path, this.contentId);
          const alt = this.instructionsImage.copyright.title ? this.image.copyright.title : '';
          let html = `<img class="description-image" alt="${alt}" src="${path}">`;
          imageDIV.innerHTML = html;
          instructionsDiv.append(imageDIV);
        }
        contentDiv.append(instructionsDiv);
        this.editor.addInstructions(instructionsDiv);
      }
      

      if (this.hasAssets) {
        this.parentDiv.append(this.generateAssetsArea());
      }
      
    }

    this.parentDiv.append(contentDiv);
    this.setContent(this.parentDiv);
    
    if (this.contentType === 'text_and_ide' || this.contentType === 'ide_only') { 
      // Register Buttons
      if (this.gradingMethod) {
        this.addButtons();
      }
      if (this.gradingMethod && this.hasTestCaseArea) {
        this.parentDiv.append(this.codeTester.generateTestCasesArea());
      }
    }
    this.trigger('resize');
  }

  /** 
   * Generates the assets-area (before editor) - Called from registerDomElements
   * @returns {HTMLElement} The area for assets.
   */
  generateAssetsArea() {
    const assetsArea = document.createElement('div');
    assetsArea.id = this.assetsAreaUID;
    return assetsArea;
  }

  /**
   * Question Type contract
   * Checks if answers for this task has been given, and the program can proceed to calculate scores. Should return false if the user can not proceed yet.
   * @returns {boolean} true if answers have been given, else false.
   */
  getAnswerGiven() {
    return this.answerGiven;
  }

  /**
   * Question Type contract
   * Calculates the user's score for this task, f.ex. correct answers subtracted by wrong answers.
   * @returns {number} Score
   */
  getScore() {
    return this.codeTester.getScore();
  }

  /**
   * Question type contract
   * Calculates the maximum amount of points achievable for this task.
   * @returns {number} Max score achievable for this task.
   */
  getMaxScore() {
    return this.codeTester.getMaxScore();
  }
  /**
   * Displays the solution(s) for this task, should also hide all buttons.
   */
  showSolutions() {
    return;
  }

  getContainer() {
    return document.getElementById(this.codeQuestionUID);
  }

  isPassed() {
    return this.getScore() === this.getMaxScore();
  }
  /**
   * QuestionType Contract
   * Resets the task to its initial state, should also show buttons that were hidden by the showSolutions() function.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    this.removeFeedback();
    if (this.hasRun_button) {
      this.showButton('run');
    }
    if (this.hasStopButton) {
      this.showButton('stop');
    }
    if (this.hasCheckButton) {
      this.showButton('check-answer');
      this.hideButton('show-solution');
      this.hideButton('try-again');
    }
    this.editor.session.setValue(this.editor.set_decoded_code(this.defaultCode || ''), -1);
    this.editor.reset();
    this.trigger('resize');
  }
 
  /**
   * Returns Stop signal
   * @returns {boolean} Stop signal as bool
   */
  shouldStop() {
    return this.editor.stop_signal;
  }

  /* Get xAPI data.
  *
  * @return {object} XAPI statement.
  * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
  */
  getXAPIData() {
    this.getXAPIAnswerEvent().data.statement;
  }

  getXAPIAnswerEvent() {
    const xAPIEvent = this.createXAPIEvent('answered');
    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
      true, this.isPassed());
    xAPIEvent.data.statement.result.response = this.getDecodedCode();
    return xAPIEvent;
  }

  /**
   * Create an xAPI event for CodeQuestion.
   * @param {string} verb Short id of the verb we want to trigger.
   * @returns {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);
    Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition());

    if (verb === 'completed' || verb === 'answered') {
      xAPIEvent.setScoredResult(
        this.getScore(), // Question Type Contract mixin
        this.getMaxScore(), // Question Type Contract mixin
        this,
        true,
        this.getScore() === this.getMaxScore()
      );
    }
    return xAPIEvent;
  }

  /**
   * Trigger xAPI event.
   * @param {string} verb Short id of the verb we want to trigger.
   */
  triggerXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEvent(verb);
    console.info(xAPIEvent);
    this.trigger(xAPIEvent);
  }

  /**
   * Get the xAPI definition for the xAPI object.
   * @returns {object} XAPI definition.
   */
  getxAPIDefinition() {
    const definition = {};
    definition.name = {};
    definition.name[this.languageTag] = this.getTitle();
    // Fallback for h5p-php-reporting, expects en-US
    definition.name['en-US'] = definition.name[this.languageTag];
    definition.description = { };
    definition.description[this.languageTag] = this.getDescription();
    // Fallback for h5p-php-reporting, expects en-US
    definition.description['en-US'] = definition.description[this.languageTag];
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'other';
    // There's no right or wrong, but reporting expects a pattern; all correct is better
    definition.correctResponsesPattern = this.getSolution();
    return definition;
  }

  success() {
    return this.getScore() === this.getMaxScore();
  }

  async notifyFailure(message) {   
    await Swal.fire({
      icon: 'warning',
      title: message,
      position: 'center',
      iconColor: 'red',
      showConfirmButton: false,
      timer: 900,
      timerProgressBar: true,
    });
  }

  async notifySuccess(message) {
    await Swal.fire({
      icon: 'success',
      title: message,
      position: 'center',
      iconColor: 'green',
      showConfirmButton: false,
      timer: 900,
      timerProgressBar: true,
    });
  }

  evaluate() {
    if (this.success()) {
      const successText = this.l10n.successText;
      this.notifySuccess(successText);
      this.setFeedback(successText, this.getScore(), this.getMaxScore(), 'Score');
      this.triggerXAPIEvent('completed');
    }
    else {
      const failureText = this.l10n.failedText;
      this.notifyFailure(failureText);
      this.setFeedback(failureText, this.getScore(), this.getMaxScore(), 'Score');
      this.triggerXAPIEvent('answered');
    }
    this.trigger('resize'); 
  }

  /**
   * @TODO workaround for missing function bug in h5p-question.
   * 
   * @returns true
   */
  isRoot() {
    return true;
  }

} // end of class