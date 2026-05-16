import { useState, useEffect } from "react";
import api from "../api";

export default function AdminDashboard() {
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [newService, setNewService] = useState({ name: "", category: "", rating: 0 });
  const [activeTab, setActiveTab] = useState("services");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, bookingsRes, usersRes, providersRes] = await Promise.all([
        api.get("/services"),
        api.get("/bookings"),
        api.get("/auth/users"),
        api.get("/auth/providers")
      ]);
      setServices(servicesRes.data);
      setBookings(bookingsRes.data);
      setUsers(usersRes.data);
      setProviders(providersRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await api.post("/services", newService, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Service added successfully!");
      setNewService({ name: "", category: "", rating: 0 });
      loadData();
    } catch (err) {
      alert("Failed to add service");
    }
  };

  const handleDeleteService = async (serviceId) => {
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/services/${serviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Service deleted successfully!");
      loadData();
    } catch (err) {
      alert("Failed to delete service");
    }
  };

  const handleVerifyProvider = async (providerId) => {
    try {
      await api.put(`/auth/verify-provider/${providerId}`, { verified: true });
      alert("Provider verified successfully!");
      loadData();
    } catch (err) {
      alert("Failed to verify provider");
    }
  };

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
        <h1 className="dashboard-title">Admin Dashboard ⚙️</h1>
        <p className="dashboard-subtitle">Manage your platform</p>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === "services" ? "active" : ""}`}
            onClick={() => setActiveTab("services")}
          >
            🛠️ Services
          </button>
          <button 
            className={`tab ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            📋 Bookings
          </button>
          <button 
            className={`tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Users
          </button>
          <button 
            className={`tab ${activeTab === "providers" ? "active" : ""}`}
            onClick={() => setActiveTab("providers")}
          >
            🔧 Providers
          </button>
        </div>

        {activeTab === "services" && (
          <div className="fade-in">
            <div className="dashboard-form">
              <h3>➕ Add New Service</h3>
              <form onSubmit={handleAddService}>
                <div className="form-row">
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Service Name"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Category"
                      value={newService.category}
                      onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      placeholder="Rating"
                      value={newService.rating}
                      onChange={(e) => setNewService({ ...newService, rating: parseFloat(e.target.value) })}
                      step="0.1"
                      min="0"
                      max="5"
                      className="form-input"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Add Service
                  </button>
                </div>
              </form>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Rating</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service._id}>
                      <td>{service.name}</td>
                      <td>{service.category}</td>
                      <td>
                        <span className="rating-star">⭐</span> {service.rating}
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteService(service._id)}
                          className="btn btn-danger btn-small"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "bookings" && (
          <div className="table-container fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking._id}>
                    <td>{booking.serviceName}</td>
                    <td>{booking.location}</td>
                    <td>
                      <span className={`status-badge status-${booking.status}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${booking.paymentStatus}`}>
                        {booking.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "users" && (
          <div className="table-container fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`status-badge ${user.role === 'admin' ? 'status-accepted' : user.role === 'provider' ? 'status-pending' : ''}`}>
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "providers" && (
          <div className="table-container fade-in">
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Verified</th>
                  <th>Documents</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider._id}>
                    <td>{provider.userId}</td>
                    <td>
                      {provider.verified ? 
                        <span className="status-badge status-accepted">✅ Verified</span> : 
                        <span className="status-badge status-pending">❌ Not Verified</span>
                      }
                    </td>
                    <td>
                      <small>
                        Aadhar: {provider.documents?.aadhar || "N/A"}<br/>
                        PAN: {provider.documents?.pan || "N/A"}
                      </small>
                    </td>
                    <td>
                      {!provider.verified && (
                        <button 
                          onClick={() => handleVerifyProvider(provider._id)}
                          className="btn btn-success btn-small"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
