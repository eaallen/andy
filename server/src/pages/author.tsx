import type { FC } from "hono/jsx";
import { Layout } from "@/pages/layout.js";

/**
 * Author UI — diagram image → lab YAML; client logic in /author-client.js.
 */
export const AuthorPage: FC = () => (
  <Layout
    title="Andy — Create lab from diagram image"
    active="author"
    stylesheets={["/author.css"]}
    scripts={["/andy.js", "/author-client.js"]}
  >
    <main class="author">
      <header class="author-top">
        <div class="brand">
          <div class="brand-mark">Andy</div>
          <h1>Create lab from image</h1>
          <p>
            Drop a wiring diagram. Andy drafts lab YAML you can open in the
            circuit lab.
          </p>
        </div>
        <a class="back" href="/lab">
          ← Labs
        </a>
      </header>

      <form id="form">
        <label class="drop" id="drop" for="image">
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            required
          />
          <div class="drop-empty">
            <strong>Drop a diagram image</strong>
            <span>or click to browse · PNG, JPG, WebP</span>
          </div>
          <div class="drop-preview">
            <img id="thumb" alt="Uploaded diagram preview" />
            <div class="drop-meta">
              <strong id="fileName"></strong>
              <span id="fileInfo"></span>
              <span class="change-file">Change image</span>
            </div>
          </div>
        </label>

        <details class="hints">
          <summary>
            Optional hints for the model
            <span class="hint-note">
              Title and instructor notes help the model match your diagram.
            </span>
          </summary>
          <div class="hints-fields">
            <label>
              Title hint
              <input
                id="title"
                name="title"
                type="text"
                placeholder="e.g. Three-way hallway lights"
              />
            </label>
            <label>
              Instructor notes
              <textarea
                id="notes"
                name="notes"
                placeholder="Shared neutrals, Front owns its own chime, etc."
              ></textarea>
            </label>
          </div>
        </details>

        <div class="actions">
          <button type="submit" class="primary" id="submit">
            Generate YAML
          </button>
          <span class="status" id="status"></span>
        </div>
      </form>

      <section class="result" id="result" aria-live="polite">
        <div class="result-head">
          <h2>Generated YAML</h2>
          <div class="result-actions">
            <button type="button" class="ghost" id="copy" disabled>
              Copy
            </button>
            <button type="button" class="ghost" id="openLab" disabled>
              Open in lab
            </button>
          </div>
        </div>
        <p class="meta" id="meta"></p>
        <ul class="warnings" id="warnings"></ul>
        <pre class="yaml" id="yaml"></pre>
      </section>

      <section class="demo" id="demoPreview">
        <h2>Demo preview</h2>
        <div class="lab-mount" id="labMount"></div>
      </section>
    </main>
  </Layout>
);
