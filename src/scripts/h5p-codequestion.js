import Util from './services/util';
import {
  createCodeQuestionL10n,
  getCodeQuestionL10nValue,
} from './services/codequestion-l10n';
import ManualRuntimeFactory from './runtime/factory-runtime-manual';
import ContainerFactory from './container/factory-container';
import CodeTesterFactory from './tester/factory-tester';
import TestRuntimeFactory from './runtime/factory-runtime-test';
import { Runtime } from './runtime/runtime';
import CodeQuestionContainer from './container/codequestion-container';

/**
 * @class
 * CodeQuestion – H5P question type for coding exercises.
 * Handles rendering, editor, runtime, test cases, scoring and xAPI events.
 */
export default class CodeQuestion extends H5P.Question {
  /* ------------------------------------------------------------------ *
   *  Constructor & basic initialisation
   * ------------------------------------------------------------------ */
  constructor(params = {}, contentId, extras = {}) {
    super({}, contentId, extras);

    // ---- Safe defaults -------------------------------------------------
    params = Util.extend(
      {
        l10n: {},
        contents: [],
        editorSettings: {},
        gradingSettings: {},
        behaviour: {
          enableSolutionsButton: true,
          enableRetry: true,
          enableCheckButton: true,
          confirmCheckDialog: false,
          confirmRetryDialog: false,
          autoCheck: false,
        },
        contentType: 'text_and_ide',
      },
      params,
    );

    this.params = params;
    this.contentId = contentId;
    this.extras = extras;
    this.contentL10n = params.l10n || {};
    this.l10n = createCodeQuestionL10n(this.contentL10n);
    this.params.l10n = this.contentL10n;

    this.score = 0;
    this.answerGiven = false;
    this.passed = false;
    this.maxScore = 2;

    this.parentDiv = document.createElement('div');
    this.contents = params.contents;

    // ---- Editor defaults -----------------------------------------------
    this.defaultCode = params.editorSettings.startingCode || '';
    this.codeContainer = null;

    this.contentType = params.contentType || 'text_and_ide';
    this.instructions = params.editorSettings.instructions || null;
    this.instructionsImage = params.editorSettings.instructionsImage || null;
    this.preCode = params.editorSettings.preCode || null;
    this.postCode = params.editorSettings.postCode || null;

    // ---- Grading defaults -----------------------------------------------
    const gradingMethod = params.gradingSettings?.gradingMethod;
    this.gradingMethod =
      gradingMethod
      && gradingMethod !== 'none'
      && gradingMethod !== 'please_choose'
        ? gradingMethod
        : null;
    this.testcases = params.gradingSettings.testCases || [];

    /* Legacy handling:
    solutionCode can be handled in
     * params.gradingSettings.targetCode
     * or
     */
    this.solutionCode = params.gradingSettings.targetCode || null;
    if (!this.solutionCode) {
      this.solutionCode = params.gradingSettings.solution;
    }
    this.dueDate = params.gradingSettings?.dueDateGroup?.duedate || null;
    this.enableDueDate = params.gradingSettings?.dueDateGroup?.enableDueDate === true;

    this.codeTester = this.gradingMethod
      ? this.getCodeTesterFactory().create()
      : null;

    // If grading method is unsupported, disable grading safely.
    if (this.gradingMethod && !this.codeTester) {
      this.gradingMethod = null;
    }

    // ---- UI flags -------------------------------------------------------
    this.hasConsole = params.editorSettings?.showConsole !== false;
    this.hasRunButton = true;
    this.hasCheckButton = true;
    this.hasStopButton = true;
    this.hasTestCaseArea = true;
    this.hasAssets = false;

    // ---- Unique IDs -----------------------------------------------------
    this.assetsAreaUID = `h5p_assets_area_${H5P.createUUID()}`;
    this.codeQuestionUID = `h5p_code_question_${H5P.createUUID()}`;

    this.xAPIlastEvent = null;

    this.codeContainers = new Map();
  }

  getCodingLanguage() {
    return 'pseudocode';
  }

  resizeActionHandler() {
    this.trigger('resize');
  }

  codeHandler() {
    this.codeContainer.getEditorManager().getCode();
  }


