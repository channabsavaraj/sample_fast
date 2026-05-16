# TODO - Fixed ₹150 Booking Payment + Provider Accept/Reject

- [x] Create initial TODO
- [ ] Update Booking schema (amount=150, paymentStatus/bookingStatus, acceptedProviderId, rejectedProviders, customer fields)
- [ ] Update payment verification route to set fixed amount and payment/booking status + emit booking to all providers
- [ ] Implement socket/provider flow to enforce: first ACCEPT wins; remove booking from other providers instantly
- [ ] Update booking routes to support provider accept/reject state transitions safely
- [ ] Update ProviderDashboard UI: required fields + accept/reject UI + handle removal/accepted/rejected events
- [ ] Update UserDashboard UI: fixed ₹150 QR, show Payment Done + Booking Confirmed + Provider Accepted Your Booking (no manual confirm)
- [ ] Remove/adjust PaymentPage manual confirmation button to match requirement
- [ ] Run backend + frontend and manually test end-to-end with multiple providers

