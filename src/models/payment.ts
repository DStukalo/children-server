import { query } from "../db";

export interface Payment {
  id: string;
  order_id: string;
  user_id?: string;
  amount: number;
  currency: string;
  description: string;
  status: "pending" | "success" | "failed";
  course_id?: number;
  stage_id?: number;
  wsb_seed: string;
  wsb_test: string;
  wsb_signature: string;
  created_at: string;
  updated_at: string;
}

export type CreatePaymentData = {
  id: string;
  order_id: string;
  user_id?: string;
  amount: number;
  currency: string;
  description: string;
  course_id?: number;
  stage_id?: number;
  wsb_seed: string;
  wsb_test: string;
  wsb_signature: string;
};

export async function createPayment(data: CreatePaymentData): Promise<Payment> {
  const result = await query<Payment>(
    `INSERT INTO payments (id, order_id, user_id, amount, currency, description, course_id, stage_id, wsb_seed, wsb_test, wsb_signature)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.id,
      data.order_id,
      data.user_id || null,
      data.amount,
      data.currency,
      data.description,
      data.course_id || null,
      data.stage_id || null,
      data.wsb_seed,
      data.wsb_test,
      data.wsb_signature,
    ]
  );
  return result.rows[0];
}

export async function findPaymentById(id: string): Promise<Payment | null> {
  const result = await query<Payment>(
    `SELECT * FROM payments WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function findPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const result = await query<Payment>(
    `SELECT * FROM payments WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

export async function updatePaymentStatus(
  id: string,
  status: "pending" | "success" | "failed"
): Promise<Payment | null> {
  const result = await query<Payment>(
    `UPDATE payments SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
}

export async function updatePaymentStatusByOrderId(
  orderId: string,
  status: "pending" | "success" | "failed"
): Promise<Payment | null> {
  const result = await query<Payment>(
    `UPDATE payments SET status = $1, updated_at = now() WHERE order_id = $2 RETURNING *`,
    [status, orderId]
  );
  return result.rows[0] || null;
}

