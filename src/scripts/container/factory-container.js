export default class ContainerFactory {
  constructor(
    containerClass,
    parent,
    code,
    isAssignment,
    preCode,
    postCode,
    codingLanguage,
    hasConsole,
    l10n,
    instructions,
    instructionsImage,
    contentId,
    resizeActionHandler,
    runtimeFactory,
    options
  ) {
    this.containerClass = containerClass;
    this.parent = parent;
    this.code = code;
    this.isAssignment = isAssignment ?? null;
    this.preCode = preCode;
    this.postCode = postCode;
    this.code = code;
    this.codingLanguage = codingLanguage;
    this.hasConsole = hasConsole;
    this.l10n = l10n;
    this.instructions = instructions;
    this.instructionsImage = instructionsImage;
    this.contentId = contentId;
    this.resizeActionHandler = resizeActionHandler;
    this.runtimeFactory = runtimeFactory;
    this.additionaloptions = options;
  }

  /**
   * Returns the container class to instantiate
   * @returns {typeof H5P.CodeContainer} A Code-Container
   */
  getContainerClass() {
    return this.containerClass;
  }

  /**
   * Creates a Python code container
   * @returns {H5P.CodeContainer} A Code container
   */
  create() {
    const baseOptions = {
      code: this.code,
      hasButtons: true,
      consoleHidden: true,
      l10n: this.l10n,
      codingLanguage: this.codingLanguage,
      runtimeFactory: this.runtimeFactory,
      contentId: this.contentId,
      resizeActionHandler: () => this.resizeActionHandler(),
    };

    const assignmentOptions = this.isAssignment
      ? {
        isAssignment: true,
        preCode: this.preCode,
        postCode: this.postCode,
        language: this.codingLanguage,
        console: this.hasConsole,
        instructions: this.instructions,
        instructionsImage: this.instructionsImage,
      }
      : {
        isAssignment: false,
        fixedSize: false,
      };

    const ContainerClass = this.getContainerClass();

    const container = new ContainerClass(this.parent, {
      ...baseOptions,
      ...assignmentOptions,
      ...this.additionaloptions
    });

    H5P.Util.setupOnDocumentReady(() => {
      container.setup();
      this.resizeActionHandler();
    });

    return container;
  }
}
