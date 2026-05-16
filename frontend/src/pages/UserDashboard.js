import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import socket from "../socket";
import CityLocationInput from "../components/CityLocationInput";
import "./UserDashboard.css";

export default function UserDashboard() {

  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [showMap, setShowMap] = useState(false);
  
  // Live tracking state
  const [activeBooking, setActiveBooking] = useState(null);
  const [providerLocation, setProviderLocation] = useState(null);
  const [trackingProviderId, setTrackingProviderId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        setUser(decoded);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    loadServices();
    loadBookings();
    socket.on("booking-update", () => {
      loadBookings();
    });
    return () => {
      socket.off("booking-update");
    };
  }, []);

  const loadServices = async () => {
    try {
      const response = await api.get("/services");
      setServices(response.data);
    } catch (err) {
      console.error("Error loading services:", err);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await api.get("/bookings/my-bookings");
      setBookings(response.data);
    } catch (err) {
      console.error("Error loading bookings:", err);
    }
  };

  const handleBooking = (service) => {
    setSelectedService(service);
    setShowPayment(true);
  };

  const [gpsLoading, setGpsLoading] = useState(false);
  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const nextCoordinates = { lat, lng };
        setCoordinates(nextCoordinates);

        // No reverse-geocoding library in this project; store readable fallback.
        setLocation(`${lat}, ${lng}`);

        // Also store user location in backend so GeoJSON is correct.
        try {
          await api.put("/auth/update-location", { latitude: lat, longitude: lng, address: "" });
        } catch (e) {
          // Non-blocking: booking can still be created.
          console.warn("Failed to save user location:", e?.response?.data || e.message || e);
        }
      },
      (err) => {
        console.warn("Geolocation error:", err);
        // Allow manual selection / typing fallback
        alert("Location permission denied / unavailable. Please choose location from suggestions.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };


  // Booking should ONLY become confirmed after payment verification.
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [bookingStatus, setBookingStatus] = useState("pending_payment");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState(null);

  useEffect(() => {
    const handler = (payload) => {
      // payload: { bookingId, bookingStatus, paymentStatus }
      if (!createdBookingId) return;
      if (String(payload?.bookingId) !== String(createdBookingId)) return;

      setPaymentStatus(payload?.paymentStatus || "pending");
      setBookingStatus(payload?.bookingStatus || "pending_payment");

      // When provider confirms, show customer UI.
      if (payload?.bookingStatus === "confirmed") {
        setShowPayment(true);
      }
    };

    socket.on("booking-update", handler);
    return () => socket.off("booking-update", handler);
  }, [createdBookingId]);


  const pollPaymentStatus = async (bookingId) => {
    const startedAt = Date.now();
    const timeoutMs = 1000 * 60; // 60s timeout
    const intervalMs = 3000;

    while (Date.now() - startedAt < timeoutMs) {
      const res = await api.get(`/payments/status/${bookingId}`);
      setPaymentStatus(res.data.paymentStatus);
      setBookingStatus(res.data.bookingStatus);

      if (res.data.paymentStatus === "paid" || res.data.paymentStatus === "failed") {
        return;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    // timeout => failed
    setPaymentStatus("failed");
    setBookingStatus("failed");
  };

  // Flow:
  // 1) Create booking with paymentStatus=pending, bookingStatus=pending
  // 2) Start polling backend /api/payments/status/:bookingId
  const startPaymentFlow = async () => {
    try {
      if (!coordinates) {
        alert("Select / allow location first");
        return;
      }

      setPaymentBusy(true);
      setPaymentStatus("pending");
      setBookingStatus("pending");

      const bookingData = {
        userId: user?.id,
        serviceName: selectedService.name,
        location: location,
        coordinates: coordinates,
        // legacy
        status: "pending",
        paymentStatus: "pending"
      };

      const response = await api.post("/bookings/book", bookingData);
      // backend returns { message, bookingId }
      const bookingId = response?.data?.bookingId;
      if (!bookingId) {
        throw new Error("Booking created but bookingId missing");
      }

      setCreatedBookingId(bookingId);
      // QR screen stays open; poll for verification result.
      await pollPaymentStatus(bookingId);

      if (response?.data) {
        const latest = await api.get(`/payments/status/${bookingId}`);
        // latest will be in paymentStatus/bookingStatus state already, but keep UI consistent.
        if (latest?.data?.paymentStatus === "paid") {
          // wait a moment for bookings list refresh
          setTimeout(() => loadBookings(), 500);
          setShowPayment(false);
          setSelectedService(null);
          setLocation("");
          setCoordinates(null);
          setShowQR(false);
        } else if (latest?.data?.paymentStatus === "failed") {
          setTimeout(() => loadBookings(), 500);
          // keep modal open to show failure UI, then close
          setTimeout(() => {
            setShowPayment(false);
            setSelectedService(null);
            setLocation("");
            setCoordinates(null);
            setShowQR(false);
          }, 1500);
        }
      }
    } catch (err) {
      console.error("Error creating booking:", err);
      alert("Failed to create booking");
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      await api.post(`/bookings/status/${bookingId}`, { status: "cancelled" });
      loadBookings();
    } catch (err) {
      console.error("Error cancelling booking:", err);
    }
  };

  const getServiceIcon = (serviceName) => {
    const icons = {
      'Plumber': '🔧',
      'Electrician': '⚡',
      'AC Repair': '❄️',
      'Carpenter': '🪵',
      'House Cleaning': '🧹',
      'Painting': '🎨',
      'Pest Control': '🐛',
      'Gardening': '🌱',
      'Appliance Repair': '🔌',
      'Moving & Packing': '📦'
    };
    return icons[serviceName] || '🔧';
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.category?.toLowerCase().includes(search.toLowerCase())
  );

  const [showPlacesDropdown, setShowPlacesDropdown] = useState(false);


  return (
    <div className="dashboard-container">

      {/* Header */}
      <header className="header">
        <h1 className="logo">FASTAID</h1>
        <div className="account-info">
          <span className="welcome-text">Welcome, {user?.name || 'User'} 👋</span>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/";
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h2>Find Trusted Services Near You</h2>
        <p>
          FASTAID connects you with verified professionals for health, home,
          vehicle, tech and more — quickly and securely.
        </p>

        {/* Trust Badges */}
        <div className="badges">
          <span className="badge">✔ Verified</span>
          <span className="badge">🔒 Secure</span>
          <span className="badge">⚡ Fast Service</span>
        </div>

        {/* Search Box */}
        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search services like Plumber, Doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button>Search</button>
          </div>
        </div>

        <button className="category-btn">
          View All Categories
        </button>
      </section>

      {/* Popular Services */}
      <section className="services-section">
        <h3 className="section-title">Popular Services</h3>

        <div className="services-grid">
          {filteredServices.length > 0 ? (
            filteredServices.map((service) => (
              <div key={service._id} className="service-card">
                <div className="service-icon" style={{ fontSize: '40px', marginBottom: '10px' }}>
                  {getServiceIcon(service.name)}
                </div>
                <h4>{service.name}</h4>
                <p className="rating">⭐ {service.rating || '4.5'}</p>
                <button onClick={() => handleBooking(service)}>Book</button>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">🔍</div>
              <h3>No services found</h3>
              <p>Try a different search term</p>
            </div>
          )}
        </div>
      </section>

      {/* My Bookings Section */}
      <section className="bookings-section">
        <h3 className="bookings-title">My Bookings</h3>

        {bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No bookings yet</h3>
            <p>Book a service to get started!</p>
          </div>
        ) : (
          <div className="services-grid">
            {bookings.map((booking) => (
              <div key={booking._id} className="booking-card">
                <div className="booking-info">
                  <h4>{booking.serviceName}</h4>
                  <p>📍 {booking.location}</p>
                  <p>💰 Payment: {booking.paymentStatus}</p>
                </div>
                <div className="booking-actions">
                  <span className={`status-badge status-${booking.status}`}>
                    {booking.status}
                  </span>
                  {booking.status === "pending" && (
                    <button 
                      onClick={() => cancelBooking(booking._id)}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment Modal */}
      {showPayment && (
        <div className="payment-modal">
          <div className="payment-content">
            <h3>Booking: {selectedService?.name}</h3>
            
            {!showQR ? (
              <>
                <div className="form-group">
                  <label className="form-label">Location</label>

                  <CityLocationInput
                    value={location}
                    onChange={(val) => {
                      setLocation(val);
                      setCoordinates(null);
                    }}
                    coordinates={coordinates}
                    onCoordinatesChange={setCoordinates}
                    placeholder="Enter your city"
                    maxSuggestions={8}
                  />


                </div>

                <div className="payment-buttons">
              <button 
                    className="pay-btn" 
                    onClick={() => {
                      requestCurrentLocation();
                      setShowQR(true);
                    }}
                    disabled={false}
                  >
                    Pay Now
                  </button>
                  <button className="close-btn" onClick={() => {
                    setShowPayment(false);
                    setSelectedService(null);
                    setLocation("");
                    setShowQR(false);
                  }}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="payment-qr">
                  <img 
src={"/scanner.jpeg"}
                    alt="Scanner / QR for Payment" 

                    style={{ 
                      maxWidth: '300px', 
                      width: '100%',
                      borderRadius: '8px',
                      border: '2px solid #f0f0f0'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = document.getElementById('qr-fallback');
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none', textAlign: 'center', padding: '20px' }}>
                    <p>QR Code not found. Please add qr-code.png to public folder.</p>
                  </div>
                </div>
                <p style={{ color: '#666', margin: '10px 0', textAlign: 'center' }}>
                  Scan the QR code with any UPI app to complete payment
                </p>
                <div className="payment-buttons">
                  {paymentBusy || paymentStatus === "pending" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#f59e0b", fontWeight: 700 }}>
                      ⏳ Waiting for Payment...
                    </div>
                  ) : null}

                  {paymentStatus === "paid" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#16a34a", fontWeight: 700 }}>
                      ✅ Payment Done
                    </div>
                  ) : null}

                  {bookingStatus === "waiting_provider" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#f59e0b", fontWeight: 700 }}>
                      ⏳ Waiting for Provider Acceptance
                    </div>
                  ) : null}

                  {bookingStatus === "confirmed" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#16a34a", fontWeight: 700 }}>
                      ✅ Booking Confirmed
                    </div>
                  ) : null}

                  {bookingStatus === "confirmed" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#16a34a", fontWeight: 700 }}>
                      ✅ Provider Accepted Your Booking
                    </div>
                  ) : null}



                  {paymentStatus === "failed" ? (
                    <div style={{ width: "100%", padding: "10px 0", color: "#dc2626", fontWeight: 700 }}>
                      ❌ Payment Failed
                    </div>
                  ) : null}

                  {paymentStatus !== "pending" ? (
                    <button className="close-btn" onClick={() => setShowQR(false)}>
                      Close
                    </button>
                  ) : (
                    <button className="close-btn" onClick={() => setShowQR(false)}>
                      Back
                    </button>
                  )}
                </div>

                  {paymentStatus === "paid" && bookingStatus === "waiting_provider" ? (
                    <p style={{ color: "#f59e0b", marginTop: 10, fontWeight: 700 }}>Waiting for Provider Acceptance</p>
                  ) : null}

                  {paymentStatus === "paid" && bookingStatus === "confirmed" ? (
                    <p style={{ color: "#16a34a", marginTop: 10, fontWeight: 700 }}>Provider Accepted Your Booking</p>
                  ) : null}


                {paymentStatus === "failed" ? (
                  <p style={{ color: "#dc2626", marginTop: 10, fontWeight: 700 }}>Booking Failed</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
