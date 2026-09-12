import Util from './services/util';
import {
  createCodeQuestionL10n,
  getCodeQuestionL10nValue,
  tCodeQuestion,
} from './services/codequestion-l10n';
import ManualRuntimeFactory from './runtime/factory-runtime-manual';
import ContainerFactory from './container/factory-container';
import CodeTesterFactory from './tester/factory-tester';
import TestRuntimeFactory from './runtime/factory-runtime-test';
import { Runtime } from './runtime/runtime';
import CodeQuestionContainer from './container/codequestion-container';
import CodeQuestionStateService from './services/codequestion-state';

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
    super('code-question', {});

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

    if (
      this.contentType === 'text_only'
      && this.gradingMethod !== 'multipleChoice'
      && this.gradingMethod !== 'sortItems'
    ) {
      this.gradingMethod = null;
    }

    this.testcases = params.gradingSettings.testCases || [];
    this.multipleChoice = this.normalizeMultipleChoiceSettings(
      params.gradingSettings?.multipleChoice || {},
    );
    this.selectedChoices = this.normalizeSelectedChoices(
      extras?.previousState?.selectedChoices,
    );
    this.answerGiven = this.selectedChoices.size > 0;
    this.multipleChoiceDisplayOrder = this.buildMultipleChoiceDisplayOrder();
    this.validateMultipleChoiceConfig();

    // ---- Drag & drop sort question defaults -----------------------------
    this.sortQuestion = this.normalizeSortSettings(
      params.gradingSettings?.sortItems || {},
    );
    this.currentSortOrder = this.normalizeSortOrder(
      extras?.previousState?.sortOrder,
      this.sortQuestion.items,
    );
    if (this.isSortQuestion() && Array.isArray(extras?.previousState?.sortOrder) && extras.previousState.sortOrder.length > 0) {
      this.answerGiven = true;
    }
    this.validateSortConfig();

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

    this.codeTester = this.gradingMethod && !this.isMultipleChoiceQuestion() && !this.isSortQuestion()
      ? this.getCodeTesterFactory().create()
      : null;

    // If grading method is unsupported, disable grading safely.
    if (this.gradingMethod && !this.isMultipleChoiceQuestion() && !this.isSortQuestion() && !this.codeTester) {
      this.gradingMethod = null;
    }

    this.maxScore = (this.isMultipleChoiceQuestion() || this.isSortQuestion()) ? 1 : 2;

    // ---- UI flags -------------------------------------------------------
    this.hasConsole = params.editorSettings?.showConsole !== false;
    // "Check answer" evaluates the test cases and only makes sense once
    // grading is configured; without it, clicking it would be a no-op.
    // "Run" executes interactively (real input() prompts, real canvas)
    // against whatever the editor currently contains instead of the test
    // cases' input values, which is confusing side by side with "Check
    // answer" once grading exists. So exactly one of the two is shown,
    // based on whether test cases/grading are configured for this content.
    this.hasCheckButton = Boolean(this.codeTester) || this.isMultipleChoiceQuestion() || this.isSortQuestion();
    this.hasRunButton = !this.codeTester && !this.isMultipleChoiceQuestion() && !this.isSortQuestion();
    this.hasStopButton = true;
    this.hasTestCaseArea = true;
    this.hasAssets = false;

    // ---- Unique IDs -----------------------------------------------------
    this.assetsAreaUID = `h5p_assets_area_${H5P.createUUID()}`;
    this.codeQuestionUID = `h5p_code_question_${H5P.createUUID()}`;

    this.xAPIlastEvent = null;

    this.codeContainers = new Map();
    this.stateService = new CodeQuestionStateService();
    this.boundInternalFrameResizeHandler = null;
  }

  getCodingLanguage() {
    return 'pseudocode';
  }

  normalizeMultipleChoiceSettings(settings = {}) {
    const rawChoices = Array.isArray(settings.choices) ? settings.choices : [];
    const choices = rawChoices
      .map((choice, index) => ({
        id: `choice_${index}`,
        text: typeof choice?.text === 'string' ? choice.text : '',
        correct: choice?.correct === true,
      }))
      .filter((choice) => choice.text.trim() !== '');

    return {
      allowMultiple: settings.allowMultiple === true,
      shuffleAnswers: settings.shuffleAnswers === true,
      choices,
    };
  }

  /**
   * Builds a (possibly shuffled) display order for multiple choice answer
   * options. Choice ids stay tied to their original authoring index so
   * xAPI reporting and persisted state remain stable across shuffles.
   * @returns {number[]} Indices into `this.multipleChoice.choices`.
   */
  buildMultipleChoiceDisplayOrder() {
    const order = this.multipleChoice.choices.map((_, index) => index);

    if (!this.multipleChoice.shuffleAnswers) {
      return order;
    }

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  }

  /**
   * Returns the answer choices in display order.
   * @returns {Array<object>} Choices, shuffled when configured.
   */
  getDisplayedChoices() {
    return this.multipleChoiceDisplayOrder.map(
      (choiceIndex) => this.multipleChoice.choices[choiceIndex],
    );
  }

  /**
   * Warns authors/developers in the console when a multiple choice setup
   * can never be answered correctly. This is a defensive authoring aid,
   * not shown to learners (it must not leak answer-key information).
   * @returns {void}
   */
  validateMultipleChoiceConfig() {
    if (!this.isMultipleChoiceQuestion()) {
      return;
    }

    const correctChoiceCount = this.multipleChoice.choices
      .filter((choice) => choice.correct).length;

    if (correctChoiceCount === 0) {
      console.warn(
        'H5P.CodeQuestion: multiple choice grading has no answer option marked '
        + 'as correct. This question can never be answered correctly.',
      );
    }

    if (!this.multipleChoice.allowMultiple && correctChoiceCount > 1) {
      console.warn(
        'H5P.CodeQuestion: multiple choice grading marks several options as '
        + 'correct, but "Allow multiple correct answers" is off. Only one '
        + 'option can be selected, so this question can never be answered '
        + 'correctly.',
      );
    }
  }

  normalizeSelectedChoices(selectedChoices = []) {
    return new Set(
      (Array.isArray(selectedChoices) ? selectedChoices : [])
        .map((choiceId) => String(choiceId || ''))
        .filter(Boolean),
    );
  }

  isMultipleChoiceQuestion() {
    return this.gradingMethod === 'multipleChoice';
  }

  normalizeSortSettings(settings = {}) {
    const rawItems = Array.isArray(settings.items) ? settings.items : [];
    const items = rawItems
      .map((item, index) => ({
        id: `item_${index}`,
        text: typeof item?.text === 'string' ? item.text : '',
      }))
      .filter((item) => item.text.trim() !== '');

    return { items };
  }

  isSortQuestion() {
    return this.gradingMethod === 'sortItems';
  }

  /**
   * Fisher-Yates shuffle used both for the initial display order and for
   * building a fresh order on retry.
   * @param {string[]} itemIds Item ids to shuffle.
   * @returns {string[]} A new, shuffled array of item ids.
   */
  buildSortDisplayOrder(itemIds) {
    const order = [...itemIds];

    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  }

  /**
   * Restores a persisted sort order if, and only if, it still matches the
   * current item set exactly. Otherwise falls back to a fresh shuffle (e.g.
   * items were edited by the author after the learner started).
   * @param {string[]} previousOrder Persisted item id order.
   * @param {Array<object>} items Currently configured sort items.
   * @returns {string[]} A valid display order of item ids.
   */
  normalizeSortOrder(previousOrder, items) {
    const validIds = items.map((item) => item.id);
    const cleanedPrevious = (Array.isArray(previousOrder) ? previousOrder : [])
      .map((itemId) => String(itemId || ''))
      .filter((itemId) => validIds.includes(itemId));

    const isCompleteAndValid = cleanedPrevious.length === validIds.length
      && new Set(cleanedPrevious).size === validIds.length;

    return isCompleteAndValid ? cleanedPrevious : this.buildSortDisplayOrder(validIds);
  }

  /**
   * Warns authors/developers when a sort grading setup can never be solved.
   * Defensive authoring aid only, never shown to learners.
   * @returns {void}
   */
  validateSortConfig() {
    if (!this.isSortQuestion()) {
      return;
    }

    if (this.sortQuestion.items.length < 2) {
      console.warn(
        'H5P.CodeQuestion: sort grading needs at least two items to form an '
        + 'orderable sequence.',
      );
    }
  }

  getCorrectSortItemIds() {
    return this.sortQuestion.items.map((item) => item.id);
  }

  hasCorrectSortOrder() {
    const correctOrder = this.getCorrectSortItemIds();

    return correctOrder.length > 0
      && this.currentSortOrder.length === correctOrder.length
      && this.currentSortOrder.every((itemId, index) => itemId === correctOrder[index]);
  }

  isInternalFrame() {
    return window.H5P?.isFramed && window.H5P?.externalEmbed === false;
  }

  trigger(event, eventData, extras) {
    const eventType = (typeof event === 'string') ? event : event?.type;

    if (eventType === 'resize' && this.suppressInternalFrameResizeEvents && this.isInternalFrame()) {
      return;
    }

    return super.trigger(event, eventData, extras);
  }

  resizeActionHandler() {
    this.trigger('resize');
  }

  syncFramedHeightFallback() {
    const iframe = window.frameElement;

    if (!window.H5P?.isFramed || window.H5P?.externalEmbed !== false || !iframe || !document.body) {
      return;
    }

    const nextHeight = Math.ceil(Math.max(
      document.body.scrollHeight,
      document.documentElement?.scrollHeight || 0,
      document.body.getBoundingClientRect?.().height || 0,
    ));

    if (nextHeight > 0) {
      iframe.style.height = `${nextHeight}px`;
    }
  }

  scheduleEvaluationFrameSync() {
    clearTimeout(this.evaluationFrameSyncTimerFast);
    clearTimeout(this.evaluationFrameSyncTimerSlow);

    const isInternalFrame = this.isInternalFrame();

    if (!isInternalFrame) {
      this.resizeActionHandler();
      return;
    }

    this.suppressInternalFrameResizeEvents = true;
    this.syncFramedHeightFallback();

    this.evaluationFrameSyncTimerFast = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 75);

    this.evaluationFrameSyncTimerSlow = setTimeout(() => {
      this.syncFramedHeightFallback();
      this.suppressInternalFrameResizeEvents = false;
    }, 350);
  }

  scheduleInternalFrameLayoutSync() {
    clearTimeout(this.internalFrameLayoutSyncTimerFast);
    clearTimeout(this.internalFrameLayoutSyncTimerSlow);

    if (!this.isInternalFrame()) {
      return;
    }

    this.syncFramedHeightFallback();

    this.internalFrameLayoutSyncTimerFast = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 75);

    this.internalFrameLayoutSyncTimerSlow = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 250);
  }

  teardownInternalFrameResizeSync() {
    clearTimeout(this.internalFrameResizeDebounceTimer);
    clearTimeout(this.internalFrameLayoutSyncTimerFast);
    clearTimeout(this.internalFrameLayoutSyncTimerSlow);

    this.internalFrameResizeObserver?.disconnect?.();
    this.internalFrameResizeObserver = null;

    if (this.boundInternalFrameResizeHandler) {
      window.removeEventListener('resize', this.boundInternalFrameResizeHandler);
      this.boundInternalFrameResizeHandler = null;
    }
  }

  setupInternalFrameResizeSync() {
    this.teardownInternalFrameResizeSync();

    if (!this.isInternalFrame()) {
      return;
    }

    this.boundInternalFrameResizeHandler = () => {
      clearTimeout(this.internalFrameResizeDebounceTimer);
      this.internalFrameResizeDebounceTimer = setTimeout(() => {
        this.scheduleInternalFrameLayoutSync();
      }, 75);
    };

    window.addEventListener('resize', this.boundInternalFrameResizeHandler);

    if (typeof window.ResizeObserver === 'function') {
      this.internalFrameResizeObserver = new window.ResizeObserver(() => {
        clearTimeout(this.internalFrameResizeDebounceTimer);
        this.internalFrameResizeDebounceTimer = setTimeout(() => {
          this.scheduleInternalFrameLayoutSync();
        }, 50);
      });

      if (document.body) {
        this.internalFrameResizeObserver.observe(document.body);
      }

      if (document.documentElement) {
        this.internalFrameResizeObserver.observe(document.documentElement);
      }

      if (this.parentDiv) {
        this.internalFrameResizeObserver.observe(this.parentDiv);
      }
    }

    this.scheduleInternalFrameLayoutSync();
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
      response: this.getResponse()
    };
  }

  getResponse() {
    if (this.isMultipleChoiceQuestion()) {
      return this.getSelectedChoiceIds().join('[,]');
    }

    if (this.isSortQuestion()) {
      return this.currentSortOrder.join('[,]');
    }

    return this.codeContainer?.getEditorManager?.()?.getCode() || '';
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
      interactionType: this.getxAPIInteractionType(),
      correctResponsesPattern: this.getCorrectResponsesPattern(),
    };

    // Localized names
    def.name[this.getCodingLanguage()] = this.getTitle();
    def.name['en-US'] = this.getTitle();

    // Localized descriptions
    def.description[this.getCodingLanguage()] = this.getDescription();
    def.description['en-US'] = this.getDescription();

    if (this.isMultipleChoiceQuestion()) {
      def.choices = this.multipleChoice.choices.map((choice) => ({
        id: choice.id,
        description: {
          [this.getCodingLanguage()]: choice.text,
          'en-US': choice.text,
        },
      }));
    }

    if (this.isSortQuestion()) {
      def.choices = this.sortQuestion.items.map((item) => ({
        id: item.id,
        description: {
          [this.getCodingLanguage()]: item.text,
          'en-US': item.text,
        },
      }));
    }

    return def;
  }

  getxAPIInteractionType() {
    if (this.isMultipleChoiceQuestion()) {
      return 'choice';
    }

    if (this.isSortQuestion()) {
      return 'sequencing';
    }

    return 'other';
  }

  getCorrectResponsesPattern() {
    if (this.isMultipleChoiceQuestion()) {
      const correctChoiceIds = this.getCorrectChoiceIds();
      return correctChoiceIds.length > 0 ? [correctChoiceIds.join('[,]')] : [];
    }

    if (this.isSortQuestion()) {
      const correctOrder = this.getCorrectSortItemIds();
      return correctOrder.length > 0 ? [correctOrder.join('[,]')] : [];
    }

    return ['response code by student'];
  }


  runAction() {
    this.resetStopSignal();
    this.removeFeedback();
    this.codeTester?.reset?.();
    this.codeContainer.run();
  }

  /**
   * Called when the user clicks the “Check” button.
   * It now sends an “attempted” event first, then the normal “answered”
   * event after the test run.
   */
  async checkAction() {
    if (this.isMultipleChoiceQuestion() || this.isSortQuestion()) {
      this.sendAttemptedEvent();
      this.sendAnsweredEvent();
      this.evaluate();
      return;
    }

    if (!this.codeTester) {
      return;
    }

    this.resetStopSignal();
    // Clear any stale execution-error banner (e.g. "Program could not be
    // run.") left over from an earlier manual run/attempt. Without this,
    // an old crash banner from a previous, since-fixed attempt keeps
    // showing during and after a fresh, successful automated test run,
    // making a correct submission look like it crashed.
    this.codeContainer?.dismissExecutionError?.();
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
      this.showRetryAfterCheck();
      // Send answered statement
      this.sendAnsweredEvent();

      this.scheduleEvaluationFrameSync();
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

    if (this.isMultipleChoiceQuestion()) {
      this.applyMultipleChoiceFeedback();
      this.setMultipleChoiceLocked(true);
    }

    if (this.isSortQuestion()) {
      this.applySortFeedback();
      this.setSortLocked(true);
    }

    this.showRetryAfterCheck();

    // Finalize attempt
    this.sendCompletedEvent();

    this.scheduleEvaluationFrameSync();
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
   * @param {object|null} [contentParams] Optional inline content item params.
   * @returns {object|Array<*>} Container options.
   */
  getCodeContainerOptions(contentParams = null) { // eslint-disable-line no-unused-vars
    return {
      hasConsole: this.hasConsole,
      enableDiagnosticLogs: this.params.advancedOptions?.enableDiagnosticLogs === true
        || this.params.behaviour?.enableDiagnosticLogs === true,
      // A web-IDE should preserve local work between reloads. This remains
      // browser-local and never replaces an LMS/H5P submission.
      workspaceAutosaveEnabled: this.contentType === 'ide_only' && contentParams === null,
      workspaceAutosaveKey: `h5p-codequestion:${this.contentId}:${this.getCodingLanguage()}`,
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
      this.params.gradingSettings?.functionName || '',
      this.params.gradingSettings?.algorithmConstraints || {},
      this.params.gradingSettings?.algorithmTrace || {},
      this.getCodeContainerOptions()?.enableDiagnosticLogs === true,
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
    return {
      l10n: this.contentL10n,
      enableDiagnosticLogs: this.getCodeContainerOptions()?.enableDiagnosticLogs === true,
    };
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
    this.teardownInternalFrameResizeSync();
    this.destroyCodeContainers();
  }

  /**
   * Builds a persistable state entry from a code container.
   * @param {object} container Code container.
   * @returns {object|null} Persistable state entry or null.
   */
  getContainerState(container) {
    return this.stateService.getContainerState(container);
  }

  /**
   * Applies a previously persisted state entry to a code container.
   * @param {object} container Code container.
   * @param {object} state Persisted state entry.
   * @returns {void}
   */
  applyContainerState(container, state = {}) {
    this.stateService.applyContainerState(container, state);
  }

  /**
   * Returns the current learner state for H5P persistence (called by the H5P framework).
   * Saves assignment and inline editor workspaces so code, Blockly and fill-blank
   * answers can be restored from extras.previousState on the next page load.
   * @returns {object|undefined} State object, or undefined when there is nothing to save.
   */
  getState() {
    const state = this.stateService.getState({
      assignmentContainer: this.codeContainer,
      contentContainers: this.codeContainers,
    }) || {};

    if (this.isMultipleChoiceQuestion() && this.selectedChoices.size > 0) {
      state.selectedChoices = this.getSelectedChoiceIds();
    }

    if (this.isSortQuestion() && this.answerGiven) {
      state.sortOrder = this.currentSortOrder;
    }

    return Object.keys(state).length > 0 ? state : undefined;
  }

  getL10n() {
    return this.l10n;
  }

  getQuestionName() {
    return 'h5p-codequestion';
  }

  getQuestionClassNames() {
    return [...new Set(['h5p-codequestion', this.getQuestionName()].filter(Boolean))];
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
      if (this.params.behaviour?.enableRetry !== false) {
        this.addButton('retry', this.l10n.retry, () => this.resetTask(), false);
      }
    }
  }

  /**
   * Swaps the check-answer button for retry once an attempt has been
   * evaluated, so learners have a clear way back into the exercise.
   * @returns {void}
   */
  showRetryAfterCheck() {
    if (this.hasCheckButton) {
      this.hideButton('check-answer');
    }

    if (this.params.behaviour?.enableRetry !== false) {
      this.showButton('retry');
    }
  }

  registerDomElements() {
    this.destroyCodeContainers();
    this.initializeParent();
    this.parentDiv.innerHTML = '';

    const contentDiv = this.createContentContainer();
    const contentPartsDiv = this.renderContentParts();

    contentDiv.append(contentPartsDiv);
    if (this.isMultipleChoiceQuestion()) {
      contentDiv.append(this.renderMultipleChoice());
    }
    if (this.isSortQuestion()) {
      contentDiv.append(this.renderSortQuestion());
    }
    this.parentDiv.append(contentDiv);

    if (this.isAssignment()) {
      this.createCodeContainer();
      this.renderCodeContainer(contentPartsDiv);
      this.renderAssetsIfNeeded();
    }

    this.renderButtonsAndTestCases();

    this.setContent(this.parentDiv);
    this.applyQuestionRootClass();
    this.setupInternalFrameResizeSync();
  }

  applyQuestionRootClass() {
    const questionRoot = this.parentDiv?.closest('.h5p-question');

    if (questionRoot) {
      questionRoot.classList.add(...this.getQuestionClassNames());
    }
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
    this.parentDiv.classList.add(...this.getQuestionClassNames());
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
    const markdown = new H5P.Markdown(
      content.text ?? '',
      this.getMarkdownOptions(),
    );
    this.appendResolvedMarkdown(container, markdown);
    return container;
  }

  /**
   * Resolves markdown asynchronously and appends the resulting DOM node.
   * This avoids rendering Promise objects as text when markdown rendering is async.
   * @param {HTMLElement} container Target container.
   * @param {object} markdown H5P markdown instance.
   * @returns {void}
   */
  appendResolvedMarkdown(container, markdown) {
    const markdownDiv = markdown.getMarkdownDiv();
    const fallbackText = markdown.text ?? '';

    const notifyRendered = () => {
      try {
        this.resizeActionHandler();
      }
      catch (_error) {
        // Rendering text is more important than surfacing resize failures from test doubles.
      }
    };

    const appendFallback = () => {
      const fallback = document.createElement('div');
      fallback.className = 'markdown-fallback';
      fallback.textContent = fallbackText;
      container.append(fallback);
      notifyRendered();
    };

    if (typeof markdownDiv?.then === 'function') {
      markdownDiv
        .then((resolvedMarkdownDiv) => {
          if (resolvedMarkdownDiv) {
            container.append(resolvedMarkdownDiv);
            notifyRendered();
            return;
          }

          appendFallback();
        })
        .catch((error) => {
          console.error('Failed to render markdown content', error);
          appendFallback();
        });

      return;
    }

    if (markdownDiv) {
      container.append(markdownDiv);
      notifyRendered();
      return;
    }

    appendFallback();
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

  /**
   * Returns markdown renderer options shared with CodeContainer-based views.
   * @param {object|null} [contentParams] Optional inline content item params.
   * @returns {object} Markdown runtime options.
   */
  getMarkdownOptions(contentParams = null) {
    const options = this.getCodeContainerOptions(contentParams) || {};

    return {
      codeMirrorCdnUrl: options.codeMirrorCdnUrl || '',
      markdownCdnUrl: options.markdownCdnUrl || '',
      mermaidCdnUrl: options.mermaidCdnUrl || '',
    };
  }

  renderCodeContent(container, content, index) {
    container.classList.add('code');
    if (!this.shouldShowInlineEditor(content)) {
      const md = '```' + this.getCodingLanguage() + '\n' +
        this.getDecodedCode(content.code) + '\n```';
      const markdown = new H5P.Markdown(md, this.getMarkdownOptions(content));
      this.appendResolvedMarkdown(container, markdown);
    }
    else {
      const editorWrapper = document.createElement('div');
      const containerId = content.id || index;
      const savedState = this.extras?.previousState?.contentItemStates?.[containerId];
      const savedWorkspaceState = savedState?.blocklyWorkspaceState;
      const contentParams = savedWorkspaceState
        ? { ...content, blocklyWorkspaceState: savedWorkspaceState }
        : content;
      const factory = this.getContainerFactory(
        editorWrapper,
        this.getDecodedCode(content.code),
        false,
        contentParams,
      );
      const codeContainer = factory.create();
      this.applyContainerState(codeContainer, savedState);
      container.append(codeContainer.getDOM());

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
    const markdown = new H5P.Markdown(md, this.getMarkdownOptions(content));
    summary.textContent = getCodeQuestionL10nValue(this.l10n, 'solutionCode');
    this.appendResolvedMarkdown(body, markdown);
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

    this.applyContainerState(
      this.codeContainer,
      this.extras?.previousState?.assignmentState,
    );
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
    if (!this.isMultipleChoiceQuestion() && !this.isSortQuestion() && this.hasTestCaseArea) {
      this.parentDiv.append(this.codeTester.view.getDOM());
    }
  }

  renderMultipleChoice() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-multiple-choice';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.l10n, 'multipleChoiceAnswer');
    wrapper.append(legend);

    this.getDisplayedChoices().forEach((choice, index) => {
      const option = document.createElement('label');
      option.className = 'codequestion-choice';

      const input = document.createElement('input');
      input.type = this.multipleChoice.allowMultiple ? 'checkbox' : 'radio';
      input.name = `${this.codeQuestionUID}-multiple-choice`;
      input.value = choice.id;
      input.checked = this.selectedChoices.has(choice.id);
      input.addEventListener('change', () => this.handleChoiceChange(input));

      const marker = document.createElement('span');
      marker.className = 'codequestion-choice__marker';
      marker.textContent = String.fromCharCode(65 + index);

      const body = document.createElement('span');
      body.className = 'codequestion-choice__body';
      const markdown = new H5P.Markdown(choice.text, this.getMarkdownOptions());
      this.appendResolvedMarkdown(body, markdown);

      const state = document.createElement('span');
      state.className = 'codequestion-choice__state sr-only';

      option.append(input, marker, body, state);
      wrapper.append(option);
    });

    this.multipleChoiceFieldset = wrapper;

    return wrapper;
  }

  /**
   * Enables/disables all multiple choice inputs at once, e.g. once an
   * attempt has been checked, until the learner retries.
   * @param {boolean} locked True to disable the answer options.
   * @returns {void}
   */
  setMultipleChoiceLocked(locked) {
    if (this.multipleChoiceFieldset) {
      this.multipleChoiceFieldset.disabled = locked;
    }
  }

  /**
   * Marks the currently selected multiple choice option(s) as correct or
   * incorrect. Unselected options are intentionally left unmarked so this
   * does not reveal the solution to unanswered/wrong choices.
   * @returns {void}
   */
  applyMultipleChoiceFeedback() {
    if (!this.multipleChoiceFieldset) {
      return;
    }

    const correctIds = new Set(this.getCorrectChoiceIds());

    this.multipleChoiceFieldset.querySelectorAll('.codequestion-choice').forEach((option) => {
      const input = option.querySelector('input');
      const state = option.querySelector('.codequestion-choice__state');

      option.classList.remove('codequestion-choice--correct', 'codequestion-choice--incorrect');
      if (state) {
        state.textContent = '';
      }

      if (!input?.checked) {
        return;
      }

      const isCorrect = correctIds.has(input.value);
      option.classList.add(
        isCorrect ? 'codequestion-choice--correct' : 'codequestion-choice--incorrect',
      );
      if (state) {
        state.textContent = getCodeQuestionL10nValue(
          this.l10n,
          isCorrect ? 'choiceCorrect' : 'choiceIncorrect',
        );
      }
    });
  }

  /**
   * Removes any correct/incorrect markup from the multiple choice options,
   * e.g. before a retry.
   * @returns {void}
   */
  clearMultipleChoiceFeedback() {
    this.multipleChoiceFieldset?.querySelectorAll('.codequestion-choice').forEach((option) => {
      option.classList.remove('codequestion-choice--correct', 'codequestion-choice--incorrect');
      const state = option.querySelector('.codequestion-choice__state');
      if (state) {
        state.textContent = '';
      }
    });
  }

  renderSortQuestion() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'codequestion-sort';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = getCodeQuestionL10nValue(this.l10n, 'sortQuestionAnswer');
    wrapper.append(legend);

    const hint = document.createElement('p');
    hint.className = 'codequestion-sort__hint';
    hint.textContent = getCodeQuestionL10nValue(this.l10n, 'sortInstructions');
    wrapper.append(hint);

    const status = document.createElement('div');
    status.className = 'sr-only';
    status.setAttribute('aria-live', 'polite');
    this.sortStatusElement = status;
    wrapper.append(status);

    const list = document.createElement('ol');
    list.className = 'codequestion-sort-list';
    this.sortListElement = list;
    this.sortItemElements = new Map();

    this.currentSortOrder.forEach((itemId) => {
      list.append(this.buildSortItemElement(itemId));
    });

    wrapper.append(list);
    this.sortFieldset = wrapper;

    return wrapper;
  }

  buildSortItemElement(itemId) {
    const item = this.sortQuestion.items.find((candidate) => candidate.id === itemId);

    const li = document.createElement('li');
    li.className = 'codequestion-sort-item';
    li.draggable = true;
    li.dataset.itemId = itemId;
    li.addEventListener('dragstart', (event) => this.handleSortDragStart(event, itemId));
    li.addEventListener('dragover', (event) => this.handleSortDragOver(event, itemId));
    li.addEventListener('drop', (event) => this.handleSortDrop(event));
    li.addEventListener('dragend', () => this.handleSortDragEnd());

    const handle = document.createElement('span');
    handle.className = 'codequestion-sort-item__handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const body = document.createElement('span');
    body.className = 'codequestion-sort-item__body';
    const markdown = new H5P.Markdown(item?.text || '', this.getMarkdownOptions());
    this.appendResolvedMarkdown(body, markdown);

    const state = document.createElement('span');
    state.className = 'codequestion-sort-item__state sr-only';

    const controls = document.createElement('span');
    controls.className = 'codequestion-sort-item__controls';

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.className = 'codequestion-sort-item__move codequestion-sort-item__move--up';
    upButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.l10n, 'moveItemUp'));
    upButton.addEventListener('click', () => this.moveSortItem(itemId, -1));

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.className = 'codequestion-sort-item__move codequestion-sort-item__move--down';
    downButton.setAttribute('aria-label', getCodeQuestionL10nValue(this.l10n, 'moveItemDown'));
    downButton.addEventListener('click', () => this.moveSortItem(itemId, 1));

    controls.append(upButton, downButton);
    li.append(handle, body, state, controls);

    this.sortItemElements.set(itemId, li);

    return li;
  }

  /**
   * Moves an item up/down via the keyboard-accessible controls, reorders
   * the underlying array and DOM, and announces the new position.
   * @param {string} itemId Id of the item to move.
   * @param {number} direction -1 to move up, 1 to move down.
   * @returns {void}
   */
  moveSortItem(itemId, direction) {
    const fromIndex = this.currentSortOrder.indexOf(itemId);
    const toIndex = fromIndex + direction;

    if (fromIndex === -1 || toIndex < 0 || toIndex >= this.currentSortOrder.length) {
      return;
    }

    this.currentSortOrder.splice(fromIndex, 1);
    this.currentSortOrder.splice(toIndex, 0, itemId);
    this.answerGiven = true;

    this.reorderSortListDOM();
    this.announceSortPosition(toIndex);
    this.focusSortItemMoveButton(itemId, direction);
  }

  /**
   * Re-appends the existing item elements in `currentSortOrder`, without
   * recreating them, so DOM identity (and thus event listeners) survives.
   * @returns {void}
   */
  reorderSortListDOM() {
    if (!this.sortListElement || !this.sortItemElements) {
      return;
    }

    this.currentSortOrder.forEach((itemId) => {
      const element = this.sortItemElements.get(itemId);
      if (element) {
        this.sortListElement.append(element);
      }
    });
  }

  announceSortPosition(index) {
    if (!this.sortStatusElement) {
      return;
    }

    this.sortStatusElement.textContent = tCodeQuestion(this.l10n, 'itemMovedTo', {
      position: index + 1,
      total: this.currentSortOrder.length,
    });
  }

  focusSortItemMoveButton(itemId, direction) {
    const selector = direction < 0
      ? '.codequestion-sort-item__move--up'
      : '.codequestion-sort-item__move--down';

    this.sortItemElements?.get(itemId)?.querySelector?.(selector)?.focus?.();
  }

  handleSortDragStart(event, itemId) {
    if (this.sortFieldset?.disabled) {
      event.preventDefault();
      return;
    }

    this.draggedSortItemId = itemId;
    event.dataTransfer?.setData('text/plain', itemId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    event.currentTarget?.classList?.add('is-dragging');
  }

  handleSortDragOver(event, itemId) {
    if (this.sortFieldset?.disabled || !this.draggedSortItemId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    if (this.draggedSortItemId === itemId) {
      return;
    }

    const fromIndex = this.currentSortOrder.indexOf(this.draggedSortItemId);
    const toIndex = this.currentSortOrder.indexOf(itemId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    this.currentSortOrder.splice(fromIndex, 1);
    this.currentSortOrder.splice(toIndex, 0, this.draggedSortItemId);
    this.reorderSortListDOM();
  }

  handleSortDrop(event) {
    event.preventDefault();
    if (this.draggedSortItemId) {
      this.answerGiven = true;
    }
  }

  handleSortDragEnd() {
    this.sortListElement
      ?.querySelectorAll?.('.codequestion-sort-item.is-dragging')
      ?.forEach((element) => element.classList.remove('is-dragging'));

    this.draggedSortItemId = null;
  }

  /**
   * Enables/disables the sort item controls, e.g. once an attempt has been
   * checked, until the learner retries.
   * @param {boolean} locked True to disable further reordering.
   * @returns {void}
   */
  setSortLocked(locked) {
    if (this.sortFieldset) {
      this.sortFieldset.disabled = locked;
    }
  }

  /**
   * Marks each sort item as correctly/incorrectly placed after checking.
   * @returns {void}
   */
  applySortFeedback() {
    if (!this.sortFieldset) {
      return;
    }

    const correctOrder = this.getCorrectSortItemIds();

    this.currentSortOrder.forEach((itemId, index) => {
      const element = this.sortItemElements?.get(itemId);
      if (!element) {
        return;
      }

      const isCorrect = correctOrder[index] === itemId;
      element.classList.remove('codequestion-sort-item--correct', 'codequestion-sort-item--incorrect');
      element.classList.add(
        isCorrect ? 'codequestion-sort-item--correct' : 'codequestion-sort-item--incorrect',
      );

      const state = element.querySelector('.codequestion-sort-item__state');
      if (state) {
        state.textContent = getCodeQuestionL10nValue(
          this.l10n,
          isCorrect ? 'choiceCorrect' : 'choiceIncorrect',
        );
      }
    });
  }

  /**
   * Removes any correct/incorrect markup from the sort items, e.g. before a
   * retry.
   * @returns {void}
   */
  clearSortFeedback() {
    this.sortItemElements?.forEach((element) => {
      element.classList.remove('codequestion-sort-item--correct', 'codequestion-sort-item--incorrect');
      const state = element.querySelector('.codequestion-sort-item__state');
      if (state) {
        state.textContent = '';
      }
    });
  }

  handleChoiceChange(input) {
    if (!this.multipleChoice.allowMultiple) {
      this.selectedChoices.clear();
    }

    if (input.checked) {
      this.selectedChoices.add(input.value);
    }
    else {
      this.selectedChoices.delete(input.value);
    }

    this.answerGiven = this.selectedChoices.size > 0;
  }

  getSelectedChoiceIds() {
    return this.multipleChoice.choices
      .map((choice) => choice.id)
      .filter((choiceId) => this.selectedChoices.has(choiceId));
  }

  getCorrectChoiceIds() {
    return this.multipleChoice.choices
      .filter((choice) => choice.correct)
      .map((choice) => choice.id);
  }

  hasCorrectChoiceSelection() {
    const selected = this.getSelectedChoiceIds();
    const correct = this.getCorrectChoiceIds();

    return correct.length > 0
      && selected.length === correct.length
      && selected.every((choiceId) => correct.includes(choiceId));
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
    if (this.isMultipleChoiceQuestion()) {
      return this.hasCorrectChoiceSelection() ? this.maxScore : 0;
    }

    if (this.isSortQuestion()) {
      return this.hasCorrectSortOrder() ? this.maxScore : 0;
    }

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
    this.hideButton('retry');

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
    this.selectedChoices.clear();
    this.answerGiven = false;
    this.setMultipleChoiceLocked(false);
    this.clearMultipleChoiceFeedback();
    this.getContainer()
      ?.querySelectorAll?.('.codequestion-multiple-choice input')
      ?.forEach((input) => {
        input.checked = false;
      });

    if (this.isSortQuestion()) {
      this.currentSortOrder = this.buildSortDisplayOrder(this.getCorrectSortItemIds());
      this.setSortLocked(false);
      this.clearSortFeedback();
      this.reorderSortListDOM();
    }

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
