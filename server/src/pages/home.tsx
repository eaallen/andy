import type { FC } from "hono/jsx";
import type { SessionUser } from "@/auth/session.js";
import { Layout } from "@/pages/layout.js";

type PageProps = {
  user?: SessionUser | null;
};

/**
 * Marketing homepage for electrician instructors — Circuit Builder Generator demo.
 * @param props - Optional authenticated user for the nav.
 */
export const HomePage: FC<PageProps> = (props) => (
  <Layout
    title="Andy — Circuit labs for electrician certification classes"
    active="home"
    scripts={["/andy.js", "/home-demo.js"]}
    user={props.user}
  >
    <main class="home">
      <section class="home-hero">
        <p class="home-eyebrow">For instructors · Electrician certification prep</p>
        <h1 class="home-brand">Andy</h1>
        <p class="home-lede">
          Turn a board photo or textbook diagram into a graded online circuit
          lab — so bigger classes still get hands-on practice for the state
          exam.
        </p>
        <div class="home-cta">
          <a class="btn-primary" href="/author">
            Try the generator
          </a>
          <a class="btn-ghost" href="/lab">
            Open a sample lab
          </a>
        </div>
        {props.user ? null : (
          <p class="home-cta-note">
            You will need to{" "}
            <a href="/login?returnTo=/author">log in</a> before you can start.
          </p>
        )}
      </section>

      <section
        class="home-demo"
        id="generator-demo"
        aria-labelledby="generator-heading"
      >
        <div class="home-demo-intro">
          <h2 id="generator-heading">Circuit Builder Generator</h2>
          <p>
            Pick a sample diagram. Andy drafts an interactive lab students can
            study, wire themselves, and get graded on.
          </p>
        </div>

        <div class="cbg" data-cbg>
          <div class="cbg-step" data-step="pick">
            <p class="cbg-label">1 · Choose a diagram</p>
            <div
              class="cbg-samples"
              role="radiogroup"
              aria-label="Sample wiring diagrams"
            >
              <label class="cbg-sample">
                <input
                  type="radio"
                  name="cbg-sample"
                  value="single-pole"
                  checked
                />
                <span class="cbg-sample-frame">
                  <img
                    src="/demo/single-pole.svg"
                    alt="Single-pole switch to lamp diagram"
                    width="640"
                    height="400"
                  />
                </span>
                <span class="cbg-sample-name">Single-pole lamp</span>
              </label>
              <label class="cbg-sample">
                <input type="radio" name="cbg-sample" value="three-way" />
                <span class="cbg-sample-frame">
                  <img
                    src="/demo/three-way.svg"
                    alt="Three-way switches to lamp diagram"
                    width="640"
                    height="400"
                  />
                </span>
                <span class="cbg-sample-name">Three-way lamp</span>
              </label>
              <label class="cbg-sample">
                <input type="radio" name="cbg-sample" value="doorbell" />
                <span class="cbg-sample-frame">
                  <img
                    src="/demo/doorbell.svg"
                    alt="Doorbell and chime wiring diagram"
                    width="640"
                    height="400"
                  />
                </span>
                <span class="cbg-sample-name">Doorbell / chime</span>
              </label>
            </div>
            <button type="button" class="btn-primary cbg-generate" data-generate>
              Generate circuit lab
            </button>
          </div>

          <div class="cbg-step cbg-thinking" data-step="thinking" hidden>
            <p class="cbg-label">2 · AI demo</p>
            <div class="cbg-thinking-panel" aria-live="polite">
              <div class="cbg-thinking-visual" aria-hidden="true">
                <span class="cbg-pulse"></span>
                <span class="cbg-pulse"></span>
                <span class="cbg-pulse"></span>
              </div>
              <p class="cbg-thinking-status" data-thinking-status>
                Reading the diagram…
              </p>
              <p class="cbg-thinking-note">
                Demo only — no upload leaves your browser. The real author tool
                uses your image.
              </p>
            </div>
          </div>

          <div class="cbg-step cbg-result" data-step="result" hidden>
            <div class="cbg-result-head">
              <p class="cbg-label">3 · Interactive lab</p>
              <button type="button" class="btn-ghost cbg-reset" data-reset>
                Try another diagram
              </button>
            </div>
            <p class="cbg-result-lede" data-result-title>
              Generated lab
            </p>
            <div class="cbg-preview" data-preview>
              <div class="cbg-preview-mount" data-lab-mount></div>
            </div>
            <details class="cbg-config">
              <summary>View lab config (YAML)</summary>
              <pre class="cbg-yaml"><code data-yaml></code></pre>
            </details>
            <p class="cbg-next">
              Ready for your own boards?{" "}
              <a href="/author">Open the author tool</a> and upload a real
              diagram.
            </p>
          </div>
        </div>
      </section>

      <section class="home-section">
        <h2>Built for growing certification classes</h2>
        <p>
          When more apprentices need board time than you have stations — or when
          someone misses a night lab — Andy keeps exam-style wiring practice
          available. Students place devices, pull wires, test continuity, and
          get graded against your reference circuit.
        </p>
      </section>

      <section class="home-section">
        <h2>How students use a lab</h2>
        <ul class="home-modes">
          <li>
            <strong>Demo</strong> — Pre-wired reference. Flip switches and press
            buttons to see how the correct circuit behaves.
          </li>
          <li>
            <strong>Lab</strong> — Same layout, empty wires. Students build it
            themselves, then test continuity.
          </li>
          <li>
            <strong>Check</strong> — Grade their wiring against the lab’s
            reference rules — instant feedback for exam prep.
          </li>
        </ul>
      </section>
    </main>
  </Layout>
);
