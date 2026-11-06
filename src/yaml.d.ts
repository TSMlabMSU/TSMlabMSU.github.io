// Type shim for YAML data imports handled by @rollup/plugin-yaml (see astro.config.mjs).
// Layer-2 data files (src/data/*.yaml) are imported as plain JS objects in .astro pages.
declare module '*.yaml' {
  const data: any;
  export default data;
}
declare module '*.yml' {
  const data: any;
  export default data;
}
