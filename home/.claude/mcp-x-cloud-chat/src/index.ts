/**
 * x-cloud-chat — the local stdio MCP server that gives Claude Desktop the doors it has
 * no shell to open for itself: CST handoffs against the shared store, YouTube
 * transcripts, the clio snapshot, and the firelink doors (trophy-sys + the steamac vm).
 *
 * Wiring only. Each tool family owns its own module, and the handoff family
 * owns nothing at all — it forwards to `x handoff`, the fleet cli, so cc and
 * cloud-chat read one set of store rules.
 */

/* Core */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerClioTools } from './clio.js';
import { registerFirelinkTools } from './firelink.js';
import { registerHandoffTools } from './handoff.js';
import { registerTranscriptTools } from './transcripts.js';

const server = new McpServer({ name: 'x-cloud-chat', version: '0.1.0' });

registerHandoffTools(server);
registerTranscriptTools(server);
registerClioTools(server);
registerFirelinkTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
