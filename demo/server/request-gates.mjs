// Demo-only response scheduling. Native dispatch still computes every payload.
export function createRequestGates() {
  const sessions = new Map();
  const dispose = (id) => {
    const session = sessions.get(id);
    if (!session) return;
    clearTimeout(session.expiry);
    for (const entry of session.pending) entry.finish();
    sessions.delete(id);
  };
  return {
    create(id, held) {
      dispose(id);
      const expiry = setTimeout(() => dispose(id), 30 * 60 * 1000);
      expiry.unref();
      sessions.set(id, { held, pending: new Set(), releaseNext: false, latest: 0, expiry });
    },
    begin(id) {
      const session = sessions.get(id);
      const request = session ? ++session.latest : 0;
      const slow = !!session?.slow;
      if (session) session.slow = false;
      return {
        slow,
        takeFailure() {
          // Typing supersedes earlier reads. Consume the failure only when the
          // current read delivers, so a discarded result cannot hide the error.
          if (
            !session ||
            sessions.get(id) !== session ||
            request !== session.latest ||
            !session.fail
          )
            return false;
          session.fail = false;
          return true;
        },
      };
    },
    control(id, action) {
      const session = sessions.get(id);
      if (!session) return;
      if (["fail", "slow", "cancel-fail", "cancel-slow"].includes(action)) {
        session[action.replace("cancel-", "")] = !action.startsWith("cancel-");
        return;
      }
      if (action === "dispose") return dispose(id);
      if (action === "release") {
        if (!session.pending.size) session.releaseNext = true;
        for (const entry of session.pending) entry.finish();
      } else if (action === "hold" || action === "auto") {
        session.held = action === "hold";
        for (const entry of session.pending) {
          clearTimeout(entry.timer);
          if (!session.held) entry.timer = setTimeout(() => entry.finish(), 800);
        }
      }
    },
    wait(id, response, delay = 800) {
      const session = sessions.get(id);
      return new Promise((resolve) => {
        const entry = {
          timer: undefined,
          finish: () => {
            clearTimeout(entry.timer);
            session?.pending.delete(entry);
            response.off("close", entry.finish);
            resolve();
          },
        };
        response.once("close", entry.finish);
        session?.pending.add(entry);
        if (session?.releaseNext) {
          session.releaseNext = false;
          entry.finish();
        } else if (!session?.held) entry.timer = setTimeout(() => entry.finish(), delay);
      });
    },
  };
}
