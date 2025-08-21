import nextra from "nextra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.jsx",
//   defaultShowCopyCode: true,
//   flexsearch: {
//     codeblocks: true,
//   },
//   codeHighlight: true,
});

export default withNextra({
  outputFileTracingRoot: path.join(__dirname, '../../'),
});

// If you have other Next.js configurations, you can pass them as the parameter:
// export default withNextra({ /* other next.js config */ })
