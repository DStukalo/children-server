import { Request, Response, NextFunction } from "express";
import { sessions } from "../store";
import { findUserById } from "../models/user";

export async function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Missing auth header" });

  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token)
    return res.status(401).json({ message: "Bad auth header" });

  const userId = sessions[token];
  if (!userId) return res.status(401).json({ message: "Invalid token" });

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Failed to load user", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
