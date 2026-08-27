import "./globals.css";

export const metadata = {
  title: "PhysioGuard",
  description: "Vision-based rehabilitation movement guardrails",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0ea5a4" />
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon-maskable.svg" />
      </head>
      <body>
        <header className="site-header">
          <div className="site-header-inner"><a href="/" className="brand-name" aria-label="PhysioGuard home">PhysioGuard</a><p className="brand-tagline">Guided movement, made clearer</p></div>
          <span className="site-header-badge">Rehabilitation companion</span>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer-inner">
            <a href="/responsible-ai" className="site-footer-link">Responsible AI</a>
            <span className="site-footer-copy">© {new Date().getFullYear()} PhysioGuard</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
