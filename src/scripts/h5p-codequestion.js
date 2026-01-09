import Util from "./services/util";
import CodeQuestionFactory from "./codequestion-factory";

/**
 * @class
 * CodeQuestion - H5P Question type for coding exercises.
 * Handles rendering, editor, runtime, test cases, scoring and xAPI events.
 */
export default class CodeQuestion extends H5P.Question {
  /**
   * Constructor
   * @param {object} params - Parameters passed by the editor (optional).
   * @param {number} contentId - Unique ID for this content.
   * @param {object} [extras={}] - Optional extras like saved state or metadata.
   */
  constructor(params = {}, contentId, extras = {}) {
    super({}, contentId, extras);

    // Set safe defaults to avoid undefined errors
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
        contentType: "text_and_ide",
      },
      params,
    );

    this.params = params;
    this.contentId = contentId;
    this.extras = extras;
    this.l10n = params.l10n;

    this.score = 0;
    this.answerGiven = false;
    this.passed = false;
    this.maxScore = 2;

    this.parentDiv = document.createElement("div");
    this.contents = params.contents;

    // Editor defaults
    this.defaultCode = params.editorSettings.startingCode || "";
    this.codeContainer = null;

    // Factory for runtime, tester, editor
    this.factory = this.getFactory();

    this.contentType = params.contentType || "text_and_ide";
    this.instructions = params.editorSettings.instructions || null;
    this.instructionsImage = params.editorSettings.instructionsImage || null;
    this.preCode = params.editorSettings.preCode || null;
    this.postCode = params.editorSettings.postCode || null;

    // Grading defaults
    this.gradingMethod =
      params.gradingSettings.gradingMethod !== "none"
        ? params.gradingSettings.gradingMethod
        : null;
    this.testcases = params.gradingSettings.testCases || [];
    this.targetCode = params.gradingSettings.targetCode || null;

    this.dueDate = params.gradingSettings.dueDateGroup.duedate;
    this.enableDueDate = params.gradingSettings.dueDateGroup.enableDueDate;

    this.codeTester = this.factory.createCodeTester(this.testcases);

    // UI flags
    this.hasCanvas = true;
    this.hasConsole = true;
    this.hasRunButton = true;
    this.hasCheckButton = true;
    this.hasStopButton = true;
    this.hasTestCaseArea = true;
    this.hasAssets = false;
    this.language = "python";

    // Unique IDs
    this.assetsAreaUID = `h5p_assets_area_${H5P.createUUID()}`;
    this.codeQuestionUID = `h5p_code_question_${H5P.createUUID()}`;

    // Extras max Score
    this.maxScore = this.extras.maxScore ?? null;
  }

  /**
   * Get localized strings
   * @returns {object}
   */
  getL10n() {
    return this.l10n;
  }

  /**
   * Returns CSS-friendly question name
   * @returns {string}
   */
  getQuestionName() {
    return "h5p-codequestion";
  }

  /**
   * Returns factory for this question
   * @returns {CodeQuestionFactory}
   */
  getFactory() {
    return new CodeQuestionFactory(this);
  }

  /**
   * Returns the question title
   * @returns {string}
   */
  getTitle() {
    return "Code-Question";
  }

  /**
   * Returns the question description
   * @returns {string}
   */
  getDescription() {
    return "Code-Question";
  }

  /**
   * Returns solution (empty by default)
   * @returns {string}
   */
  getSolution() {
    return "";
  }

  /**
   * Decode HTML entities in code
   * @param {string} code
   * @returns {string}
   */
  getDecodedCode(code) {
    code = typeof code === "string" ? code : "";
    return code
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&");
  }

  /**
   * Runs the code in runtime
   */
  runAction() {
    const runtime = this.factory.createManualRuntime(this.codeContainer);
    runtime.reset();
    runtime.run();
  }

  /**
   * Runs test cases on current code
   */
  checkAction() {
    const runtime = this.factory.createTestRuntime(
      this.codeTester,
      this.codeContainer.editorManager.getCode(),
    );
    runtime.reset();
    runtime.run();
  }

  /**
   * Adds buttons below the question (Run, Check, etc.)
   */
  addButtons() {
    if (this.hasRunButton) {
      this.addButton("run", this.l10n.run, () => this.runAction());
    }
    if (this.hasCheckButton) {
      this.addButton("check-answer", this.l10n.checkAnswer, () =>
        this.checkAction(),
      );
    }
  }

  /**
   * Entry point for creating and registering all DOM elements
   * related to the question.
   *
   * Responsibilities:
   * - Initialize the root container
   * - Render content parts (text, code, images)
   * - Render IDE, instructions, assets, and controls if required
   * - Attach everything to the H5P content lifecycle
   */
  registerDomElements() {
    this.initializeParent();

    const contentDiv = this.createContentContainer();
    const contentPartsDiv = this.renderContentParts();

    contentDiv.append(contentPartsDiv);
    this.parentDiv.append(contentDiv);

    // Render editor-related UI only for supported content types
    if (this.requiresEditor()) {
      this.renderCodeContainer(contentPartsDiv);
      this.renderAssetsIfNeeded();
      this.renderButtonsAndTestCases();
    }

    // Register the final DOM with H5P and notify layout changes
    this.setContent(this.parentDiv);
    // can be removed. Editor will be setup after dom is ready.
  }

  /**
   * Determines whether the question requires an IDE/editor.
   */
  requiresEditor() {
    return (
      this.contentType === "text_and_ide" || this.contentType === "ide_only"
    );
  }

  /**
   * Initializes the root DOM element for the question.
   * Ensures the container exists and applies identifiers and base classes.
   */
  initializeParent() {
    if (!this.parentDiv) {
      throw new Error("parentDiv is not initialized");
    }

    this.parentDiv.id = this.codeQuestionUID;
    this.parentDiv.classList.add(this.getQuestionName());
  }

  /**
   * Creates the main content container.
   * This container holds all rendered content parts.
   */
  createContentContainer() {
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("content");
    return contentDiv;
  }

  /**
   * Renders all content parts (text, code, image).
   * Uses a DocumentFragment to minimize DOM reflows.
   */
  renderContentParts() {
    const wrapper = document.createElement("div");
    const fragment = document.createDocumentFragment();

    (this.contents || []).forEach((content) => {
      const part = this.renderContentPart(content);
      if (part) fragment.append(part);
    });

    wrapper.append(fragment);
    return wrapper;
  }

  /**
   * Dispatches rendering based on the content type.
   * Each content type is handled by a dedicated method.
   */
  renderContentPart(content) {
    const container = document.createElement("div");
    container.classList.add("content-part");

    switch (content.type) {
      case "text":
        return this.renderTextContent(container, content);

      case "code":
        return this.renderCodeContent(container, content);

      case "image":
        return this.renderImageContent(container, content);

      default:
        // Defensive handling for unknown or unsupported content types
        console.warn(`Unknown content type: ${content.type}`);
        return null;
    }
  }

  /**
   * Renders markdown-based text content.
   * Empty or undefined text values are handled safely.
   */
  renderTextContent(container, content) {
    container.classList.add("text");

    const text = content.text ?? "";
    const markdown = new H5P.Markdown(text);

    container.append(markdown.getMarkdownDiv());
    return container;
  }

  /**
   * Renders code content.
   *
   * Two modes are supported:
   * - Static code block rendered as Markdown
   * - Interactive editor instance
   */
  renderCodeContent(container, content) {
    container.classList.add("code");

    // Render static code block if editor is disabled
    if (!content.showEditor) {
      const codeBlock =
        "```" +
        this.language +
        "\n" +
        this.getDecodedCode(content.code) +
        "\n```";

      const markdown = new H5P.Markdown(codeBlock);
      container.append(markdown.getMarkdownDiv());
    } else {
      // Render interactive editor and attach its DOM directly
      const editorWrapper = document.createElement("div");
      const codeContainer = this.factory.createContainer(
        editorWrapper,
        content.code,
        false,
      );

      container.append(codeContainer.getDOM());
    }

    return container;
  }

  /**
   * Renders an image content part.
   * Uses explicit DOM creation to avoid innerHTML usage.
   */
  renderImageContent(container, content) {
    container.classList.add("image");

    const img = document.createElement("img");
    img.classList.add("description-image");
    img.src = H5P.getPath(content.image.path, this.contentId);
    img.alt = content.image.copyright?.title ?? "";

    container.append(img);
    return container;
  }

  /**
   * Renders the main IDE/editor area and its related UI elements.
   */
  renderCodeContainer(contentPartsDiv) {
    this.codeContainerParent = document.createElement("div");
    this.codeContainerParent.id = `assignment-editor-wrapper-${H5P.createUUID()}`;

    // Factory attaches editor DOM internally
    this.codeContainer = this.factory.createContainer(
      this.codeContainerParent,
      this.defaultCode,
      true,
    );

    // IMPORTANT: do NOT append editor.getDOM() again
    contentPartsDiv.append(this.codeContainerParent);
  }
  /**
   * Renders the assets area if assets are present.
   */
  renderAssetsIfNeeded() {
    if (this.hasAssets) {
      this.parentDiv.append(this.generateAssetsArea());
    }
  }

  /**
   * Renders grading buttons and test case UI if grading is enabled.
   */
  renderButtonsAndTestCases() {
    if (!this.gradingMethod) return;

    this.addButtons();

    if (this.hasTestCaseArea) {
      this.parentDiv.append(this.codeTester.generateTestCasesArea());
    }
  }

  /**
   * Generates an area for additional assets
   * @returns {HTMLElement}
   */
  generateAssetsArea() {
    const assetsArea = document.createElement("div");
    assetsArea.id = this.assetsAreaUID;
    return assetsArea;
  }

  /**
   * Returns whether an answer has been given
   * @returns {boolean}
   */
  getAnswerGiven() {
    return this.answerGiven;
  }

  /**
   * Returns score
   * @returns {number}
   */
  getScore() {
    let score = this.codeTester.getScore();

    // if due date is passed
    if (this.enableDueDate && this.dueDate) {
      const now = new Date();
      const due = new Date(this.dueDate);
      if (now > due) {
        // After due date maximum of 0.5 points
        score = Math.min(score, 0.5);
      }
    }
    if (this.maxScore > score) {
      score = this.maxScore;
    }
    return score;
  }

  /**
   * Returns maximum possible score
   * @returns {number}
   */
  getMaxScore() {
    return this.codeTester.getMaxScore();
  }

  /**
   * Shows solutions (default: does nothing)
   */
  showSolutions() {
    return;
  }

  /**
   * Returns the container div
   * @returns {HTMLElement}
   */
  getContainer() {
    return document.getElementById(this.codeQuestionUID);
  }

  /**
   * Resets task
   */
  resetTask() {
    this.removeFeedback();

    if (this.hasRunButton) this.showButton("run");
    if (this.hasStopButton) this.showButton("stop");
    if (this.hasCheckButton) this.showButton("check-answer");

    this.codeContainer.session.setValue(
      this.codeContainer.set_decoded_code(this.defaultCode || ""),
      -1,
    );
    this.codeContainer.reset();
    this.trigger("resize");
  }

  /**
   * Returns stop signal from editor
   * @returns {boolean}
   */
  shouldStop() {
    return this.codeContainer.stop_signal;
  }

  /**
   * Get xAPI data
   * @returns {object}
   */
  getXAPIData() {
    return this.getXAPIAnswerEvent().data.statement;
  }

  /**
   * Returns xAPI answer event
   * @returns {H5P.XAPIEvent}
   */
  getXAPIAnswerEvent() {
    const xAPIEvent = this.createXAPIEvent("answered");
    xAPIEvent.setScoredResult(
      this.getScore(),
      this.getMaxScore(),
      this,
      true,
      this.isPassed(),
    );
    xAPIEvent.data.statement.result.response = this.getDecodedCode();
    return xAPIEvent;
  }

  /**
   * Creates xAPI event
   * @param {string} verb
   * @returns {H5P.XAPIEvent}
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);
    Util.extend(
      xAPIEvent.getVerifiedStatementValue(["object", "definition"]),
      this.getxAPIDefinition(),
    );

    if (["completed", "answered"].includes(verb)) {
      xAPIEvent.setScoredResult(
        this.getScore(),
        this.getMaxScore(),
        this,
        true,
        this.isPassed(),
      );
    }

    return xAPIEvent;
  }

  /**
   * Trigger xAPI event
   * @param {string} verb
   */
  triggerXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEvent(verb);
    console.info(xAPIEvent);
    this.trigger(xAPIEvent);
  }

  /**
   * Returns xAPI object definition
   * @returns {object}
   */
  getxAPIDefinition() {
    const definition = {
      name: {},
      description: {},
      type: "http://adlnet.gov/expapi/activities/cmi.interaction",
      interactionType: "other",
      correctResponsesPattern: this.getSolution(),
    };
    definition.name[this.language] = this.getTitle();
    definition.name["en-US"] = definition.name[this.language];
    definition.description[this.language] = this.getDescription();
    definition.description["en-US"] = definition.description[this.language];
    return definition;
  }

  /**
   * Returns true if task is successfully completed
   * @returns {boolean}
   */
  success() {
    if (this.islatesubmission()) {
      return this.getScore() === 0.5; // success
    } else {
      return this.getScore() === 1;
    }
  }

  /**
   * Checks whether the user passed
   * @returns {boolean}
   */
  isPassed() {
    if (this.islatesubmission()) {
      return this.getScore() === 0.5; // success
    } else {
      return this.getScore() === 1;
    }
  }

  islatesubmission() {
    if (this.enableDueDate && this.dueDate) {
      const now = new Date();
      const due = new Date(this.dueDate);
      if (now > due) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluate task and show feedback
   */
  evaluate() {
    let score = this.getScore();
    let feedbackText = this.success()
      ? this.l10n.successText || "Correct!"
      : this.l10n.failedText || "Incorrect!";

    if (score === 1 && this.maxScore === null) {
      this.maxScore = score;
      this.extras.maxScore = this.maxScore;
    }

    if (this.islatesubmission() && this.getScore > 0) {
      feedbackText += " (Late submission, partial credit applied)";
    }

    this.setFeedback(feedbackText, score, this.getMaxScore(), "Score");
    this.triggerXAPIEvent(this.success() ? "completed" : "answered");
    this.trigger("resize");
  }

  /**
   * Root check (H5P internal)
   * @returns {boolean}
   */
  isRoot() {
    return true;
  }
}
