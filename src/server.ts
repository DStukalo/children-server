import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { register } from "./routes/register";
import { login } from "./routes/login";
import { me } from "./routes/me";
import { auth } from "./middleware/auth";
import { initDb } from "./db";
import { updateUser } from "./routes/update-user";
import { 
  createPayment, 
  checkPaymentStatus, 
  paymentCallback,
  handlePaymentSuccess,
  handlePaymentCancel,
  createPaymentForm,
  createTestPaymentPage,
  handleTestPaymentSuccess,
  handleTestPaymentFail
} from "./routes/payment";

const app = express();

const allowedOrigins = process.env.NODE_ENV === "production"
  ? ['*']
  : ['http://localhost:3000', 'http://10.0.2.2:54322', 'http://127.0.0.1:54322'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(bodyParser.json());

app.post("/register", register);
app.post("/login", login);
app.get("/me", auth, me);
app.patch("/me", auth, updateUser);

app.post("/api/payment/create", auth, createPayment);
app.get("/api/payment/status/:paymentId", auth, checkPaymentStatus);
app.post("/api/payment/callback", paymentCallback);
app.get("/api/payment/form/:paymentId", createPaymentForm);
app.get("/api/payment/success", handlePaymentSuccess);
app.get("/api/payment/cancel", handlePaymentCancel);

app.get("/test-payment/:paymentId", createTestPaymentPage);
app.get("/test-payment-success", handleTestPaymentSuccess);
app.get("/test-payment-fail", handleTestPaymentFail);

const port = Number(process.env.PORT ?? 4000);

initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${port}`));
  })
  .catch(err => {
    console.error("Failed to connect to Postgres", err);
    process.exit(1);
  });
