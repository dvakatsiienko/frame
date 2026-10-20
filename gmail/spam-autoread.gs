// google apps script, runs inside the account on a 15-minute trigger: every unread thread in spam
// is marked read, so newton's unread counter stays at zero. spam itself stays where gmail put it.
// paste at script.google.com, run once by hand to grant the scope, then add a time-driven trigger.
// google's own blips («server error», «INTERNAL») pass on a retry; a failure that outlives 3 tries
// still throws, so a real break keeps sending its failure mail.
function markSpamRead() {
  for (let attempt = 1; ; attempt++) {
    try {
      const threads = GmailApp.search('in:spam is:unread', 0, 500);
      if (threads.length) GmailApp.markThreadsRead(threads);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      Utilities.sleep(20000);
    }
  }
}
