import { NextResponse, type NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // In development, skip strict security headers to avoid blocking Next.js HMR and client hydration.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const res = NextResponse.next();
  // Strict CSP that allows webcam + WASM + OpenAI API
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.openai.com",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()" );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mediapipe/|pdf.worker.min.mjs).*)",
  ],
};
