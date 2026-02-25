export default class ManualRuntimeFactory {
  constructor(runtimeClass, resizeActionHandler, stopActionHandler, options = []) {
    this.resizeActionHandler = resizeActionHandler;
    this.stopActionHandler = stopActionHandler;
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
   * Creates a new Manual Runtime
   * @param {string} code Code to execute
   * @param editor
   * @returns  {H5P.Runtime} The generated Runtime
   */
  create() {
    const RuntimeClass = this.getRuntimeClass();


    const config = {
      shouldStop: () => {
        return this.stopActionHandler();

      },
      ...this.options
    };
    return new RuntimeClass(this.resizeActionHandler, '', config);
  }
}
