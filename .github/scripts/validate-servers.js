'use strict';

/**
 * Mindustry server-list PR validator. Generated entirely by claude (it is vibecoded slop).
 *
 * - Diffs servers_v8.json / servers_be.json between PR base and head
 * - Parses the JSON (reports a friendly error if it doesn't parse)
 * - Extracts addresses that are new/changed in this PR
 * - Pings each one using the Mindustry UDP server-info protocol
 * - Posts (or updates) a single comment on the PR with the results
 */

const { execSync } = require('child_process');
const dgram = require('dgram');

const WATCHED_FILES = ['servers_v8.json', 'servers_be.json'];
const DEFAULT_PORT = 6567;
const PING_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_PINGS = 12;
const COMMENT_MARKER = '<!-- mindustry-server-validator -->';

const GAMEMODES = ['survival', 'sandbox', 'attack', 'pvp', 'editor'];

const {
  GITHUB_TOKEN,
  PR_NUMBER,
  BASE_SHA,
  HEAD_SHA,
  REPO,
} = process.env;

if (!GITHUB_TOKEN || !PR_NUMBER || !BASE_SHA || !HEAD_SHA || !REPO) {
  console.error('Missing one or more required env vars: GITHUB_TOKEN, PR_NUMBER, BASE_SHA, HEAD_SHA, REPO');
  process.exit(1);
}

const [OWNER, REPO_NAME] = REPO.split('/');

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/** Returns file contents at a given ref, or null if the file doesn't exist at that ref. */
function readFileAtRef(ref, path) {
  try {
    return execSync(`git show ${ref}:${JSON.stringify(path).slice(1, -1)}`, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch (err) {
    return null; // file didn't exist at that ref (or path typo) - treated as "no entries"
  }
}

// Make sure we actually have both commits available even though checkout only
// fetched the PR head ref by default in some configurations.
function ensureRefsAvailable() {
  for (const sha of [BASE_SHA, HEAD_SHA]) {
    try {
      execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
    } catch {
      try {
        execSync(`git fetch origin ${sha}`, { stdio: 'ignore' });
      } catch {
        // best effort; readFileAtRef will just fail gracefully later
      }
    }
  }
}

// ---------------------------------------------------------------------------
// JSON parsing / diffing
// ---------------------------------------------------------------------------

function normalizeAddress(addr) {
  return String(addr).trim();
}

/** Flattens a servers_*.json structure into a Set of "name||address" pairs and a Set of bare addresses. */
function extractAddresses(jsonText) {
  if (jsonText == null) return new Set();
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) throw new Error('Top-level JSON value must be an array');
  const addresses = new Set();
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const addrList = Array.isArray(entry.address) ? entry.address : [];
    for (const a of addrList) {
      addresses.add(normalizeAddress(a));
    }
  }
  return addresses;
}

/**
 * For a single watched file, returns:
 *  - parseError: string | null
 *  - newAddresses: string[] (present in head, not in base)
 */
function diffFile(path) {
  const baseText = readFileAtRef(BASE_SHA, path);
  const headText = readFileAtRef(HEAD_SHA, path);

  if (headText == null) {
    // File doesn't exist at head - nothing to validate (maybe it was deleted).
    return { path, parseError: null, newAddresses: [], skipped: true };
  }

  let headAddrs;
  try {
    headAddrs = extractAddresses(headText);
  } catch (err) {
    return { path, parseError: err.message, newAddresses: [], skipped: false };
  }

  let baseAddrs;
  try {
    baseAddrs = extractAddresses(baseText); // baseText may be null -> empty set
  } catch (err) {
    // Base was already broken somehow; treat as empty so we still test the new addresses.
    baseAddrs = new Set();
  }

  const newAddresses = [...headAddrs].filter((a) => !baseAddrs.has(a));
  return { path, parseError: null, newAddresses, skipped: false };
}

// ---------------------------------------------------------------------------
// Mindustry UDP ping protocol
// ---------------------------------------------------------------------------

