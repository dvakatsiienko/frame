# x has no mcp mirror; skills and the cw tools call x

an mcp server over x would reach cw directly, but it keeps its schemas resident in every session, and the fleet's tooling rule is cli over mcp wherever possible (`rules/fleet-tooling.md`). so the mechanic lives once, in x: a skill keeps the judgment and points at `x <family> --help`, and each `x-cw` tool is a one-line shell to an x verb. cw reaches x through Desktop Commander on the mac; a cloud session gets the repo but never x.

- revisit only if the cw-door probe shows Desktop Commander cannot carry x's envelope
