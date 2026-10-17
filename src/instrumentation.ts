export async function register() {
  // Next replaces NEXT_RUNTIME at build time, so the Node-only module is never bundled for the edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { init } = await import("./instrumentation-node");
    await init();
  }
}
