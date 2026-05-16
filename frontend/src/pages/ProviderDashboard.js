import socket from "../socket";
import { useEffect, useState } from "react";
import api from "../api";


export default function Provider() {
  const [req, setReq] = useState(null);
  const [providerId, setProviderId] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        setProviderId(decoded.id);
        socket.emit("provider-online", decoded.id);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    
    socket.on("new-booking", (data) => {
      setReq(data);
    });

    socket.on("booking-removed", (payload) => {
      // instantly remove from this provider dashboard if another provider accepted
      if (payload?.bookingId && req?.bookingId && payload.bookingId === req.bookingId) {
        setReq(null);
      }
    });

    socket.on("booking-accepted", (payload) => {
      // if this provider accepted, keep req visible; otherwise ignore
    });

    return () => {
      socket.off("new-booking");
    };
  }, []);

  // Emit live location while provider is online
  useEffect(() => {
    if (!providerId || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          providerId,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        socket.emit("provider-location", payload);
      },
      (err) => console.warn("Provider geolocation error:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [providerId]);

  const handleAccept = async () => {
    // accept request and inform backend/others via socket
    socket.emit("booking-response", { status: "accepted", providerId: providerId });

    if (req?._id) {
      // mark booking accepted in DB as well (booking-status confirmed after payment already)
      await api.post(`/bookings/status/${req._id}`, { status: "accepted" }).catch(() => {});
    }

    setReq(null);
  };

  const handleReject = async () => {
    socket.emit("booking-response", { status: "rejected", providerId: providerId });

    if (req?._id) {
      await api.post(`/bookings/status/${req._id}`, { status: "rejected" }).catch(() => {});
    }

    setReq(null);
  };

  if (!req) {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-logo">🚀 FastAid</div>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/";
          }}>
            Logout
          </button>
        </header>
        <div className="dashboard-content">
          <h1 className="dashboard-title">Provider Dashboard 🛠️</h1>
          <p className="dashboard-subtitle">Manage your service requests</p>
          
          <div className="no-requests">
            <div className="no-requests-icon">🔔</div>
            <div className="no-requests-text">No new service requests</div>
            <p style={{ marginTop: '10px', color: '#6B7280' }}>Waiting for new bookings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">🚀 FastAid</div>
        <button className="logout-btn" onClick={() => {
          localStorage.removeItem("token");
          window.location.href = "/";
        }}>
          Logout
        </button>
      </header>
      <div className="dashboard-content">
        <h1 className="dashboard-title">New Service Request 🔔</h1>
        
          <div className="provider-request-card">
            <div className="provider-request-title">Service: {req.serviceName}</div>

            <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '6px' }}>👤 Customer: {req.userName || req.customerName || ""}</p>
            <p style={{ fontSize: '16px', marginBottom: '10px' }}>📍 Customer Location: {req.userLocation || req.customerLocation || req.location}</p>
            <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '10px' }}>💰 Amount: ₹{req.amount ?? 150}</p>

            <p style={{ fontSize: '14px', opacity: 0.9 }}>✅ Payment Status: {req.paymentStatus || "paid"}</p>

            <div className="provider-buttons">
              <button className="provider-btn provider-btn-accept" onClick={handleAccept}>
                ✅ Accept
              </button>
              <button className="provider-btn provider-btn-reject" onClick={handleReject}>
                ❌ Reject
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