  /**
   * Builds the result object for answered/completed statements.
   * Returns a fully populated statement-result object.
   * Used by sendAnsweredEvent, sendCompletedEvent, and getXAPIData.
   * @returns {object} xAPI result object
   */
  buildResultStatement() {
    const score = this.getScore();
    const maxScore = this.getMaxScore();
    return {
      completion: true,
      success: this.success(),
      score: {
        scaled: maxScore > 0 ? score / maxScore : 0,
        raw: score,
        min: 0,
        max: maxScore
      },
      response: this.codeContainer?.getEditorManager?.()?.getCode() || ''
    };
  }

  /**
   * Returns the localized feedback text for the current result state.
   * @returns {string} Localized success or failure text.
   */
  getFeedbackText() {
    return this.success()
      ? getCodeQuestionL10nValue(this.l10n, 'successText')
      : getCodeQuestionL10nValue(this.l10n, 'failedText');
  }

  /**
   * Returns the localized score label used in question feedback.
   * @returns {string} Localized score label.
   */
  getScoreLabel() {
    return getCodeQuestionL10nValue(this.l10n, 'score');
  }

  /**
   * Applies the current evaluation feedback to the question UI.
   * @param {number} [score] - Score to display.
   * @param {number} [maxScore] - Maximum score to display.
   * @returns {void}
   */
  applyScoreFeedback(score = this.getScore(), maxScore = this.getMaxScore()) {
    this.setFeedback(
      this.getFeedbackText(),
      score,
      maxScore,
      this.getScoreLabel(),
    );
  }

  /**
   * Sends an xAPI "attempted" statement.
   * Moodle interprets this event as the start of a new attempt.
   */
  sendAttemptedEvent() {
    // Force a new registration for a new attempt
    this.currentRegistration = H5P.createUUID();

    const ev = this.createBaseXAPIEvent('attempted');

    // Moodle ignores attempted statements that contain a result
    delete ev.data.statement.result;

    this.trigger(ev);
  }

  /**
   * Sends an xAPI "answered" statement.
   * Represents the learner's response and score.
   */
  sendAnsweredEvent() {
    const ev = this.createBaseXAPIEvent('answered');
    // Attach a result using a helper
    ev.data.statement.result = this.buildResultStatement();

    this.trigger(ev);
  }

  /**
   * Sends an xAPI "completed" statement.
   * Marks the end of the attempt.
   */
  sendCompletedEvent() {
    const ev = this.createBaseXAPIEvent('completed');

    // Attach a final result using helper
    ev.data.statement.result = this.buildResultStatement();

    this.trigger(ev);
  }

  /**
   * Returns xAPI statement data for answered events.
   * Used by Moodle reporting without sending an event.
   * @returns {object} xAPI statement object
   */
  getXAPIData() {
    const ev = this.createBaseXAPIEvent('answered');

    // Attach a result using a helper
    ev.data.statement.result = this.buildResultStatement();

    return { statement: ev.data.statement };
  }

  /**
   * Creates a base xAPI event with all mandatory fields
   * shared between attempted, answered, and completed statements.
   *
   * Does NOT include result/score; used for building statements consistently.
   * @param {string} verb - The xAPI verb ("attempted", "answered", "completed")
   * @returns {H5P.XAPIEvent} A fully initialized H5P.XAPIEvent
   */
  createBaseXAPIEvent(verb) {
    // Ensure a stable registration ID per attempt
    this.currentRegistration = this.currentRegistration || H5P.createUUID();

    // Create an event from a H5P template
    const ev = this.createXAPIEventTemplate(verb);

    // Explicitly set verb (some H5P versions omit it)
    ev.setVerb({
      id: `http://adlnet.gov/expapi/verbs/${verb}`,
      display: { 'en-US': verb },
    });

    // Extend object definition with activity metadata
    Util.extend(
      ev.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition()
    );

    const statement = ev.data.statement;

    // Required timestamp (ISO-8601)
    statement.timestamp = new Date().toISOString();

    // Context information (registration and platform)
    statement.context = statement.context || {};
    statement.context.registration = this.currentRegistration;
    statement.context.platform = window.location.origin;

    // Unique statement ID
    statement.id = `${verb}-${H5P.createUUID()}`;

    return ev;
  }

