import type { OpenNextConfig } from "@opennextjs/cloudflare";

/**
 * Configuração do OpenNext para deploy no Cloudflare Workers
 *
 * - default: Configuração principal do servidor (Node.js compat)
 * - middleware: Configuração do proxy/middleware (edge runtime)
 * - edgeExternals: Módulos Node que precisam ser externos na edge
 */
const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

export default config;
