// An in-memory database for each Query preview. Replaying starts a fresh dataset.
export function createQueryData() {
  const sessions = new Map();
  const names = ["Noah Williams", "Priya Shah", "Theo Park", "Maya Patel", "Liam Reed"];
  const dispose = (id) => {
    const session = sessions.get(id);
    if (session) clearTimeout(session.expiry);
    sessions.delete(id);
  };
  return {
    create(id) {
      dispose(id);
      const expiry = setTimeout(() => dispose(id), 30 * 60 * 1000);
      expiry.unref();
      sessions.set(id, { added: [], expiry });
    },
    snapshot(id) {
      return sessions.get(id)?.added.slice() ?? [];
    },
    add(id) {
      const session = sessions.get(id);
      if (!session) return null;
      const index = session.added.length;
      const cycle = Math.floor(index / names.length);
      const person = {
        id: index + 4,
        name: names[index % names.length] + (cycle ? ` ${cycle + 1}` : ""),
      };
      session.added.unshift(person);
      return person;
    },
    dispose,
  };
}
