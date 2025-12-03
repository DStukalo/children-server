import { Request, Response } from "express";
import crypto from "crypto";
import {
  createPayment as createPaymentInDb,
  findPaymentById,
  findPaymentByOrderId,
  updatePaymentStatus,
  updatePaymentStatusByOrderId,
  Payment,
} from "../models/payment";
import { User } from "../types";

const WEBPAY_STORE_ID = process.env.WEBPAY_STORE_ID || "";
const WEBPAY_SECRET_KEY = process.env.WEBPAY_SECRET_KEY || "";
const WEBPAY_URL = process.env.WEBPAY_API_URL?.includes("sandbox") 
  ? "https://securesandbox.webpay.by/" 
  : "https://payment.webpay.by/";

function sha1hex(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function generateWebPaySignature(wsbSeed: string, wsbStoreId: string, wsbOrderNum: string, wsbTest: string, wsbCurrencyId: string, wsbTotal: string, secretKey: string): string {
  const signatureString = wsbSeed + wsbStoreId + wsbOrderNum + wsbTest + wsbCurrencyId + wsbTotal + secretKey;
  console.log(`[Signature] String: ${signatureString}`);
  const signature = sha1hex(signatureString).toLowerCase();
  console.log(`[Signature] SHA1: ${signature}`);
  return signature;
}

export async function createPayment(req: Request, res: Response) {
  const { amount, currency = "BYN", description, orderId, courseId, stageId } = req.body;
  const currentUser = (req as any).user as User | undefined;

  if (amount === undefined || amount === null || !description || !orderId) {
    return res.status(400).json({ 
      message: "Amount, description and orderId are required" 
    });
  }

  if (!WEBPAY_STORE_ID || !WEBPAY_SECRET_KEY) {
    return res.status(500).json({ 
      message: "WebPay credentials not configured" 
    });
  }

  try {
    const paymentId = crypto.randomUUID();
    const baseUrl = process.env.PRODUCTION_URL || (req.protocol + "://" + req.get("host"));
    
    const wsbSeed = Date.now().toString();
    const wsbTest = process.env.WEBPAY_API_URL?.includes("sandbox") ? "1" : "0";
    const wsbTotal = amount.toFixed(2);
    
    const wsbSignature = generateWebPaySignature(
      wsbSeed,
      WEBPAY_STORE_ID,
      orderId,
      wsbTest,
      currency,
      wsbTotal,
      WEBPAY_SECRET_KEY
    );

    // Save to PostgreSQL
    await createPaymentInDb({
      id: paymentId,
      order_id: orderId,
      user_id: currentUser?.id,
      amount,
      currency,
      description: description.substring(0, 255),
      course_id: courseId,
      stage_id: stageId,
      wsb_seed: wsbSeed,
      wsb_test: wsbTest,
      wsb_signature: wsbSignature,
    });

    const formUrl = `${baseUrl}/api/payment/form/${paymentId}`;
    
    console.log(`[Payment] Created payment ${paymentId}`);
    console.log(`[Payment] Form URL: ${formUrl}`);
    console.log(`[Payment] Order: ${orderId}, Amount: ${wsbTotal} ${currency}`);

    res.json({
      success: true,
      paymentId,
      paymentUrl: formUrl,
      message: "Payment form URL generated"
    });
  } catch (error: any) {
    console.error("[Payment] Failed to create payment", error);
    res.status(500).json({ 
      message: error.message || "Internal server error"
    });
  }
}

export async function servePaymentForm(req: Request, res: Response) {
  const { paymentId } = req.params;
  
  const payment = await findPaymentById(paymentId);
  if (!payment) {
    return res.status(404).send("Payment not found");
  }

  const baseUrl = process.env.PRODUCTION_URL || (req.protocol + "://" + req.get("host"));
  const returnUrl = `${baseUrl}/api/payment/success?paymentId=${paymentId}`;
  const cancelUrl = `${baseUrl}/api/payment/cancel?paymentId=${paymentId}`;
  const notifyUrl = `${baseUrl}/api/payment/callback`;

  console.log(`[Payment Form] Serving form for payment ${paymentId}`);
  console.log(`[Payment Form] WebPay URL: ${WEBPAY_URL}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Переход к оплате...</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Переход к оплате...</p>
  </div>
  
  <form id="webpayForm" action="${WEBPAY_URL}" method="post">
    <input type="hidden" name="*scart" value="">
    <input type="hidden" name="wsb_version" value="2">
    <input type="hidden" name="wsb_language_id" value="russian">
    <input type="hidden" name="wsb_storeid" value="${WEBPAY_STORE_ID}">
    <input type="hidden" name="wsb_order_num" value="${payment.order_id}">
    <input type="hidden" name="wsb_test" value="${payment.wsb_test}">
    <input type="hidden" name="wsb_currency_id" value="${payment.currency}">
    <input type="hidden" name="wsb_seed" value="${payment.wsb_seed}">
    <input type="hidden" name="wsb_invoice_item_name[0]" value="${payment.description}">
    <input type="hidden" name="wsb_invoice_item_quantity[0]" value="1">
    <input type="hidden" name="wsb_invoice_item_price[0]" value="${Number(payment.amount).toFixed(2)}">
    <input type="hidden" name="wsb_total" value="${Number(payment.amount).toFixed(2)}">
    <input type="hidden" name="wsb_signature" value="${payment.wsb_signature}">
    <input type="hidden" name="wsb_return_url" value="${returnUrl}">
    <input type="hidden" name="wsb_cancel_return_url" value="${cancelUrl}">
    <input type="hidden" name="wsb_notify_url" value="${notifyUrl}">
  </form>
  
  <script>
    document.getElementById('webpayForm').submit();
  </script>
</body>
</html>
  `;

  res.send(html);
}

export async function checkPaymentStatus(req: Request, res: Response) {
  const { paymentId } = req.params;

  if (!paymentId) {
    return res.status(400).json({ message: "Payment ID is required" });
  }

  try {
    const payment = await findPaymentById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    
    res.json({
      success: true,
      paymentId,
      status: payment.status,
      message: `Payment ${payment.status}`
    });
  } catch (error) {
    console.error("Failed to check payment status", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function paymentCallback(req: Request, res: Response) {
  const callbackData = req.body;
  
  try {
    const { wsb_order_num, wsb_tid, wsb_payment_type, batch_timestamp, currency_id, amount, payment_method, payment_type, rrn, wsb_signature } = callbackData;
    
    console.log("[Callback] Received:", JSON.stringify(callbackData, null, 2));
    
    if (!wsb_order_num) {
      return res.status(400).json({ message: "Order number is required" });
    }

    const payment = await updatePaymentStatusByOrderId(wsb_order_num, "success");
    
    if (payment) {
      console.log(`[Callback] Payment ${payment.id} marked as success`);
    } else {
      console.log(`[Callback] Payment not found for order ${wsb_order_num}`);
    }
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Failed to process payment callback", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function handlePaymentSuccess(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  console.log(`[Success] Payment ${paymentId} success page`);
  
  if (paymentId) {
    await updatePaymentStatus(paymentId as string, "success");
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата успешна</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      text-align: center; 
      padding: 40px 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      min-height: 100vh;
      box-sizing: border-box;
      margin: 0;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 400px;
      margin: 0 auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .success { font-size: 80px; margin-bottom: 20px; }
    h1 { color: #10B981; margin: 0 0 15px; font-size: 28px; }
    p { color: #6B7280; margin: 0 0 20px; font-size: 16px; line-height: 1.5; }
    .btn {
      display: block;
      background: #10B981;
      color: white;
      padding: 18px 40px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 18px;
      border: none;
      cursor: pointer;
      margin: 10px 0;
    }
    .btn:active { background: #059669; }
    .btn-secondary {
      background: #6B7280;
      font-size: 14px;
      padding: 12px 30px;
    }
    .btn-secondary:active { background: #4B5563; }
    .hint { color: #9CA3AF; font-size: 13px; margin-top: 25px; line-height: 1.6; }
    .hint-box {
      background: #F3F4F6;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✅</div>
    <h1>Оплата успешна!</h1>
    <p>Спасибо за покупку! Ваш доступ активирован.</p>
    <a class="btn" href="childapp://payment-success?paymentId=${paymentId}" id="returnBtn">Вернуться в приложение</a>
    <div class="hint-box">
      <p class="hint" style="margin:0">
        Если кнопка не работает, просто закройте это окно.<br>
        Покупка уже сохранена в вашем аккаунте.
      </p>
    </div>
  </div>
  <script>
    var redirectAttempted = false;
    
    // Try auto-redirect after 1.5s
    setTimeout(function() {
      if (!redirectAttempted) {
        redirectAttempted = true;
        window.location.href = 'childapp://payment-success?paymentId=${paymentId}';
      }
    }, 1500);
    
    // Send message to WebView (for React Native)
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment-success',
        paymentId: '${paymentId}'
      }));
    }
  </script>
</body>
</html>
  `;

  res.send(html);
}

export async function handlePaymentCancel(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  console.log(`[Cancel] Payment ${paymentId} cancelled`);
  
  if (paymentId) {
    await updatePaymentStatus(paymentId as string, "failed");
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата отменена</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      text-align: center; 
      padding: 40px 20px;
      background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
      min-height: 100vh;
      box-sizing: border-box;
      margin: 0;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 400px;
      margin: 0 auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .fail { font-size: 80px; margin-bottom: 20px; }
    h1 { color: #EF4444; margin: 0 0 15px; font-size: 28px; }
    p { color: #6B7280; margin: 0 0 20px; font-size: 16px; line-height: 1.5; }
    .btn {
      display: block;
      background: #EF4444;
      color: white;
      padding: 18px 40px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 18px;
      border: none;
      cursor: pointer;
      margin: 10px 0;
    }
    .btn:active { background: #DC2626; }
    .hint { color: #9CA3AF; font-size: 13px; margin-top: 25px; line-height: 1.6; }
    .hint-box {
      background: #F3F4F6;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="fail">❌</div>
    <h1>Оплата отменена</h1>
    <p>Платеж не был завершен. Вы можете вернуться в приложение и попробовать снова.</p>
    <a class="btn" href="childapp://payment-cancel?paymentId=${paymentId}">Вернуться в приложение</a>
    <div class="hint-box">
      <p class="hint" style="margin:0">
        Если кнопка не работает, просто закройте это окно.
      </p>
    </div>
  </div>
  <script>
    var redirectAttempted = false;
    
    setTimeout(function() {
      if (!redirectAttempted) {
        redirectAttempted = true;
        window.location.href = 'childapp://payment-cancel?paymentId=${paymentId}';
      }
    }, 1500);
    
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment-failed',
        paymentId: '${paymentId}'
      }));
    }
  </script>
</body>
</html>
  `;

  res.send(html);
}
