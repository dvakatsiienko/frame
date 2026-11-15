-- probe (dima o5, 2026-11-15): cmd+shift+k clears the screen like warp's cmd+k; cmd+k stays the session switch
rex.bind("cmd+shift+k", "pane.send_key", { key = "ctrl+l" })
