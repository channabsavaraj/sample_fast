import { useEffect, useMemo, useState } from "react";
import api from "../api";

// Legacy file kept for compatibility.
// MAIN REQUIREMENT: No manual payment confirmation button.
// This page is not used by the current UserDashboard QR flow.

export default function PaymentPage() {
  const [bookingId, setBookingId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [bookingStatus, setBookingStatus] = useState("pending_payment");

  useEffect(() => {
    // Try to get bookingId from URL: /payment?bookingId=...
    const params = new URLSearchParams(window.location.search);
    const id = params.get("bookingId");
    setBookingId(id);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await api.get(`/payments/status/${bookingId}`);
          if (cancelled) return;
          setPaymentStatus(res.data.paymentStatus);
          setBookingStatus(res.data.bookingStatus);
          if (res.data.paymentStatus === "paid" || res.data.paymentStatus === "failed") break;
        } catch (e) {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const qrAmount = 150;

  const statusLine = useMemo(() => {
    if (paymentStatus === "paid") return "✅ Payment Done";
    if (paymentStatus === "failed") return "❌ Payment Failed";
    return "⏳ Waiting for Payment...";
  }, [paymentStatus]);

  return (
    <div className="payment-container">
      <h3 style={{ marginBottom: "20px" }}>💳 Payment</h3>

      <div className="payment-qr">
        <img
          src="/scanner.jpeg"
          alt={`QR for ₹${qrAmount}`}
          style={{
            width: "180px",
            height: "180px",
            objectFit: "contain",
            borderRadius: "10px",
          }}
        />
      </div>

      <p style={{ margin: "10px 0", color: "#6B7280" }}>
        Fixed amount: <strong>₹{qrAmount}</strong>
      </p>

      <div style={{ width: "100%", padding: "10px 0", color: paymentStatus === "paid" ? "#16a34a" : paymentStatus === "failed" ? "#dc2626" : "#f59e0b", fontWeight: 700, marginTop: 8 }}>
        {statusLine}
      </div>

      {paymentStatus === "paid" && bookingStatus === "waiting_provider" ? (
        <p style={{ color: "#6B7280", marginTop: 12, fontWeight: 700 }}>
          Waiting for Provider Acceptance
        </p>
      ) : null}

      {paymentStatus === "paid" && bookingStatus === "confirmed" ? (
        <p style={{ color: "#16a34a", marginTop: 12, fontWeight: 700 }}>
          Provider Accepted Your Booking
        </p>
      ) : null}

      {bookingStatus === "rejected" ? (
        <p style={{ color: "#dc2626", marginTop: 12, fontWeight: 700 }}>
          Booking Rejected
        </p>
      ) : null}
    </div>
  );
}

