import { Request, Response } from "express";
import { User } from "../types";
import { serializeUser } from "./serialize-user";

export function me(req: Request, res: Response) {
	console.log("User in me route:", (req as any).user);
	const user = (req as any).user as User;
	res.json({
		user: serializeUser(user),
	});
}