  /**
   * Returns the xAPI activity definition for this CodeQuestion.
   * This defines the "object" part of xAPI statements (name, description, type, interaction).
   * @returns {object} xAPI activity definition object
   */
  getxAPIDefinition() {
    const def = {
      name: {},
      description: {},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: 'other',
      correctResponsesPattern: ['response code by student'],
    };

    // Localized names
    def.name[this.getCodingLanguage()] = this.getTitle();
    def.name['en-US'] = this.getTitle();

    // Localized descriptions
    def.description[this.getCodingLanguage()] = this.getDescription();
    def.description['en-US'] = this.getDescription();

    return def;
  }


  runAction() {
    this.resetStopSignal();
    this.codeContainer.run();
  }

  /**
   * Called when the user clicks the “Check” button.
   * It now sends an “attempted” event first, then the normal “answered”
   * event after the test run.
   */
  async checkAction() {
    if (!this.codeTester) {
      return;
    }

    this.resetStopSignal();
    this.setCheckAnswerBusyState(true);

    try {
      // Start a new attempt
      this.sendAttemptedEvent();

      // Run tests
      this.codeTester.reset();
      const runtime = this.getTestRuntimeFactory().create();
      await runtime.start(this.codeContainer);

      // Show feedback
      const score = this.getScore();
      const maxScore = this.getMaxScore();
      this.applyScoreFeedback(score, maxScore);
      // Send answered statement
      this.sendAnsweredEvent();

      this.resizeActionHandler();
    }
    finally {
      this.setCheckAnswerBusyState(false);
    }
  }

  getCheckAnswerButton() {
    return this.getContainer()?.querySelector?.('.h5p-question-check-answer') || null;
  }

  setCheckAnswerBusyState(isBusy) {
    const button = this.getCheckAnswerButton();
    if (!button) {
      return;
    }

    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || this.l10n.checkAnswer;
    }

