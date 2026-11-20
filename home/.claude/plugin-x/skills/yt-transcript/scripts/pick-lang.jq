((.language // "") | split("-")[0]) as $s
| (.subtitles // {} | keys | map(select(. != "live_chat"))) as $m
| ((.automatic_captions // {}) | keys | map(select(endswith("-orig")))) as $o
| ($m | map(select(startswith("en"))))
  + (if $s == "" then [] else $m | map(select(split("-")[0] == $s)) end)
  + (if $s == "" then [] else $o | map(select(. == $s + "-orig")) end)
  + ($o | map(select(. == "en-orig")))
  + $m
  + ["en"]
| .[0]
