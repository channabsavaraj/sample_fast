const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

connectDB();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));


const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*"}});
require("./socket/socketHandler")(io);
require("./utils/socketEmitters").setIO(io);


server.listen(5000, ()=>console.log("Backend running"));
