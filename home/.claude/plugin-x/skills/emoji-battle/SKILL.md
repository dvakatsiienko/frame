---
name: emoji-battle
description: Load when Dima says «emoji battle», «top 5 emojis», «5 emojis for» or «pick an emoji».
argument-hint: "<topic>"
---

# emoji battle

five emoji candidates for one topic, his favourites first, one pick marked. he answers with a number.

1. **pick the five.** his handpicked set (`rules/fleet-output-format.md` § emoji) leads with every one that fits the
   topic; fresh fits fill the rest. five distinct emojis, each one reads as the topic at a glance.
2. **print exactly this shape**, nothing before or after; this shape overrides the emoji-prefix rule of `fleet-output-format.md`. `⭐` leads all five lines, favourite or fresh:

```
top 5 emojis for **<topic>**.

1. ⭐ <emoji> — **<name>**: <why, ≤5 words>
2. ⭐ <emoji> — **<name>**: <why, ≤5 words>
3. ⭐ <emoji> — **<name>**: <why, ≤5 words> ⬅️ **my pick**: <reason>
4. ⭐ <emoji> — **<name>**: <why, ≤5 words>
5. ⭐ <emoji> — **<name>**: <why, ≤5 words>
```

done: five numbered lines, five distinct emojis, `⬅️ **my pick**` on exactly one of them.
