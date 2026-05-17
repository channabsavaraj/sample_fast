import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import paymentService from '../services/paymentService';
import PaymentPopup from './PaymentPopup';
import PaymentSuccess from './PaymentSuccess';
import './BookingPayment.css';

const BookingPayment = ({ bookingId, bookingDetails }) => {
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [successBooking, setSuccessBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePayNow = async () => {
    setLoading(true);
    setError(null);

    try {
      const orderResponse = await paymentService.createOrder(bookingId);

      if (orderResponse.success) {
        setPaymentData({
          bookingId: orderResponse.bookingId,
          orderId: orderResponse.orderId,
          amount: orderResponse.amount,
          currency: orderResponse.currency
        });
        setShowPayment(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to create payment order');
      console.error('Error creating order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (booking) => {
    setSuccessBooking(booking);
    setShowPayment(false);
  };

  const handlePaymentClose = () => {
    setShowPayment(false);
  };

  if (successBooking) {
    return <PaymentSuccess bookingId={bookingId} />;
  }

  return (
    <div className="booking-payment-container">
      <div className="payment-card">
        <h2>Complete Your Booking</h2>

        {error && <div className="error-message">{error}</div>}

        {bookingDetails && (
          <div className="booking-details">
            <div className="detail-item">
              <label>Service Name:</label>
              <value>{bookingDetails.serviceName}</value>
            </div>
            <div className="detail-item">
              <label>Location:</label>
              <value>{bookingDetails.customerLocation || bookingDetails.location}</value>
            </div>
            <div className="detail-item">
              <label>Booking Amount:</label>
              <value>₹150</value>
            </div>
          </div>
        )}

        <div className="payment-info-box">
          <h3>Payment Information</h3>
          <ul>
            <li>✓ Fixed advance booking fee: <strong>₹150</strong></li>
            <li>✓ Secure payment gateway with Razorpay</li>
            <li>✓ Payment must be completed to confirm booking</li>
            <li>✓ Your request will be sent to available providers</li>
          </ul>
        </div>

        <button
          className="btn-pay-now"
          onClick={handlePayNow}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Proceed to Payment'}
        </button>

        <button
          className="btn-cancel"
          onClick={() => navigate(-1)}
          disabled={loading}
        >
          Cancel
        </button>
      </div>

      {showPayment && paymentData && (
        <PaymentPopup
          paymentData={paymentData}
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default BookingPayment;
