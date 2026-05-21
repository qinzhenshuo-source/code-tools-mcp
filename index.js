#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "crypto";
import { z } from "zod";

const server = new Server(
  { name: "code-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────
const tools = [
  {
    name: "json_format",
    description: "Format and validate JSON. Minify or pretty-print.",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "JSON string to format" },
        mode: { type: "string", enum: ["pretty", "minify"], default: "pretty" },
      },
      required: ["json"],
    },
  },
  {
    name: "base64",
    description: "Encode or decode Base64 strings.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to encode/decode" },
        action: { type: "string", enum: ["encode", "decode"] },
      },
      required: ["text", "action"],
    },
  },
  {
    name: "url_encode_decode",
    description: "URL-encode or decode strings.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to encode/decode" },
        action: { type: "string", enum: ["encode", "decode"] },
      },
      required: ["text", "action"],
    },
  },
  {
    name: "hash",
    description: "Generate MD5, SHA1, SHA256, or SHA512 hash of input.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to hash" },
        algorithm: {
          type: "string",
          enum: ["md5", "sha1", "sha256", "sha512"],
          default: "sha256",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "uuid",
    description: "Generate UUID v4 or v1.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of UUIDs to generate", default: 1 },
        version: { type: "string", enum: ["v4", "v1"], default: "v4" },
      },
    },
  },
  {
    name: "jwt_decode",
    description: "Decode a JWT token (header + payload) without verification.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "JWT token string" },
      },
      required: ["token"],
    },
  },
  {
    name: "regex",
    description: "Test a regex pattern against text. Returns matches with groups.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern (JS syntax)" },
        text: { type: "string", description: "Text to test against" },
        flags: { type: "string", description: "Regex flags (e.g. 'gi', 'm')" },
      },
      required: ["pattern", "text"],
    },
  },
  {
    name: "timestamp",
    description: "Convert between Unix timestamps and human-readable dates.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Timestamp (seconds or ms) or ISO date string" },
      },
      required: ["value"],
    },
  },
  {
    name: "text_transform",
    description: "Transform text: case conversion, sort lines, deduplicate lines.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        action: {
          type: "string",
          enum: ["upper", "lower", "title", "camel", "snake", "kebab", "pascal", "sort_lines", "dedup_lines", "reverse", "word_count", "char_count"],
        },
      },
      required: ["text", "action"],
    },
  },
  {
    name: "color_convert",
    description: "Convert between color formats: hex, rgb, hsl.",
    inputSchema: {
      type: "object",
      properties: {
        color: { type: "string", description: "Color value (e.g. #ff5733, rgb(255,87,51), hsl(9,100%,60%))" },
        to: { type: "string", enum: ["hex", "rgb", "hsl"] },
      },
      required: ["color", "to"],
    },
  },
  {
    name: "diff",
    description: "Generate a simple line-by-line diff between two texts.",
    inputSchema: {
      type: "object",
      properties: {
        text1: { type: "string", description: "Original text" },
        text2: { type: "string", description: "Modified text" },
      },
      required: ["text1", "text2"],
    },
  },
  {
    name: "random",
    description: "Generate random numbers, strings, or pick from a list.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["number", "string", "pick"] },
        min: { type: "number", description: "Min value (for number)" },
        max: { type: "number", description: "Max value (for number)" },
        length: { type: "number", description: "Length (for string)", default: 16 },
        items: { type: "string", description: "Comma-separated list to pick from" },
        count: { type: "number", description: "How many items to pick", default: 1 },
      },
      required: ["type"],
    },
  },
];

// ── Tool implementations ──────────────────────────────────────

function jsonFormat(args) {
  try {
    const obj = JSON.parse(args.json);
    return args.mode === "minify" ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
  } catch (e) {
    return `Invalid JSON: ${e.message}`;
  }
}

function base64(args) {
  if (args.action === "encode") return Buffer.from(args.text, "utf-8").toString("base64");
  try {
    return Buffer.from(args.text, "base64").toString("utf-8");
  } catch (e) {
    return `Invalid Base64: ${e.message}`;
  }
}

function urlEncodeDecode(args) {
  if (args.action === "encode") return encodeURIComponent(args.text);
  return decodeURIComponent(args.text);
}

function hash(args) {
  const alg = args.algorithm || "sha256";
  return crypto.createHash(alg).update(args.text, "utf-8").digest("hex");
}

function uuidGen(args) {
  const count = args.count || 1;
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID());
  }
  return uuids.join("\n");
}

function jwtDecode(args) {
  try {
    const parts = args.token.split(".");
    if (parts.length !== 3) return "Not a valid JWT (expected 3 parts)";
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf-8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    return JSON.stringify({ header, payload }, null, 2);
  } catch (e) {
    return `JWT decode failed: ${e.message}`;
  }
}

function regex(args) {
  try {
    const re = new RegExp(args.pattern, args.flags || "");
    const matches = [...args.text.matchAll(re)];
    if (matches.length === 0) return "No matches";
    return matches
      .map((m, i) => `Match ${i + 1}: "${m[0]}" at index ${m.index}${m.length > 1 ? `\n  Groups: ${JSON.stringify(m.slice(1))}` : ""}`)
      .join("\n");
  } catch (e) {
    return `Regex error: ${e.message}`;
  }
}

