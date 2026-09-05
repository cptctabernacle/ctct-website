/**
 * GET /api/auth
 *
 * Step 1 of the GitHub OAuth flow used by the admin CMS (/admin) to log in
 * and get permission to commit to the repo on the editor's behalf.
 *
 * Requires two Cloudflare Pages environment variables, set in the
 * dashboard under your project's Settings -> Environment variables
 * (never commit these to the repo):
 *   GITHUB_CLIENT_ID      - from your GitHub OAuth App
 *   GITHUB_CLIENT_SECRET  - from your GitHub OAuth App (used in callback.js)
 *
 * See README.md, "Admin portal" section, for the full setup checklist.
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response(
      "Admin login isn't configured yet - GITHUB_CLIENT_ID is missing from this Cloudflare Pages project's environment variables. See README.md.",
      { status: 500 }
    );
  }

  const redirectUri = `${url.origin}/api/callback`;
  const authorizeUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=repo` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return Response.redirect(authorizeUrl, 302);
}
