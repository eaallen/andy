import type { FC } from "hono/jsx";
import { Layout } from "@/pages/layout.js";

/**
 * Marketing homepage describing the remote electrician lab project.
 */
export const HomePage: FC = () => (
  <Layout title="Andy — Remote Electrician Lab" active="home">
    <main class="home">
      <section class="home-hero">
        <p class="home-eyebrow">USU Eastern · Utah electrician prep</p>
        <h1 class="home-brand">Andy</h1>
        <p class="home-lede">
          A remote circuit lab so students who miss campus sessions can still
          wire, test, and check Utah exam–style exercises online.
        </p>
        <div class="home-cta">
          <a class="btn-primary" href="/lab">
            Open the lab
          </a>
          <a class="btn-ghost" href="/author">
            Create a lab from a diagram
          </a>
        </div>
      </section>

      <section class="home-section">
        <h2>Why it exists</h2>
        <p>
          Hands-on labs are central to electrician certification prep. Many
          students work full-time or live out of state when lab sessions run.
          Andy brings that practice online: place devices, draw wires, and get
          feedback against a correct reference circuit.
        </p>
      </section>

      <section class="home-section">
        <h2>How a lab works</h2>
        <ul class="home-modes">
          <li>
            <strong>Demo</strong> — Pre-wired reference. Press buttons and
            toggles to see simulation feedback.
          </li>
          <li>
            <strong>Lab</strong> — Same layout, empty wires. Build the circuit
            yourself, then Test continuity.
          </li>
          <li>
            <strong>Check</strong> — Grade your wiring against the lab’s
            reference rules.
          </li>
        </ul>
      </section>

      <section class="home-section">
        <h2>Author from a photo</h2>
        <p>
          Drop a photo or screenshot of a wiring diagram. The server drafts Andy
          lab YAML you can preview and open in the circuit lab — useful for
          turning hand-drawn boards into digital exercises.
        </p>
        <p>
          <a href="/author">Try the authoring tool →</a>
        </p>
      </section>
    </main>
  </Layout>
);
