import { Request, Response } from "express";
import { UpdateUserFields, updateUserById } from "../models/user";
import { User } from "../types";
import { serializeUser } from "./serialize-user";

export async function updateUser(req: Request, res: Response) {
  const currentUser = (req as any).user as User | undefined;
  if (!currentUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userName, avatar, openCategories, purchasedStages } = req.body ?? {};
  const updates: UpdateUserFields = {};

  if (userName !== undefined) {
    if (userName !== null && typeof userName !== "string") {
      return res.status(400).json({ message: "userName must be a string or null" });
    }
    updates.user_name = userName;
  }

  if (avatar !== undefined) {
    if (avatar !== null && typeof avatar !== "string") {
      return res.status(400).json({ message: "avatar must be a string or null" });
    }
    updates.avatar = avatar;
  }

  if (openCategories !== undefined) {
    const parsed = parseNumberArray(openCategories);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    updates.open_categories = parsed.value;
  }

  if (purchasedStages !== undefined) {
    const parsed = parseNumberArray(purchasedStages);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    updates.purchased_stages = parsed.value;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No updateable fields provided" });
  }

  try {
    const updated = await updateUserById(currentUser.id, updates);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    (req as any).user = updated;

    res.json({
      message: "User updated",
      user: serializeUser(updated)
    });
  } catch (error) {
    console.error("Failed to update user", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

function parseNumberArray(value: unknown): { ok: true; value: number[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: "Expected an array of numbers" };
  }

  const numbers: number[] = [];

  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) {
      numbers.push(item);
      continue;
    }

    if (typeof item === "string" && item.trim() !== "") {
      const parsed = Number(item);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        numbers.push(parsed);
        continue;
      }
    }

    return { ok: false, message: "Array values must be numbers" };
  }

  return { ok: true, value: numbers };
}
