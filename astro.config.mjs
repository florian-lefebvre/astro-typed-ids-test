// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { MutableDataStore } from "./node_modules/astro/dist/content/mutable-data-store";
import { writeFileSync } from "node:fs";

// TODO: handle non existing collections
// TODO: handle collections param type when astro:content is not generated (see Erika tweet)
// TODO: handle types during build (different location)

/**
 * @param {{ collections: Array<import('astro:content').DataCollectionKey> }} param_0
 * @returns {import('astro').AstroIntegration}
 */
const integration = ({ collections }) => {
  /** @type {URL} */
  let root;
  /** @type {MutableDataStore} */
  let store;
  /** @type {URL} */
  let dtsURL;

  const loadStore = async () => {
    store = await MutableDataStore.fromFile(
      new URL("./.astro/data-store.json", root)
    );
  };

  const syncTypes = () => {
    /** @type {Record<string, Array<string>>} */
    const obj = {};

    for (const id of collections) {
      obj[id] = [...(store.collections().get(id)?.keys() ?? [])];
    }

    writeFileSync(
      dtsURL,
      `declare module 'astro:content' {
  type _Collections = ${JSON.stringify(obj)};
  export type CollectionId<T extends keyof _Collections> = _Collections[T][number];
}`,
      "utf-8"
    );
  };

  return {
    name: "test",
    hooks: {
      "astro:config:setup": async (params) => {
        root = params.config.root;
        await loadStore();
      },
      "astro:config:done": (params) => {
        dtsURL = params.injectTypes({ filename: "types.d.ts", content: "" });
      },
      "astro:server:setup": ({ server }) => {
        syncTypes();
        server.watcher.on("all", async (eventName, path) => {
          if (!["change"].includes(eventName)) return;

          // TODO: updates are kept in memory, need upstream fix
          if (path === dtsURL.pathname) {
            await loadStore();
            syncTypes();
          }
        });
      },
    },
  };
};

export default defineConfig({
  site: "https://example.com",
  integrations: [mdx(), sitemap(), integration({ collections: ["blog"] })],
  experimental: {
    contentLayer: true,
  },
});
