# Code Tools MCP Server
[![MCPize](https://mcpize.com/badge/@qinzhenshuo/code-tools)](https://mcpize.com/mcp/code-tools)

A comprehensive developer utility MCP server providing 12 tools for AI agents and developers.

## Tools

| Tool | Description |
|------|-------------|
| `json_format` | Format/validate JSON - pretty print or minify |
| `base64` | Encode or decode Base64 strings |
| `url_encode_decode` | URL-encode or decode strings |
| `hash` | Generate MD5, SHA1, SHA256, SHA512 hashes |
| `uuid` | Generate UUID v4 or v1 |
| `jwt_decode` | Decode JWT header + payload (without verification) |
| `regex` | Test regex patterns with full match details |
| `timestamp` | Convert between Unix timestamps and dates |
| `text_transform` | Case conversion, sort/dedup lines, camel/snake/kebab/pascal |
| `color_convert` | Convert between HEX, RGB, HSL color formats |
| `diff` | Generate line-by-line text diffs |
| `random` | Generate random numbers, strings, or pick from lists |

## Connect via MCPize

Use this MCP server instantly with no local installation:

```bash
npx -y mcpize connect @qinzhenshuo/code-tools --client claude
```

Or connect at: **https://mcpize.com/mcp/code-tools**


## Usage

### Claude Code

```json
{
  "mcpServers": {
    "code-tools": {
      "command": "node",
      "args": ["path/to/code-tools/index.js"]
    }
  }
}
```

### Claude Desktop

Same config as above, in `claude_desktop_config.json`.

## License

MIT