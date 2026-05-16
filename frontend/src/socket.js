import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

// Handle connection events
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});

export default socket;
