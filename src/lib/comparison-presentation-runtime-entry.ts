// The bundle entry point for the generated Standalone HTML/Static
// Microsite's inline/local script. Never imported directly by application
// code — scripts/build-presentation-runtime.mjs bundles this file (and
// every module it imports) into one self-contained, tree-shaken,
// dependency-free plain-JS file, `public/generated/comparison-presentation-runtime.js`,
// which src/lib/generate-standalone-html.ts and
// src/lib/generate-static-microsite.ts fetch as text at generation time and
// embed/copy unchanged. See that build script's own header comment for why
// a plain Vite `?worker&url` import (the first approach tried here) is not
// used: it only yields a truly pre-bundled file during `vite build`, not
// `vite dev`, which broke this exact flow in an actual dev-mode run.

import { initComparisonPresentation } from "./comparison-presentation-runtime.ts";

initComparisonPresentation();
