import type { FC, PropsWithChildren } from "hono/jsx";

export type NavId = "home" | "lab" | "author";

type LayoutProps = PropsWithChildren<{
  title: string;
  active?: NavId;
  stylesheets?: string[];
  scripts?: string[];
  bodyClass?: string;
}>;

/**
 * Shared HTML shell for marketing, lab, and author pages.
 * @param props - Page title, nav highlight, CSS/JS assets, and body content.
 */
export const Layout: FC<LayoutProps> = (props) => {
  const sheets = props.stylesheets ?? [];
  const scripts = props.scripts ?? [];
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/site.css" />
        {sheets.map((href) => (
          <link rel="stylesheet" href={href} />
        ))}
      </head>
      <body class={props.bodyClass ?? ""}>
        <header class="site-nav">
          <a class="site-nav-brand" href="/">
            Andy
          </a>
          <nav class="site-nav-links" aria-label="Primary">
            <a class={props.active === "home" ? "is-active" : ""} href="/">
              About
            </a>
            <a class={props.active === "lab" ? "is-active" : ""} href="/lab">
              Lab
            </a>
            <a
              class={props.active === "author" ? "is-active" : ""}
              href="/author"
            >
              Author
            </a>
          </nav>
        </header>
        {props.children}
        {scripts.map((src) => (
          <script src={src} />
        ))}
      </body>
    </html>
  );
};
