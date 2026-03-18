export default class TestRuntimeFactory {
  constructor(runtimeClass, resizeActionHandler, targetCode, codeTester, options = {}) {
    this.resizeActionHandler = resizeActionHandler;
    this.targetCode = targetCode;
    this.codeTester = codeTester;
    this.runtimeClass = runtimeClass;
    this.options = options;
  }

  /**
   * Returns the container class to instantiate
   * @returns {typeof H5P.Runtime}
   */
  getRuntimeClass() {
    return this.runtimeClass;
  }

  /**
   * Creates a new Test-Runtime
   * @returns  {H5P.Runtime} The generated Runtime
   */
  create() {
    const RuntimeClass = this.getRuntimeClass();

    const code = this.targetCode || '';
    return new RuntimeClass(
      this.resizeActionHandler,
      code,
      this.codeTester,
      this.options,
    );
  }
}
