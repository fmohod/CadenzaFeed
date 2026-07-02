// Cloudflare Worker — terminal.cadenzaarthouse.com
//
// GitHub Pages serves ONE site per repo at the domain root, so a subdomain can't
// natively point at the /terminal/ subfolder. This Worker bridges that: it sits in
// front of terminal.cadenzaarthouse.com and rewrites requests onto the /terminal/
// path of the existing Pages origin (the apex site). One repo, true subdomain.
//
// Routing rules:
//   terminal.cadenzaarthouse.com/            -> origin /terminal/index.html
//   terminal.cadenzaarthouse.com/foo         -> origin /terminal/foo
//   terminal.cadenzaarthouse.com/platform/.. -> origin /platform/..   (shared libs)
//   terminal.cadenzaarthouse.com/game/..     -> origin /game/..        (engine + manifest)
//   terminal.cadenzaarthouse.com/0001/..     -> origin /0001/..        (article archive)
//
// The terminal shell fetches /platform, /game and /NNNN with root-absolute paths,
// so those must pass through to the origin root untouched; everything else is
// served from under /terminal/.

const ORIGIN = 'https://cadenzaarthouse.com';

// Paths that already live at the origin root and must NOT be prefixed with /terminal.
const ROOT_PASSTHROUGH = [
  /^\/platform\//,
  /^\/game\//,
  /^\/\d{4}\//,        // article folders: /0001/, /0002/, …
  /^\/assets\//,
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    const isRoot = ROOT_PASSTHROUGH.some((re) => re.test(path));
    if (!isRoot) {
      // Map the subdomain's own pages into /terminal/.
      if (path === '/' || path === '') {
        path = '/terminal/index.html';
      } else if (!path.startsWith('/terminal/')) {
        path = '/terminal' + path;
      }
    }

    const target = ORIGIN + path + url.search;
    const resp = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    // Pass the origin response through unchanged (status, body, content-type).
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  },
};
