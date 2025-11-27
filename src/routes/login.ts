import { Request, Response } from "express";
import crypto from "crypto";
import { sessions } from "../store";
import { findUserByEmail } from "../models/user";
import { serializeUser } from "./serialize-user";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email + password required" });

  try {
    const user = await findUserByEmail(email);
    if (!user || user.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = crypto.randomUUID();
    sessions[token] = user.id;

    res.json({
      message: "Login OK",
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("Failed to login user", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