function readString(buf, offsetRef) {
  const length = buf.readUInt8(offsetRef.value) & 0xff;
  offsetRef.value += 1;
  const str = buf.toString('utf8', offsetRef.value, offsetRef.value + length);
  offsetRef.value += length;
  return str;
}

function parseServerResponse(buf) {
  // The response payload starts directly with the length-prefixed host
  // string - no leading packet-id byte to skip.
  const offset = { value: 0 };

  const name = readString(buf, offset);
  const map = readString(buf, offset);
  const players = buf.readInt32BE(offset.value); offset.value += 4;
  const wave = buf.readInt32BE(offset.value); offset.value += 4;
  const version = buf.readInt32BE(offset.value); offset.value += 4;
  const versionType = readString(buf, offset);
  const modeByte = buf.readUInt8(offset.value); offset.value += 1;
  const gamemode = GAMEMODES[modeByte] || GAMEMODES[0];
  const playerLimit = buf.readInt32BE(offset.value); offset.value += 4;
  const description = readString(buf, offset);

  let modeName = null;
  let hostPort = null;
  try {
    const rawModeName = readString(buf, offset);
    modeName = rawModeName.length ? rawModeName : null;
    hostPort = buf.readUInt16BE(offset.value); offset.value += 2;
  } catch {
    // Older servers may not send these trailing fields; that's fine.
  }

  return { name, map, players, wave, version, versionType, gamemode, playerLimit, description, modeName, hostPort };
}

function splitAddress(address) {
  // Handles "host:port" while tolerating IPv6-ish or hostnames without colons.
  const idx = address.lastIndexOf(':');
  if (idx > -1) {
    const maybePort = address.slice(idx + 1);
    if (/^\d+$/.test(maybePort)) {
      return { host: address.slice(0, idx), port: parseInt(maybePort, 10) };
    }
  }
  return { host: address, port: DEFAULT_PORT };
}

function pingServer(address) {
  const { host, port } = splitAddress(address);

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;
    const start = Date.now();

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ address, ok: false, error: `No response within ${PING_TIMEOUT_MS}ms` });
    }, PING_TIMEOUT_MS);

    socket.on('error', (err) => {
      finish({ address, ok: false, error: err.message });
    });

    socket.on('message', (msg) => {
      const ping = Date.now() - start;
      try {
        const info = parseServerResponse(msg);
        finish({ address, ok: true, ping, ...info });
      } catch (err) {
        finish({ address, ok: false, error: `Malformed response: ${err.message}` });
      }
    });

    try {
      const requestPacket = Buffer.from([0xfe, 0x01]); // -2, 1 as signed bytes
      socket.send(requestPacket, port, host, (err) => {
        if (err) finish({ address, ok: false, error: err.message });
      });
    } catch (err) {
      finish({ address, ok: false, error: err.message });
    }
  });
}

async function pingAll(addresses) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < addresses.length) {
      const addr = addresses[i++];
      results.push(await pingServer(addr));
    }
  }
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_PINGS, addresses.length) }, worker);
  await Promise.all(workers);
  // Preserve original ordering
  const order = new Map(addresses.map((a, idx) => [a, idx]));
  results.sort((a, b) => order.get(a.address) - order.get(b.address));
  return results;
}

// ---------------------------------------------------------------------------
// Comment formatting
// ---------------------------------------------------------------------------