function timestampConvert(args) {
  const v = args.value.trim();
  // Detect if it's a number (unix timestamp)
  if (/^\d+$/.test(v)) {
    let ts = parseInt(v);
    if (ts > 1e12) ts = Math.floor(ts / 1000); // ms → seconds
    const d = new Date(ts * 1000);
    return `Unix: ${ts}\nUTC:  ${d.toISOString()}\nLocal: ${d.toString()}`;
  }
  // Try parsing as date string
  const d = new Date(v);
  if (isNaN(d.getTime())) return `Cannot parse "${v}" as date`;
  return `Unix (s): ${Math.floor(d.getTime() / 1000)}\nUnix (ms): ${d.getTime()}\nISO: ${d.toISOString()}`;
}

function textTransform(args) {
  const { text, action } = args;
  switch (action) {
    case "upper": return text.toUpperCase();
    case "lower": return text.toLowerCase();
    case "title": return text.replace(/\b\w/g, c => c.toUpperCase());
    case "camel": return text.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "").replace(/^[A-Z]/, c => c.toLowerCase());
    case "snake": return text.replace(/([A-Z])/g, "_$1").replace(/[-\s]+/g, "_").replace(/^_/, "").toLowerCase();
    case "kebab": return text.replace(/([A-Z])/g, "-$1").replace(/[_\s]+/g, "-").replace(/^-/, "").toLowerCase();
    case "pascal": return text.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "").replace(/^[a-z]/, c => c.toUpperCase());
    case "sort_lines": return text.split("\n").sort().join("\n");
    case "dedup_lines": return [...new Set(text.split("\n"))].join("\n");
    case "reverse": return text.split("").reverse().join("");
    case "word_count": return `Words: ${text.split(/\s+/).filter(Boolean).length}, Chars: ${text.length}, Lines: ${text.split("\n").length}`;
    case "char_count": return `Characters: ${text.length} (${Buffer.from(text).length} bytes)`;
    default: return "Unknown action";
  }
}

function colorConvert(args) {
  const { color, to } = args;
  try {
    let r, g, b;
    // Parse hex
    if (color.startsWith("#")) {
      const h = color.replace("#", "");
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
    }
    // Parse rgb(...)
    else if (color.startsWith("rgb")) {
      [r, g, b] = color.match(/\d+/g).map(Number);
    }
    // Parse hsl(...)
    else if (color.startsWith("hsl")) {
      const [h, s, l] = color.match(/\d+/g).map(Number);
      const ss = s / 100, ll = l / 100;
      const c = (1 - Math.abs(2 * ll - 1)) * ss;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = ll - c / 2;
      let rr, gg, bb;
      if (h < 60) [rr, gg, bb] = [c, x, 0];
      else if (h < 120) [rr, gg, bb] = [x, c, 0];
      else if (h < 180) [rr, gg, bb] = [0, c, x];
      else if (h < 240) [rr, gg, bb] = [0, x, c];
      else if (h < 300) [rr, gg, bb] = [x, 0, c];
      else [rr, gg, bb] = [c, 0, x];
      r = Math.round((rr + m) * 255);
      g = Math.round((gg + m) * 255);
      b = Math.round((bb + m) * 255);
    }
    if (r === undefined) return "Cannot parse color";

    if (to === "hex") return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
    if (to === "rgb") return `rgb(${r}, ${g}, ${b})`;
    if (to === "hsl") {
      const rr = r / 255, gg = g / 255, bb = b / 255;
      const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
      const l = (max + min) / 2;
      if (max === min) return `hsl(0, 0%, ${Math.round(l * 100)}%)`;
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = 0;
      if (max === rr) h = ((gg - bb) / d) % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
      return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
  } catch (e) {
    return `Color conversion error: ${e.message}`;
  }
}

function diff(args) {
  const lines1 = args.text1.split("\n");
  const lines2 = args.text2.split("\n");
  const result = [];
  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    const l1 = lines1[i], l2 = lines2[i];
    if (l1 === l2) result.push(`  ${l1 || ""}`);
    else {
      if (l1 !== undefined) result.push(`- ${l1}`);
      if (l2 !== undefined) result.push(`+ ${l2}`);
    }
  }
  return result.join("\n");
}

function randomGen(args) {
  if (args.type === "number") {
    const min = args.min ?? 0, max = args.max ?? 100;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  if (args.type === "string") {
    const len = args.length || 16;
    return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
  }
  if (args.type === "pick") {
    const items = (args.items || "").split(",").map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return "No items provided";
    const count = Math.min(args.count || 1, items.length);
    const picked = [];
    const pool = [...items];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked.join(", ");
  }
}

// ── Request handlers ──────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "json_format": result = jsonFormat(args); break;
      case "base64": result = base64(args); break;
      case "url_encode_decode": result = urlEncodeDecode(args); break;
      case "hash": result = hash(args); break;
      case "uuid": result = uuidGen(args); break;
      case "jwt_decode": result = jwtDecode(args); break;
      case "regex": result = regex(args); break;
      case "timestamp": result = timestampConvert(args); break;
      case "text_transform": result = textTransform(args); break;
      case "color_convert": result = colorConvert(args); break;
      case "diff": result = diff(args); break;
      case "random": result = randomGen(args); break;
      default: return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    return { content: [{ type: "text", text: result }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

