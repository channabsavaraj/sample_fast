import React, { useState, useEffect } from 'react';
import paymentService from '../services/paymentService';
import './PaymentPopup.css';

const PaymentPopup = ({ paymentData, onClose, onSuccess }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePayNow = () => {
    if (!window.Razorpay) {
      alert('Razorpay SDK not loaded');
      return;
    }

    setProcessing(true);

    const options = {
      key: process.env.REACT_APP_RAZORPAY_KEY_ID,
      amount: paymentData.amount * 100, // Amount in paise
      currency: paymentData.currency,
      order_id: paymentData.orderId,
      handler: async (response) => {
        try {
          // Verify payment with backend
          const verifyResponse = await paymentService.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            bookingId: paymentData.bookingId
          });

          if (verifyResponse.success) {
            onSuccess(verifyResponse.booking);
          }
        } catch (error) {
          console.error('Payment verification error:', error);
          
          // Record payment failure
          await paymentService.handlePaymentFailure(paymentData.bookingId);
          
          alert(error.message || 'Payment verification failed');
          onClose();
        } finally {
          setProcessing(false);
        }
      },
      modal: {
        ondismiss: async () => {
          setProcessing(false);
          
          // Record payment failure
          await paymentService.handlePaymentFailure(paymentData.bookingId);
          
          alert('Payment cancelled');
          onClose();
        }
      },
      theme: {
        color: '#007bff'
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <div className="payment-popup-overlay">
      <div className="payment-popup">
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="payment-content">
          <h2>Complete Your Payment</h2>
          
          <div className="payment-details">
            <div className="detail-row">
              <span>Amount</span>
              <strong>₹{paymentData.amount}</strong>
            </div>
            <div className="detail-row">
              <span>Order ID</span>
              <code>{paymentData.orderId}</code>
            </div>
          </div>

          <button
            className="btn-pay-now"
            onClick={handlePayNow}
            disabled={processing}
          >
            {processing ? 'Processing...' : 'Pay Now with Razorpay'}
          </button>

          <p className="payment-info">
            Click "Pay Now" to open the Razorpay payment gateway. You can pay using credit/debit cards, UPI, or net banking.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentPopup;
