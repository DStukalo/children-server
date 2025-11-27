import { User } from "../types";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    password: user.password,
    userName: user.user_name,
    avatar: user.avatar,
    openCategories: user.open_categories,
    purchasedStages: user.purchased_stages,
    createdAt: user.created_at
  };
}
