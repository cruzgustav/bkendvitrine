import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  server: {
    compatibility: "nodejs",
  },
});
