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

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/register", register);
app.post("/login", login);
app.get("/me", auth, me);
app.patch("/me", auth, updateUser);

const port = Number(process.env.PORT ?? 4000);

initDb()
  .then(() => {
    app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  })
  .catch(err => {
    console.error("Failed to connect to Postgres", err);
    process.exit(1);
  });
