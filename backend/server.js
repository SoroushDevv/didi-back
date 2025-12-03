const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Routers
const productsRouter = require("./routes/productsRoutes");
const commentsRouter = require("./routes/commentsRoutes");
const usersRouter = require("./routes/usersRoutes");
const ordersRouter = require("./routes/ordersRoutes");
const offsRouter = require("./routes/offsRoutes");
const adminsRouter = require("./routes/adminsRoutes");
const addressesRouter = require("./routes/addressesRoutes");
const categoriesRouter = require("./routes/categoriesRoutes");
const bankCardsRouter = require("./routes/bankCardsRoutes");
const profilePicRouter = require("./routes/profilePicRoutes");
const blogsRouter = require("./routes/blogsRoutes");

const app = express();
const server = http.createServer(app);

// ----------------- CORS Setup -----------------
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://didikalashop-frontend.vercel.app"
  ],
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight requests

// ----------------- Middlewares -----------------
app.use(express.json());

app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  next();
});

// ----------------- Socket.IO -----------------
const io = new Server(server, {
  cors: corsOptions
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.set("io", io);

// ----------------- Routes -----------------
app.use("/products", productsRouter);
app.use("/blogs", blogsRouter);
app.use("/comments", commentsRouter);
app.use("/users", usersRouter);
app.use("/orders", ordersRouter);
app.use("/offs", offsRouter);
app.use("/admins", adminsRouter);
app.use("/addresses", addressesRouter);
app.use("/categories", categoriesRouter);
app.use("/cards", bankCardsRouter);
app.use("/profilePics", profilePicRouter);

// ----------------- 404 Handler -----------------
app.use((req, res) => {
  res.status(404).send({ message: "Route not found" });
});

// ----------------- Error Handler -----------------
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

// ----------------- Start Server -----------------
const port = process.env.PORT || 8000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
