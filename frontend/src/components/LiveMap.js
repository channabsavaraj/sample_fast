import { useEffect, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import socket from "../socket";

const defaultCenter = { lat: 19.0760, lng: 72.8777 }; // Mumbai

export default function LiveMap({ providerLocation, providerId }) {
  const [userLocation, setUserLocation] = useState(null);
  const [liveProviderLocation, setLiveProviderLocation] = useState(providerLocation || null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  });

  // Get live user location (watch)
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (err) => {
        console.warn("Geolocation error:", err);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Update from prop when provided
  useEffect(() => {
    if (providerLocation) setLiveProviderLocation(providerLocation);
  }, [providerLocation]);

  // Subscribe to provider location updates from socket
  useEffect(() => {
    const handler = (data) => {
      // data: { providerId, lat, lng }
      if (!providerId || data.providerId === providerId) {
        setLiveProviderLocation({ lat: data.lat, lng: data.lng });
      }
    };

    socket.on("providerLocationUpdate", handler);
    return () => socket.off("providerLocationUpdate", handler);
  }, [providerId]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading maps...</div>;

  const center = userLocation || defaultCenter;

  return (
    <div>
      <GoogleMap
        zoom={15}
        center={center}
        mapContainerStyle={{
          height: "400px",
          width: "100%",
          borderRadius: "12px"
        }}
      >
        {userLocation && <Marker position={userLocation} label="You" />}

        {liveProviderLocation && (
          <Marker position={liveProviderLocation} label="Provider" />
        )}
      </GoogleMap>

      <button
        onClick={() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition((pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          });
        }}
        style={{
          marginTop: "10px",
          padding: "8px 15px",
          borderRadius: "8px",
          background: "#007bff",
          color: "white",
          border: "none"
        }}
      >
        Use My Current Location
      </button>
    </div>
  );
}
