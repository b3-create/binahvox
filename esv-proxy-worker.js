/**
 * BinahVox — ESV API proxy (Cloudflare Worker)
 *
 * Why this exists: Crossway's ESV API is built for server-to-server calls,
 * not for a webpage calling it directly from the browser — it doesn't send
 * the CORS headers browsers require, so fetch() from binahvox pages fails
 * even with a valid key. This worker sits in between: your browser calls
 * this worker, the worker calls api.esv.org, and adds the CORS header the
 * browser needs.
 *
 * Setup (about 5 minutes, all free):
 * 1. Go to https://dash.cloudflare.com/ and sign up (free tier is plenty).
 * 2. Workers & Pages → Create → Create Worker → give it any name
 *    (e.g. "binahvox-esv-proxy") → Deploy.
 * 3. Click "Edit code", delete the placeholder code, paste this whole file
 *    in, then click "Deploy" again.
 * 4. Copy the worker's URL (looks like
 *    https://binahvox-esv-proxy.YOURNAME.workers.dev).
 * 5. In BinahVox, open "ESV API key (one-time setup)" and paste that URL
 *    into the "proxy URL" field, then Save. Your ESV API key stays in your
 *    own browser and is sent straight through to Crossway — this worker
 *    never stores or sees it beyond passing the request along.
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Only allow passing through to the ESV passage-text endpoint.
    if (!url.pathname.startsWith("/v3/passage/text/")) {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }

    const upstreamUrl = "https://api.esv.org" + url.pathname + url.search;
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { "Authorization": authHeader },
    });

    const body = await upstreamResponse.text();

    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
