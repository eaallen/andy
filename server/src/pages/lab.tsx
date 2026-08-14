import type { FC } from "hono/jsx";
import type { SessionUser } from "@/auth/session.js";
import { Layout } from "@/pages/layout.js";
import {
  serializeLabClientContext as sterilizeLabClientContext,
} from "@/voshi/context.js";
import type { VoshiSession } from "@/voshi/session.js";

type PageProps = {
  user?: SessionUser | null;
  voshi?: VoshiSession | null;
};

/**
 * Circuit lab shell — picker UI; mounting is handled by /lab-client.js + andy.js.
 * @param props - Optional WorkOS user and Voshi LMS session.
 */
export const LabPage: FC<PageProps> = (props) => {
  const voshi = props.voshi ?? null;
  const studentLaunch = voshi?.role === "student";

  return (
    <Layout
      title="AndyLabs"
      active="lab"
      stylesheets={["/lab.css"]}
      scripts={["/andy.js", "/lab-client.js"]}
      bodyClass={voshi ? "lab-body lab-embed" : "lab-body"}
      user={props.user}
      embed={Boolean(voshi)}
      embedLabel={voshi?.locationLabel || "Circuit Lab"}
    >
      <div class="app-shell">
        <nav class="lab-picker" aria-label="Choose lab">
          <label class="lab-picker-label" for="lab-select">
            Lab
          </label>
          <select id="lab-select" class="lab-picker-select"></select>
          {studentLaunch ? null : (
            <a class="lab-picker-author" href="/author">
              Create from image
            </a>
          )}
          <span id="voshi-grade-status" class="lab-picker-status" hidden></span>
        </nav>
        {voshi ? (
          // I really dislike this idea. seems like since we are doing server side rendering 
          // we could expose this data in a more secure way
          <script
            type="application/json"
            id="andy-lab-context"
            dangerouslySetInnerHTML={{
              // sterilizeLabClientContext removes the sensitive data out of the voshi session
              __html: sterilizeLabClientContext(voshi),
            }}
          />
        ) : null}
        <div id="lab-root" class="lab-root"></div>
      </div>
    </Layout>
  );
};
