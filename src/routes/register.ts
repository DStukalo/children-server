import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../types";
import { findUserByEmail, insertUser } from "../models/user";
import { serializeUser } from "./serialize-user";
import { sessions } from "../store";

export async function register(req: Request, res: Response) {
	const { email, password } = req.body;

	if (!email || !password) {
		return res.status(400).json({ message: "Email + password required" });
	}

	try {
		const existing = await findUserByEmail(email);
		if (existing) {
			return res.status(409).json({ message: "User exists" });
		}

		const now = new Date().toISOString();

		const user: User = {
			id: crypto.randomUUID(),
			email,
			password,
			user_name: "John Doe",
			avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
			open_categories: [],
			purchased_stages: [],
			created_at: now,
		};

		console.log("Creating user:", user);

		await insertUser(user);

		const token = crypto.randomUUID();
		sessions[token] = user.id;

		res.json({
			message: "Registered",
			token,
			user: serializeUser(user),
		});
	} catch (error) {
		console.error("Failed to register user", error);
		res.status(500).json({
			message: "Internal server error",
			error: String(error),
		});
	}
}
