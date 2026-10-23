# a stacked lane — read when the coder's pr is a stack layer

stacked prs are on trial (`docs/test-drive/stacked-prs.md`): the lane exists to measure them, so what the stack costs your rounds is data.

- verify the stack as one change and each layer as one concern: the tree is `x lane verify-tree --stack <top pr>`, until it lands one `x lane verify-tree` per layer bottom-up
- a finding names its layer; a fix in a lower layer re-runs the upper layers' exit lines after the restack
- your verdict covers the whole stack and names its top pr
- at every layer's land, your retro gains a «stack» block apart from its 12 lines: findings per layer, whether the layer read cleaner than one big pr would, and what the restacks cost your rounds
