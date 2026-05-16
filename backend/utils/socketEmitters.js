let ioRef = null;

module.exports = {
  setIO: (io) => {
    ioRef = io;
  },
  emitToProvider: (providerSocketId, event, payload) => {
    if (!ioRef) return;
    if (!providerSocketId) return;
    ioRef.to(providerSocketId).emit(event, payload);
  },
  emitToAllProviders: (event, payload) => {
    if (!ioRef) return;
    // no-op helper (kept for future)
    ioRef.emit(event, payload);
  }
};


