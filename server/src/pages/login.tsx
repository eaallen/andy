import type { FC } from "hono/jsx";
import type { SessionUser } from "@/auth/session.js";
import type { LoginMode } from "@/auth/login-url.js";
import { Layout } from "@/pages/layout.js";

type LoginPageProps = {
  mode: LoginMode;
  returnTo: string;
  email?: string;
  error?: string | null;
  notice?: string | null;
  pendingToken?: string;
  user?: SessionUser | null;
};

/**
 * On-site sign-in / sign-up forms backed by WorkOS User Management APIs.
 * @param props - Mode, return path, optional flash messages, and session user.
 */
export const LoginPage: FC<LoginPageProps> = (props) => {
  const mode = props.mode;
  const email = props.email ?? "";
  const returnTo = props.returnTo;
  const pendingToken = props.pendingToken ?? "";

  const title =
    mode === "signup"
      ? "Create account — Andy"
      : mode === "magic" || mode === "verify-email"
        ? "Enter code — Andy"
        : "Sign in — Andy";

  const heading =
    mode === "signup"
      ? "Create your account"
      : mode === "magic"
        ? "Check your email"
        : mode === "verify-email"
          ? "Verify your email"
          : "Sign in";

  const lede =
    mode === "signup"
      ? "Create an Andy account to generate circuit labs from diagrams."
      : mode === "magic"
        ? `We sent a one-time code to ${email || "your email"}. Enter it below.`
        : mode === "verify-email"
          ? `Enter the verification code we sent to ${email || "your email"}.`
          : "Sign in to author labs. Your session stays on Andy — no redirect to WorkOS.";

  return (
    <Layout title={title} user={props.user}>
      <main class="auth">
        <section class="auth-panel">
          <p class="auth-eyebrow">Andy</p>
          <h1 class="auth-title">{heading}</h1>
          <p class="auth-lede">{lede}</p>

          {props.error ? (
            <p class="auth-flash auth-flash-error" role="alert">
              {props.error}
            </p>
          ) : null}
          {props.notice ? (
            <p class="auth-flash auth-flash-notice" role="status">
              {props.notice}
            </p>
          ) : null}

          {mode === "signin" ? (
            <>
              <form class="auth-form" method="post" action="/login">
                <input type="hidden" name="returnTo" value={returnTo} />
                <label class="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autocomplete="username"
                    required
                    value={email}
                  />
                </label>
                <label class="auth-field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autocomplete="current-password"
                    required
                    minlength={8}
                  />
                </label>
                <button class="btn-primary auth-submit" type="submit">
                  Sign in
                </button>
              </form>

              <form class="auth-form auth-form-secondary" method="post" action="/login/magic">
                <input type="hidden" name="returnTo" value={returnTo} />
                <label class="auth-field">
                  <span>Or email a one-time code</span>
                  <input
                    type="email"
                    name="email"
                    autocomplete="username"
                    required
                    value={email}
                    placeholder="you@school.edu"
                  />
                </label>
                <button class="btn-ghost auth-submit" type="submit">
                  Email me a code
                </button>
              </form>

              <p class="auth-switch">
                New here?{" "}
                <a href={`/login?mode=signup&returnTo=${encodeURIComponent(returnTo)}`}>
                  Create an account
                </a>
              </p>
            </>
          ) : null}

          {mode === "signup" ? (
            <>
              <form class="auth-form" method="post" action="/signup">
                <input type="hidden" name="returnTo" value={returnTo} />
                <label class="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autocomplete="username"
                    required
                    value={email}
                  />
                </label>
                <label class="auth-field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autocomplete="new-password"
                    required
                    minlength={8}
                  />
                </label>
                <button class="btn-primary auth-submit" type="submit">
                  Create account
                </button>
              </form>
              <p class="auth-switch">
                Already have an account?{" "}
                <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
                  Sign in
                </a>
              </p>
            </>
          ) : null}

          {mode === "magic" ? (
            <form class="auth-form" method="post" action="/login/magic/verify">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="email" value={email} />
              <label class="auth-field">
                <span>One-time code</span>
                <input
                  type="text"
                  name="code"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  autofocus
                />
              </label>
              <button class="btn-primary auth-submit" type="submit">
                Continue
              </button>
              <p class="auth-switch">
                <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
                  Back to sign in
                </a>
              </p>
            </form>
          ) : null}

          {mode === "verify-email" ? (
            <form class="auth-form" method="post" action="/login/verify-email">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="pendingToken" value={pendingToken} />
              <label class="auth-field">
                <span>Verification code</span>
                <input
                  type="text"
                  name="code"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  autofocus
                />
              </label>
              <button class="btn-primary auth-submit" type="submit">
                Verify and continue
              </button>
              <p class="auth-switch">
                <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
                  Back to sign in
                </a>
              </p>
            </form>
          ) : null}
        </section>
      </main>
    </Layout>
  );
};
