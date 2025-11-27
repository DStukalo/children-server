import { query } from "../db";
import { User } from "../types";

interface UserRow {
  id: string;
  email: string;
  password: string;
  user_name: string | null;
  avatar: string | null;
  open_categories: (number | string)[] | null;
  purchased_stages: (number | string)[] | null;
  created_at: string;
}

function mapUser(row: UserRow): User {
  const toNumberArray = (value: (number | string)[] | null): number[] => {
    if (!value) return [];
    return value.map((item) => (typeof item === "number" ? item : Number(item)));
  };

  return {
    id: row.id,
    email: row.email,
    password: row.password,
    user_name: row.user_name,
    avatar: row.avatar,
    open_categories: toNumberArray(row.open_categories),
    purchased_stages: toNumberArray(row.purchased_stages),
    created_at: new Date(row.created_at).toISOString()
  };
}

export interface UpdateUserFields {
  user_name?: string | null;
  avatar?: string | null;
  open_categories?: number[];
  purchased_stages?: number[];
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  if (result.rowCount === 0) return null;
  return mapUser(result.rows[0]);
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  if (result.rowCount === 0) return null;
  return mapUser(result.rows[0]);
}

export async function insertUser(user: User): Promise<void> {
  await query(
    `
      INSERT INTO users (id, email, password, user_name, avatar, open_categories, purchased_stages, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      user.id,
      user.email,
      user.password,
      user.user_name,
      user.avatar,
      user.open_categories,
      user.purchased_stages,
      user.created_at
    ]
  );
}

export async function updateUserById(id: string, updates: UpdateUserFields): Promise<User | null> {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return findUserById(id);
  }

  const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  const result = await query<UserRow>(
    `UPDATE users SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  if (result.rowCount === 0) return null;
  return mapUser(result.rows[0]);
}
