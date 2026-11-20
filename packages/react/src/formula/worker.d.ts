// Vite's `?worker` imports (ADR 0037): the module exports a constructor of the worker, emitted as a local file in dist/.
// Declared here, next to the only loader that uses it, so the package does not depend on the `vite/client` types.
declare module '*?worker' {
  const WorkerConstructor: new (options?: { name?: string }) => Worker;
  export default WorkerConstructor;
}
