const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = 123;
const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: 'Test' })
}).then(res => res.json()).then(console.log).catch(console.error);
