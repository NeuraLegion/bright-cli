declare module 'capture-har' {
  export = captureHar;

  function captureHar(requestConfig: any, harConfig: any): any;

  namespace captureHar {
    class CaptureHar {
      constructor(...args: any[]);

      start(requestConfig: any, harConfig?: any, depth?: number): any;

      stop(): any;

    }
  }
}

export as namespace CaptureHar;