    button.disabled = isBusy;
    button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    button.classList.toggle('is-busy', isBusy);
    button.textContent = isBusy
      ? getCodeQuestionL10nValue(this.l10n, 'checkingAnswer')
      : button.dataset.originalLabel;
  }

  /**
   * Final evaluation – creates a “completed” event.
   */
  evaluate() {
    const score = this.getScore();
    const maxScore = this.getMaxScore();

    this.answerGiven = true;

    this.applyScoreFeedback(score, maxScore);

    // Finalize attempt
    this.sendCompletedEvent();

    this.resizeActionHandler();
  }


  getContainerClass() {
    return CodeQuestionContainer;
  }


  getContainerFactoryClass() {
    return ContainerFactory;
  }

  getContainerFactory(parent, code, isAssignmentContainer, contentParams = null) {
    const runtimeFactory = this.getManualRuntimeFactory();
    const FactoryClass = this.getContainerFactoryClass();

    return new FactoryClass(
      this.getContainerClass(),
      parent,
      this.getDecodedCode(code),
      isAssignmentContainer,
      this.preCode,
      this.postCode,
      this.getCodingLanguage(),
      this.hasConsole,
      this.l10n,
      this.instructions,
      this.instructionsImage,
      this.contentId,
      () => this.resizeActionHandler(),
      runtimeFactory,
      this,
      this.getCodeContainerOptions(contentParams)
    );
  }

  /**
   * Returns shared container options for the code container.
   * @returns {object|Array<*>} Container options.
   */
  getCodeContainerOptions(contentParams = null) { // eslint-disable-line no-unused-vars
    return {
      hasConsole: this.hasConsole,
    };
  }

  getCodeTesterFactoryClass() {
    return CodeTesterFactory;
  }

  getCodeTesterFactory() {
    const FactoryClass = this.getCodeTesterFactoryClass();
    return new FactoryClass(
      this.testcases,
      this.gradingMethod,
      () => this.evaluate(),
      () => this.getTestRuntimeFactory(),
      this.l10n,
      this.dueDate,
      this.enableDueDate,
      this.getDecodedCode(this.solutionCode),
    );
  }

  getTestRuntimeFactoryClass() {
    return TestRuntimeFactory;
  }

  getTestRuntimeClass() {
    return Runtime;
  }

  getTestRuntimeFactory() {
    const FactoryClass = this.getTestRuntimeFactoryClass();
    return new FactoryClass(
      this.getTestRuntimeClass(),
      () => this.resizeActionHandler(),
      this.getDecodedCode(this.solutionCode),
      this.codeTester,
      this.getRuntimeOptions()
    );
  }

  getRuntimeOptions() {
    return { l10n: this.contentL10n };
  }

  getManualRuntimeClass() {
    return Runtime;
  }

  getManualRuntimeFactoryClass() {
    return ManualRuntimeFactory;
  }

  getManualRuntimeFactory() {
    const FactoryClass = this.getManualRuntimeFactoryClass();
    return new FactoryClass(
      this.getManualRuntimeClass(),
      () => this.resizeActionHandler(),
      () => this.shouldStop(),
      this.getRuntimeOptions()
    );
  }

  /**
   * Resets the shared stop signal used by runtimes.
   * @returns {void}
   */
  resetStopSignal() {
    if (!this.codeContainer) {
      return;
    }

    this.codeContainer.stopSignal = false;
    // Backwards compatibility for runtimes still reading the old flag.
    this.codeContainer.stop_signal = false;
  }

  /**
   * Disposes all active code containers.
   * @returns {void}
   */
  destroyCodeContainers() {
    this.codeContainer?.destroy?.();
    this.codeContainer = null;
    this.codeContainerParent = null;

    this.codeContainers.forEach((container) => {
      container?.destroy?.();
    });
    this.codeContainers.clear();
  }

  /**
   * Public teardown entrypoint for H5P lifecycle integrations.
   * @returns {void}
   */
  destroy() {
    this.destroyCodeContainers();
  }

  getL10n() {
    return this.l10n;
  }

  getQuestionName() {
    return 'h5p-codequestion';
  }

  getTitle() {
    return getCodeQuestionL10nValue(this.l10n, 'codeQuestionTitle');
  }

  getDescription() {
    return getCodeQuestionL10nValue(this.l10n, 'codeQuestionDescription');
  }

  getSolution() {
    return '';
  }

  /**
   * Decodes HTML entities in a code string.
   * @param {string} code - The encoded code string
   * @returns {string} The decoded code
   */
  getDecodedCode(code) {
    if (typeof code !== 'string') return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = code;
    return textarea.value;
  }

  addButtons() {
    if (this.hasRunButton) {
      this.addButton('run', this.l10n.run, () => this.runAction());
    }
    if (this.hasCheckButton) {
      this.addButton('check-answer', this.l10n.checkAnswer, () =>
        this.checkAction(),
      );
    }
  }

  registerDomElements() {
    this.destroyCodeContainers();
    this.initializeParent();
    this.parentDiv.innerHTML = '';

    const contentDiv = this.createContentContainer();
    const contentPartsDiv = this.renderContentParts();

    contentDiv.append(contentPartsDiv);
    this.parentDiv.append(contentDiv);

    if (this.isAssignment()) {
      this.createCodeContainer();
      this.renderCodeContainer(contentPartsDiv);
      this.renderAssetsIfNeeded();
      this.renderButtonsAndTestCases();
    }

    this.setContent(this.parentDiv);
  }

  isAssignment() {
    return (
      this.contentType === 'text_and_ide' ||
      this.contentType === 'ide_only'
    );
  }

  initializeParent() {
    if (!this.parentDiv) {
      throw new Error('parentDiv is not initialized');
    }
    this.parentDiv.id = this.codeQuestionUID;
    this.parentDiv.classList.add(this.getQuestionName());
  }

  createContentContainer() {
    const div = document.createElement('div');
    div.classList.add('content');
    return div;
  }

  renderContentParts() {
    const wrapper = document.createElement('div');
    const fragment = document.createDocumentFragment();

    (this.contents || []).forEach((content, index) => {
      const part = this.renderContentPart(content, index);
      if (part) fragment.append(part);
    });

    wrapper.append(fragment);
    return wrapper;
  }

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

  renderTextContent(container, content, _index) {
    container.classList.add('text');
    const markdown = new H5P.Markdown(content.text ?? '');
    container.append(markdown.getMarkdownDiv());
    return container;
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

  renderCodeContent(container, content, index) {
    container.classList.add('code');
    if (!this.shouldShowInlineEditor(content)) {
      const md = '```' + this.getCodingLanguage() + '\n' +
        this.getDecodedCode(content.code) + '\n```';
      const markdown = new H5P.Markdown(md);
      container.append(markdown.getMarkdownDiv());
    }
    else {
      const editorWrapper = document.createElement('div');
      const factory = this.getContainerFactory(
        editorWrapper,
        this.getDecodedCode(content.code),
        false,
        content,
      );
      const codeContainer = factory.create();
      container.append(codeContainer.getDOM());


      const containerId = content.id || index;
      this.codeContainers.set(containerId, codeContainer);
    }
    return container;
  }

  renderSolutionCodeContent(container, content, _index) {
    container.classList.add('code');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const body = document.createElement('div');
    details.classList.add('solution-code');
    const md = '```' + this.getCodingLanguage() + '\n' +
      this.getDecodedCode(content.code) + '\n```';
    const markdown = new H5P.Markdown(md);
    summary.textContent = getCodeQuestionL10nValue(this.l10n, 'solutionCode');
    body.append(markdown.getMarkdownDiv());
    details.append(summary, body);
    container.append(details);
    return container;
  }

  renderImageContent(container, content, _index) {
    container.classList.add('image');
    const img = document.createElement('img');
    img.classList.add('description-image');
    img.src = H5P.getPath(content.image.path, this.contentId);
    img.alt = content.image.copyright?.title ?? '';
    container.append(img);
    return container;
  }

  createCodeContainer() {
    this.codeContainerParent = document.createElement('div');
    this.codeContainerParent.id = `assignment-editor-wrapper-${H5P.createUUID()}`;

    this.codeContainer = this.getContainerFactory(
      this.codeContainerParent,
      this.defaultCode,
      true,
    ).create();
  }

  renderCodeContainer(contentPartsDiv) {
    contentPartsDiv.append(this.codeContainerParent);
  }

  renderAssetsIfNeeded() {
    if (this.hasAssets) {
      this.parentDiv.append(this.generateAssetsArea());
    }
  }

  renderButtonsAndTestCases() {
    if (!this.gradingMethod) return;
    this.addButtons();
    if (this.hasTestCaseArea) {
      this.parentDiv.append(this.codeTester.view.getDOM());
    }
  }

  generateAssetsArea() {
    const div = document.createElement('div');
    div.id = this.assetsAreaUID;
    return div;
  }

  getAnswerGiven() {
    return this.answerGiven;
  }

  getScore() {
    if (!this.codeTester || typeof this.codeTester.getScore !== 'function') {
      return 0;
    }

    let score = this.codeTester.getScore() * 2;
    if (this.isLateSubmission()) {
      // After due date maximum of 1 point
      score = Math.min(score, 1);
    }
    return Math.min(score, this.maxScore);
  }

  getMaxScore() {
    return this.maxScore;
  }

  showSolutions() {
    return;
  }

  getContainer() {
    return document.getElementById(this.codeQuestionUID);
  }

  resetTask() {
    this.removeFeedback();

    if (this.hasRunButton) this.showButton('run');
    if (this.hasStopButton) this.showButton('stop');
    if (this.hasCheckButton) this.showButton('check-answer');

    const resetCode = this.getDecodedCode(this.defaultCode || '');

    if (typeof this.codeContainer?.setCode === 'function') {
      this.codeContainer.setCode(resetCode);
    }
    else if (this.codeContainer?.session && typeof this.codeContainer?.set_decoded_code === 'function') {
      this.codeContainer.session.setValue(
        this.codeContainer.set_decoded_code(this.defaultCode || ''),
        -1,
      );
    }

    this.resetStopSignal();
    this.codeTester?.reset?.();
    this.codeContainer?.reset?.();
    this.resizeActionHandler();
  }

  shouldStop() {
    return this.codeContainer?.stopSignal === true
      || this.codeContainer?.stop_signal === true;
  }


  success() {
    return this.getScore() > 0;
  }

  isLateSubmission() {
    if (this.enableDueDate && this.dueDate) {
      const now = new Date();
      const due = new Date(this.dueDate);
      return now > due;
    }
    return false;
  }
}