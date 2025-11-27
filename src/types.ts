export interface User {
  id: string;
  email: string;
  password: string;
  user_name: string | null;
  avatar: string | null;
  open_categories: number[];
  purchased_stages: number[];
  created_at: string;
}
