/**
 * x-cw — the local stdio MCP server that gives Claude Desktop the doors it has
 * no shell to open for itself: CST handoffs against the shared store, YouTube
 * transcripts, the Linear PM handbook, and the cclio snapshot.
 *
 * Wiring only. Each tool family owns its own module, and the handoff family
 * owns nothing at all — it forwards to `x handoff`, the fleet cli, so cc and
 * cw read one set of store rules.
 */

/* Core */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerCclioTools } from './cclio.js';
import { registerHandoffTools } from './handoff.js';
import { registerPmTools } from './pm.js';
import { registerTranscriptTools } from './transcripts.js';

const server = new McpServer({ name: 'x-cw', version: '0.1.0' });

registerHandoffTools(server);
registerTranscriptTools(server);
registerPmTools(server);
registerCclioTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
