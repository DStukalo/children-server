import { Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";

const WEBPAY_STORE_ID = process.env.WEBPAY_STORE_ID || "";
const WEBPAY_SECRET_KEY = process.env.WEBPAY_SECRET_KEY || "";
const WEBPAY_API_URL = process.env.WEBPAY_API_URL || "https://securesandbox.webpay.by";
const WEBPAY_API_ENDPOINT = `${WEBPAY_API_URL}/api/v1/payment`;

const payments = new Map<string, {
  paymentId: string;
  orderId: string;
  amount: number;
  status: "pending" | "success" | "failed";
  courseId?: number;
  stageId?: number;
  createdAt: Date;
}>();

function generateWebPaySignature(params: Record<string, any>, secretKey: string): string {
  const signatureOrder = [
    "wsb_seed",
    "wsb_storeid",
    "wsb_order_num",
    "wsb_test",
    "wsb_currency_id",
    "wsb_total"
  ];
  
  const signatureParts: string[] = [];
  
  for (const key of signatureOrder) {
    if (params[key] !== undefined && params[key] !== null) {
      signatureParts.push(`${key}=${params[key]}`);
    }
  }
  
  const signatureString = signatureParts.join("&") + "&" + secretKey;
  console.log(`[Signature] Full string: ${signatureString}`);
  return crypto.createHash("sha1").update(signatureString).digest("hex").toUpperCase();
}

export async function createPayment(req: Request, res: Response) {
  const { amount, currency = "BYN", description, orderId, courseId, stageId } = req.body;

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
    const wsbOrderNum = orderId;
    const wsbCurrencyId = currency;
    const wsbTotal = amount % 1 === 0 ? amount : parseFloat(amount.toFixed(2));
    const wsbTest = WEBPAY_API_URL.includes("sandbox") ? 1 : 0;
    const wsbReturnUrl = `${baseUrl}/api/payment/success?paymentId=${paymentId}`;
    const wsbCancelReturnUrl = `${baseUrl}/api/payment/cancel?paymentId=${paymentId}`;
    const wsbNotifyUrl = `${baseUrl}/api/payment/callback`;

    const itemName = description.substring(0, 255);
    const itemQuantity = 1;
    const itemPrice = wsbTotal;

    const webpayParams: Record<string, any> = {
      wsb_version: 2,
      wsb_storeid: WEBPAY_STORE_ID,
      wsb_seed: wsbSeed,
      wsb_test: wsbTest,
      wsb_order_num: wsbOrderNum,
      wsb_currency_id: wsbCurrencyId,
      wsb_invoice_item_name: [itemName],
      wsb_invoice_item_quantity: [itemQuantity],
      wsb_invoice_item_price: [itemPrice],
      wsb_total: wsbTotal,
      wsb_return_url: wsbReturnUrl,
      wsb_cancel_return_url: wsbCancelReturnUrl,
      wsb_notify_url: wsbNotifyUrl,
      wsb_redirect: 1,
      wsb_return_format: "json",
      wsb_language_id: "russian",
    };

    const wsbSignature = generateWebPaySignature(webpayParams, WEBPAY_SECRET_KEY);
    webpayParams.wsb_signature = wsbSignature;

    console.log(`[Payment API] Creating payment: ${paymentId}, Order: ${wsbOrderNum}, Amount: ${wsbTotal}`);
    console.log(`[Payment API] Calling WebPay API: ${WEBPAY_API_ENDPOINT}`);

    payments.set(paymentId, {
      paymentId,
      orderId,
      amount,
      status: "pending",
      courseId,
      stageId,
      createdAt: new Date(),
    });

    console.log(`[Payment API] Sending request to WebPay API: ${WEBPAY_API_ENDPOINT}`);
    console.log(`[Payment API] Request params:`, JSON.stringify(webpayParams, null, 2));

    const webpayResponse = await axios.post(WEBPAY_API_ENDPOINT, webpayParams, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 30000,
    });

    console.log(`[Payment API] WebPay response status: ${webpayResponse.status}`);
    console.log(`[Payment API] WebPay response headers:`, JSON.stringify(webpayResponse.headers, null, 2));
    console.log(`[Payment API] WebPay response data:`, JSON.stringify(webpayResponse.data, null, 2));

    let redirectUrl = null;

    if (webpayResponse.status === 200) {
      if (webpayResponse.data && typeof webpayResponse.data === "object") {
        if (webpayResponse.data.redirectUrl) {
          redirectUrl = webpayResponse.data.redirectUrl;
        } else if (webpayResponse.data.url) {
          redirectUrl = webpayResponse.data.url;
        } else if (webpayResponse.data.paymentUrl) {
          redirectUrl = webpayResponse.data.paymentUrl;
        }
      }
      
      if (!redirectUrl && webpayResponse.headers.location) {
        redirectUrl = webpayResponse.headers.location;
      }
    } else if (webpayResponse.status >= 300 && webpayResponse.status < 400) {
      redirectUrl = webpayResponse.headers.location || webpayResponse.headers.Location;
    }

    if (!redirectUrl) {
      console.error("[Payment API] No redirect URL in response");
      console.error("[Payment API] Full response:", {
        status: webpayResponse.status,
        statusText: webpayResponse.statusText,
        data: webpayResponse.data,
        headers: webpayResponse.headers
      });
      
      if (webpayResponse.status >= 400) {
        return res.status(500).json({ 
          message: `WebPay API error: ${webpayResponse.status} ${webpayResponse.statusText}`,
          details: webpayResponse.data || "No error details provided"
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to get payment URL from WebPay",
        status: webpayResponse.status,
        data: webpayResponse.data,
        headers: webpayResponse.headers
      });
    }

    console.log(`[Payment API] ✅ Redirect URL received: ${redirectUrl}`);

    res.json({
      success: true,
      paymentId,
      paymentUrl: redirectUrl,
      message: "Payment URL generated"
    });
  } catch (error: any) {
    console.error("[Payment API] Failed to create payment", error);
    if (error.response) {
      console.error("[Payment API] WebPay error response:", error.response.data);
      return res.status(500).json({ 
        message: "WebPay API error",
        details: error.response.data 
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function checkPaymentStatus(req: Request, res: Response) {
  const { paymentId } = req.params;

  if (!paymentId) {
    return res.status(400).json({ message: "Payment ID is required" });
  }

  try {
    const payment = payments.get(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    
    res.json({
      success: true,
      paymentId,
      status: payment.status,
      message: `Payment ${payment.status} (test mode)`
    });
  } catch (error) {
    console.error("Failed to check payment status", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function paymentCallback(req: Request, res: Response) {
  const callbackData = req.body;
  
  try {
    const { wsb_order_num, wsb_tid, wsb_status } = callbackData;
    
    if (!wsb_order_num) {
      return res.status(400).json({ message: "Order number is required" });
    }

    const payment = Array.from(payments.values()).find(p => p.orderId === wsb_order_num);
    
    if (payment) {
      if (wsb_status === "success" || wsb_status === "approved") {
        payment.status = "success";
      } else {
        payment.status = "failed";
      }
      payments.set(payment.paymentId, payment);
    }
    
    console.log("WebPay callback received:", { wsb_order_num, wsb_tid, wsb_status });
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Failed to process payment callback", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function handlePaymentSuccess(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  const payment = payments.get(paymentId as string);
  if (payment) {
    payment.status = "success";
    payments.set(paymentId as string, payment);
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата успешна</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
    .success { color: #10B981; font-size: 48px; }
    h1 { color: #10B981; }
  </style>
</head>
<body>
  <div class="success">✅</div>
  <h1>Оплата успешна!</h1>
  <p>Вы будете перенаправлены обратно в приложение.</p>
  <script>
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment-success',
        paymentId: '${paymentId}'
      }));
    }
    setTimeout(() => {
      window.location.href = 'app://payment-success?paymentId=${paymentId}';
    }, 1000);
  </script>
</body>
</html>
  `;

  res.send(html);
}

export async function handlePaymentCancel(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  const payment = payments.get(paymentId as string);
  if (payment) {
    payment.status = "failed";
    payments.set(paymentId as string, payment);
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата отменена</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
    .fail { color: #EF4444; font-size: 48px; }
    h1 { color: #EF4444; }
  </style>
</head>
<body>
  <div class="fail">❌</div>
  <h1>Оплата отменена</h1>
  <p>Вы будете перенаправлены обратно в приложение.</p>
  <script>
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment-failed',
        paymentId: '${paymentId}'
      }));
    }
    setTimeout(() => {
      window.location.href = 'app://payment-fail?paymentId=${paymentId}';
    }, 1000);
  </script>
</body>
</html>
  `;

  res.send(html);
}

export function createTestPaymentPage(req: Request, res: Response) {
  const { paymentId } = req.params;
  const { amount, orderId } = req.query;

  const payment = payments.get(paymentId);
  if (!payment) {
    return res.status(404).send("Payment not found");
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Тестовая оплата</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #2563EB; }
    .info { margin: 20px 0; }
    .button {
      background: #10B981;
      color: white;
      padding: 15px 30px;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      width: 100%;
      margin: 10px 0;
    }
    .button:hover { background: #059669; }
    .button.fail {
      background: #EF4444;
    }
    .button.fail:hover { background: #DC2626; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Тестовая страница оплаты</h1>
    <div class="info">
      <p><strong>Сумма:</strong> ${amount} BYN</p>
      <p><strong>Номер заказа:</strong> ${orderId}</p>
      <p><strong>ID платежа:</strong> ${paymentId}</p>
    </div>
    <p>Это тестовая страница для проверки интеграции платежей.</p>
    <p>Нажмите кнопку ниже, чтобы эмулировать успешную или неуспешную оплату:</p>
    <button class="button" onclick="simulatePayment('success')">
      ✅ Симулировать успешную оплату
    </button>
    <button class="button fail" onclick="simulatePayment('fail')">
      ❌ Симулировать неуспешную оплату
    </button>
  </div>
  <script>
    function simulatePayment(status) {
      const baseUrl = window.location.origin;
      const redirectUrl = status === 'success' 
        ? baseUrl + '/test-payment-success?paymentId=${paymentId}'
        : baseUrl + '/test-payment-fail?paymentId=${paymentId}';
      
      window.location.href = redirectUrl;
    }
  </script>
</body>
</html>
  `;

  res.send(html);
}

export function handleTestPaymentSuccess(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  const payment = payments.get(paymentId as string);
  if (payment) {
    payment.status = "success";
    payments.set(paymentId as string, payment);
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
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
      text-align: center;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .success { color: #10B981; font-size: 48px; }
    h1 { color: #10B981; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✅</div>
    <h1>Оплата успешна!</h1>
    <p>Платеж обработан. Вы можете закрыть это окно.</p>
  </div>
  <script>
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

export function handleTestPaymentFail(req: Request, res: Response) {
  const { paymentId } = req.query;
  
  const payment = payments.get(paymentId as string);
  if (payment) {
    payment.status = "failed";
    payments.set(paymentId as string, payment);
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата не прошла</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
      text-align: center;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .fail { color: #EF4444; font-size: 48px; }
    h1 { color: #EF4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="fail">❌</div>
    <h1>Оплата не прошла</h1>
    <p>Платеж не был обработан. Вы можете закрыть это окно и попробовать снова.</p>
  </div>
  <script>
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

