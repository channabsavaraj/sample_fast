import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import paymentService from '../services/paymentService';
import './PaymentSuccess.css';

const PaymentSuccess = ({ bookingId }) => {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await paymentService.getBooking(bookingId);
        setBooking(response.booking);
      } catch (error) {
        console.error('Error fetching booking:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  if (loading) {
    return <div className="success-container"><p>Loading...</p></div>;
  }

  if (!booking) {
    return <div className="success-container"><p>Booking not found</p></div>;
  }

  return (
    <div className="success-page">
      <div className="success-container">
        <div className="success-icon">✓</div>
        
        <h2>Payment Successful!</h2>
        
        <div className="success-message">
          <p>Your advance booking fee of <strong>₹150</strong> has been received.</p>
          <p>Your booking request has been sent to available providers.</p>
        </div>

        <div className="booking-summary">
          <h3>Booking Details</h3>
          <div className="summary-item">
            <span>Service:</span>
            <strong>{booking.serviceName}</strong>
          </div>
          <div className="summary-item">
            <span>Location:</span>
            <strong>{booking.customerLocation || booking.location}</strong>
          </div>
          <div className="summary-item">
            <span>Amount Paid:</span>
            <strong>₹{booking.amount}</strong>
          </div>
          <div className="summary-item">
            <span>Status:</span>
            <strong className="status-waiting">Waiting for Provider Response</strong>
          </div>
        </div>

        <div className="success-actions">
          <button 
            className="btn-primary" 
            onClick={() => navigate(`/booking/${bookingId}`)}
          >
            View Booking Status
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/bookings')}
          >
            Back to Bookings
          </button>
        </div>

        <p className="success-note">
          💡 We'll notify you once a provider accepts your booking request.
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccess;
