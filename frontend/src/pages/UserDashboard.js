import { useEffect, useState } from "react";
import api from "../api";
import socket from "../socket";
import paymentService from "../services/paymentService";
import PaymentPopup from "../components/PaymentPopup";
import PaymentSuccess from "../components/PaymentSuccess";
import CityLocationInput from "../components/CityLocationInput";
import "./UserDashboard.css";

export default function UserDashboard() {

  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  
  // Razorpay Payment States
  const [showRazorpayPopup, setShowRazorpayPopup] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [successBookingId, setSuccessBookingId] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

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
    setShowPaymentModal(true);
    setPaymentError("");
  };

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
        setLocation(`${lat}, ${lng}`);

        try {
          await api.put("/auth/update-location", { latitude: lat, longitude: lng, address: "" });
        } catch (e) {
          console.warn("Failed to save user location:", e?.response?.data || e.message || e);
        }
      },
      (err) => {
        console.warn("Geolocation error:", err);
        alert("Location permission denied / unavailable. Please choose location from suggestions.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Razorpay Payment Flow
  const startRazorpayPayment = async () => {
    if (!coordinates) {
      setPaymentError("Please select/allow location first");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      // Create booking first
      const bookingData = {
        userId: user?.id,
        serviceName: selectedService.name,
        location: location,
        coordinates: coordinates,
        status: "pending",
        paymentStatus: "pending"
      };

      const bookingResponse = await api.post("/bookings/book", bookingData);
      const bookingId = bookingResponse?.data?.bookingId;

      if (!bookingId) {
        throw new Error("Failed to create booking");
      }

      // Create Razorpay order
      const orderResponse = await paymentService.createOrder(bookingId);

      if (orderResponse.success) {
        setPaymentData({
          bookingId: orderResponse.bookingId,
          orderId: orderResponse.orderId,
          amount: orderResponse.amount,
          currency: orderResponse.currency
        });
        setShowRazorpayPopup(true);
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to initiate payment');
      console.error('Payment error:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = (booking) => {
    setSuccessBookingId(booking._id);
    setShowPaymentModal(false);
    setShowRazorpayPopup(false);
    setTimeout(() => loadBookings(), 500);
  };

  const handlePaymentClose = () => {
    setShowRazorpayPopup(false);
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

  const cancelBooking = async (bookingId) => {
    try {
      await api.post(`/bookings/status/${bookingId}`, { status: "cancelled" });
      loadBookings();
    } catch (err) {
      console.error("Error cancelling booking:", err);
    }
  };

  // Show payment success page
  if (successBookingId) {
    return <PaymentSuccess bookingId={successBookingId} />;
  }

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
                  <p>💰 Payment: <strong>{booking.paymentStatus}</strong></p>
                  <p>📊 Status: <strong>{booking.bookingStatus}</strong></p>
                </div>
                <div className="booking-actions">
                  <span className={`status-badge status-${booking.bookingStatus}`}>
                    {booking.bookingStatus}
                  </span>
                  {booking.bookingStatus === "pending_payment" && (
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
      {showPaymentModal && selectedService && (
        <div className="payment-modal">
          <div className="payment-content">
            <button 
              className="modal-close"
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedService(null);
                setLocation("");
                setCoordinates(null);
                setPaymentError("");
              }}
            >
              ✕
            </button>

            <h3>Book: {selectedService?.name}</h3>
            
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

            {/* Booking Amount Info */}
            <div className="booking-amount-box">
              <h4>Advance Booking Fee</h4>
              <div className="amount-display">₹150</div>
              <p>Fixed advance payment to confirm your booking</p>
            </div>

            {paymentError && (
              <div className="error-message">{paymentError}</div>
            )}

            <div className="payment-buttons">
              <button 
                className="pay-btn" 
                onClick={startRazorpayPayment}
                disabled={paymentLoading || !coordinates}
              >
                {paymentLoading ? 'Processing...' : 'Pay ₹150 & Book'}
              </button>
              <button 
                className="close-btn" 
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedService(null);
                  setLocation("");
                  setCoordinates(null);
                  setPaymentError("");
                }}
              >
                Cancel
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'center' }}>
              💳 Secure payment with Razorpay
            </p>
          </div>
        </div>
      )}

      {/* Razorpay Payment Popup */}
      {showRazorpayPopup && paymentData && (
        <PaymentPopup
          paymentData={paymentData}
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
        />
      )}

    </div>
  );
}