function escapeMd(s) {
  if (s == null) return '';
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Strips Mindustry color/format codes like [red], [#ff0000], [accent] etc.
 * A doubled bracket "[[" is an escape for a literal "[" and is preserved
 * (with the escaping removed), not treated as a color code.
 * NOTE: This doesn't actually check if it is a valid color code, anything inside brackets is removed.
 */
function stripColorCodes(s) {
  if (s == null) return s;
  const ESCAPE_PLACEHOLDER = '\u0000LITERAL_BRACKET\u0000';
  return String(s)
    .replace(/\[\[/g, ESCAPE_PLACEHOLDER)
    .replace(/\[[^[\]]*\]/g, '')
    .split(ESCAPE_PLACEHOLDER).join('[');
}

function formatResultsTable(results) {
  if (!results.length) return '_No new server addresses were found to test._';
  const header = '| Status | Address | Server Name | Gamemode | Players | Version | Description |\n' +
                 '|---|---|---|---|---|---|---|';
  const rows = results.map((r) => {
    if (!r.ok) {
      return `| ⚠️ Failed | \`${escapeMd(r.address)}\` | — | — | — | — | ${escapeMd(r.error)} |`;
    }
    const players = r.playerLimit ? `${r.players}/${r.playerLimit}` : `${r.players}`;
    const version = r.version < 0 ? 'custom build' : `${r.version}`;
    const name = escapeMd(stripColorCodes(r.name));
    const description = escapeMd(stripColorCodes(r.description)) || '_none_';
    return `| ✅ OK (${r.ping}ms) | \`${escapeMd(r.address)}\` | ${name} | ${escapeMd(r.gamemode)} | ${players} | ${version} | ${description} |`;
  });
  return [header, ...rows].join('\n');
}

function buildCommentBody({ parseErrors, fileResults }) {
  const lines = [COMMENT_MARKER, '## Mindustry Server List Validation', ''];

  if (parseErrors.length) {
    lines.push('### ❌ JSON parse errors');
    for (const e of parseErrors) {
      lines.push(`- **${e.path}**: ${escapeMd(e.parseError)}`);
    }
    lines.push('', 'Fix the JSON syntax above and push an update to this PR; pings were not run.', '');
  }

  const anyChangedAddresses = fileResults.some((fr) => !fr.skipped && !fr.parseError && fr.newAddresses.length);
  if (!parseErrors.length && !anyChangedAddresses) {
    lines.push('_No new or changed server addresses were detected in this PR._', '');
  }

  for (const fr of fileResults) {
    if (fr.skipped || fr.parseError) continue;
    if (!fr.newAddresses.length) continue;
    lines.push(`### \`${fr.path}\``);
    lines.push(formatResultsTable(fr.results), '');
  }

  const anyFailures = fileResults.some((fr) => (fr.results || []).some((r) => !r.ok));
  if (anyFailures) {
    lines.push('> ⚠️ One or more addresses did not respond to a ping. Double-check the address/port and that the server is online and reachable from the public internet.');
  }

  lines.push('', `<sub>Last updated: ${new Date().toISOString()}</sub>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// GitHub API (plain fetch, no extra deps)
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

async function ghRequest(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function upsertPrComment(body) {
  const comments = await ghRequest('GET', `/repos/${OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments?per_page=100`);
  const existing = (comments || []).find((c) => c.body && c.body.includes(COMMENT_MARKER));
  if (existing) {
    await ghRequest('PATCH', `/repos/${OWNER}/${REPO_NAME}/issues/comments/${existing.id}`, { body });
  } else {
    await ghRequest('POST', `/repos/${OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`, { body });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  ensureRefsAvailable();

  const fileResults = WATCHED_FILES.map(diffFile);
  const parseErrors = fileResults.filter((f) => f.parseError);

  if (parseErrors.length) {
    const body = buildCommentBody({ parseErrors, fileResults });
    await upsertPrComment(body);
    console.error('JSON parse error(s) found; see PR comment.');
    process.exit(1);
  }

  for (const fr of fileResults) {
    if (fr.skipped || !fr.newAddresses.length) {
      fr.results = [];
      continue;
    }
    console.log(`Pinging ${fr.newAddresses.length} address(es) from ${fr.path}...`);
    fr.results = await pingAll(fr.newAddresses);
  }

  const body = buildCommentBody({ parseErrors: [], fileResults });
  await upsertPrComment(body);

  const anyFailures = fileResults.some((fr) => (fr.results || []).some((r) => !r.ok));
  if (anyFailures) {
    console.error('One or more servers failed to respond to ping. See PR comment for details.');
    process.exitCode = 1;
  } else {
    console.log('All pinged servers responded successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
