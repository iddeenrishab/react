const functions = require("firebase-functions");
const {Server} = require("socket.io");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Create a Socket.IO server
const io = new Server({
  cors: {
    origin: "*", // Allow connections from any origin (adjust if needed)
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"], // Add any custom headers you need
    credentials: true, // Allow credentials (cookies, authorization headers)
  },
});

// Maps to store email-socketId and socketId-email associations
const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();

// Handle new socket connections
io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // Handle room joining
  socket.on("room:join", (data) => {
    const {email, room} = data;
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);
    io.to(room).emit("user:joined", {email, id: socket.id});
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  // Handle user call requests
  socket.on("user:call", ({to, offer}) => {
    io.to(to).emit("incomming:call", {from: socket.id, offer});
  });

  // Handle call acceptance
  socket.on("call:accepted", ({to, ans}) => {
    io.to(to).emit("call:accepted", {from: socket.id, ans});
  });

  // Handle peer negotiation requests
  socket.on("peer:nego:needed", ({to, offer}) => {
    io.to(to).emit("peer:nego:needed", {from: socket.id, offer});
  });

  // Handle peer negotiation completion
  socket.on("peer:nego:done", ({to, ans}) => {
    io.to(to).emit("peer:nego:final", {from: socket.id, ans});
  });

  // Handle socket disconnection
  socket.on("disconnect", () => {
    const email = socketIdToEmailMap.get(socket.id);
    if (email) {
      emailToSocketIdMap.delete(email);
      socketIdToEmailMap.delete(socket.id);
    }
    console.log(`Socket Disconnected: ${socket.id}`);
  });
});

// Export the Firebase function
exports.webRTCServer = functions.https.onRequest((req, res) => {
  // Start the Socket.IO server
  io.listen(functions.config().socket.port || 8000);

  // Respond to the HTTP request (optional)
  res.send("WebRTC server is running!");
});

// import io from 'socket.io-client';

// const socket = io('https://YOUR_FIREBASE_FUNCTION_URL', {
//   transports: ['websocket'], // Use WebSockets for better performance
// });
