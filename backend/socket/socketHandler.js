module.exports = (io) => {
  let providers = {};

  // expose providers map so payment route can emit after payment success
  module.exports._providers = providers;

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("provider-online", (id) => {
      providers[id] = socket.id;
      console.log(`Provider ${id} is online with socket ID: ${socket.id}`);
    });

    // Providers accept/reject requests
    // data: { bookingId, status: 'accepted'|'rejected', providerId }
    socket.on("booking-response", async (data) => {
      try {
        const Booking = require("../models/Booking");

        const bookingId = data?.bookingId;
        const providerId = data?.providerId;
        const status = data?.status;

        if (!bookingId || !providerId || !status) return;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // Only act if booking is still waiting
        if (booking.bookingStatus === "confirmed" || booking.bookingStatus === "rejected") return;

        if (status === "accepted") {
          // enforce one-provider acceptance
          if (!booking.acceptedProviderId) {
            booking.acceptedProviderId = providerId;
            booking.bookingStatus = "confirmed";
            booking.paymentStatus = booking.paymentStatus === "paid" ? "paid" : booking.paymentStatus;
            booking.status = "pending";
            await booking.save();

            // notify accepting provider
            const providerSocketId = providers[String(providerId)];
            if (providerSocketId) {
              io.to(providerSocketId).emit("booking-accepted", {
                bookingId: booking._id,
                acceptedProviderId: booking.acceptedProviderId,
              });
            }

            // notify other providers to remove this booking instantly
            for (const [otherProviderId, otherSocketId] of Object.entries(providers)) {
              if (String(otherProviderId) === String(providerId)) continue;
              io.to(otherSocketId).emit("booking-removed", {
                bookingId: booking._id,
              });
            }

            // broadcast update for user UI polling/list refresh
            io.emit("booking-update", {
              bookingId: booking._id,
              bookingStatus: booking.bookingStatus,
              paymentStatus: booking.paymentStatus,
            });
          }
        }

        if (status === "rejected") {
          // if already accepted, ignore rejects
          if (booking.bookingStatus === "confirmed") return;

          // push unique
          const pid = booking.rejectedProviders.map(String);
          if (!pid.includes(String(providerId))) {
            booking.rejectedProviders.push(providerId);
          }

          const Provider = require("../models/Provider");
          const allProviders = await Provider.find({ verified: true }).lean();
          const total = allProviders.length;

          if (booking.rejectedProviders.length >= total) {
            booking.bookingStatus = "rejected";
            booking.status = "failed";
          }

          await booking.save();

          io.emit("booking-update", {
            bookingId: booking._id,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
          });
        }
      } catch (e) {
        console.warn("booking-response failed", e?.message || e);
      }
    });

    // Receive provider live location and broadcast to clients
    socket.on("provider-location", (data) => {
      io.emit("providerLocationUpdate", data);
    });

    socket.on("disconnect", () => {
      for (const [providerId, socketId] of Object.entries(providers)) {
        if (socketId === socket.id) {
          delete providers[providerId];
          console.log(`Provider ${providerId} is now offline`);
          break;
        }
      }
    });
  });
};


