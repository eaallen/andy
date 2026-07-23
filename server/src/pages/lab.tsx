import type { FC } from "hono/jsx";
import { Layout } from "@/pages/layout.js";

/**
 * Circuit lab shell — picker UI; mounting is handled by /lab-client.js + andy.js.
 */
export const LabPage: FC = () => (
  <Layout
    title="Circuit Lab — Andy"
    active="lab"
    stylesheets={["/lab.css"]}
    scripts={["/andy.js", "/lab-client.js"]}
    bodyClass="lab-body"
  >
    <div class="app-shell">
      <nav class="lab-picker" aria-label="Choose lab">
        <label class="lab-picker-label" for="lab-select">
          Lab
        </label>
        <select id="lab-select" class="lab-picker-select"></select>
        <a class="lab-picker-author" href="/author">
          Create from image
        </a>
      </nav>
      <div id="lab-root" class="lab-root"></div>
    </div>
  </Layout>
);
