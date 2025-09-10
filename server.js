const express = require("express");
const app = express();
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const peerServer = ExpressPeerServer(server, { debug: true });

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.render("landing");
});

// Optional: keep /landing route as alias
app.get("/landing", (req, res) => {
  res.render("landing");
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);

    // ✅ Notify others in the room
    socket.to(roomId).emit("user-connected", userId);

    // ✅ Handle messages inside the room
    socket.on("message", (message) => {
      io.to(roomId).emit("createMessage", message);
    });

    // ✅ Notify others when user disconnects
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

server.listen(3030, () => {
  console.log("Server running on http://localhost:3030");
});
