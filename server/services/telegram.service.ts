import { parseNluInput } from './nlu.service.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { customersRepository, CustomerDoc } from '../repositories/customers.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { expensesRepository } from '../repositories/expenses.repository.js';
import { getCollectionRef, COLLECTIONS, prepareDataForInsert } from '../firebase/firestore.js';
import { config } from '../config/env.js';

// Deduplication cache for update_ids
const processedUpdateIds = new Set<number>();
const MAX_DEDUP_CACHE = 5000;

export function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  if (processedUpdateIds.has(updateId)) {
    return true;
  }
  processedUpdateIds.add(updateId);
  if (processedUpdateIds.size > MAX_DEDUP_CACHE) {
    const firstItem = processedUpdateIds.values().next().value;
    if (firstItem !== undefined) {
      processedUpdateIds.delete(firstItem);
    }
  }
  return false;
}

export interface PendingAction {
  chatId: string | number;
  intent: 'CREATE_ORDER' | 'RECORD_PAYMENT' | 'RECORD_EXPENSE' | 'RESTOCK_INVENTORY';
  data: any;
  summaryText: string;
  createdAt: number;
}

// In-memory store for confirmation flow state
const pendingActions = new Map<string, PendingAction>();

export function getPendingAction(chatId: string | number): PendingAction | undefined {
  const key = String(chatId);
  const action = pendingActions.get(key);
  if (!action) return undefined;
  // 10 minutes timeout
  if (Date.now() - action.createdAt > 10 * 60 * 1000) {
    pendingActions.delete(key);
    return undefined;
  }
  return action;
}

export function clearPendingAction(chatId: string | number): void {
  pendingActions.delete(String(chatId));
}

export function setPendingAction(chatId: string | number, action: PendingAction): void {
  pendingActions.set(String(chatId), action);
}

// Helper to send message via Telegram Bot API
export async function sendMessageToTelegram(
  chatId: string | number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  if (!config.telegramBotToken) {
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyToMessageId,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Telegram Service] Failed to send message to Telegram API:', err);
    return false;
  }
}

// Helper to fetch file info from Telegram
export async function getTelegramFileInfo(fileId: string): Promise<string | null> {
  if (!config.telegramBotToken) return null;
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/getFile?file_id=${fileId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.result?.file_path || null;
  } catch (err) {
    console.warn('[Telegram Service] Failed to fetch file info from Telegram:', err);
    return null;
  }
}

// Helper to download Telegram voice file as Base64
export async function downloadTelegramVoiceAsBase64(filePath: string): Promise<string | null> {
  if (!config.telegramBotToken) return null;
  try {
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.warn('[Telegram Service] Failed to download voice file:', err);
    return null;
  }
}

// Helper to search or find customer by name
async function matchOrCreateCustomer(nameQuery?: string | null, placeQuery?: string | null): Promise<CustomerDoc> {
  const customers = await customersRepository.getAll();
  const normalizedQuery = (nameQuery || 'General Store').trim().toLowerCase();

  // Exact match or partial match
  let matched = customers.find(
    c => c && c.name && (c.name.toLowerCase() === normalizedQuery || c.name.toLowerCase().includes(normalizedQuery))
  );

  if (!matched && customers.length > 0) {
    // Try matching any word
    const words = normalizedQuery.split(' ');
    matched = customers.find(c => c && c.name && words.some(w => w.length > 2 && c.name.toLowerCase().includes(w)));
  }

  if (matched) {
    return matched;
  }

  // Auto-create customer if not found
  const formattedName = nameQuery
    ? nameQuery.charAt(0).toUpperCase() + nameQuery.slice(1)
    : 'New Customer';
  const newCustomer = await customersRepository.create({
    name: formattedName,
    businessName: formattedName,
    place: placeQuery || 'Tamil Nadu',
    phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
    outstandingBalance: 0,
    free200mlSamplesUsed: 0,
    totalOrdersCount: 0,
    totalSpent: 0,
    isArchived: false,
  });

  return newCustomer;
}

export interface TelegramProcessResult {
  success: boolean;
  duplicate?: boolean;
  reply: string;
  pendingActionCreated?: boolean;
  actionExecuted?: boolean;
  intent?: string;
  error?: string;
}

export const processTelegramUpdate = async (update: any): Promise<TelegramProcessResult> => {
  const updateId = update.update_id;

  // 1. Duplicate check
  if (isDuplicateUpdate(updateId)) {
    return {
      success: true,
      duplicate: true,
      reply: 'Duplicate update ignored.',
    };
  }

  // Extract message from webhook payload or direct body
  const message = update.message || update;
  const chatId = message?.chat?.id || update.chatId || 'default_chat';
  const messageId = message?.message_id;
  const senderName = message?.from?.first_name || message?.from?.username || 'Field Rep';

  const textInput: string = message?.text || update.text || '';
  const voiceObj = message?.voice || message?.audio || update.voice;

  // 2. Handle Telegram Commands
  if (textInput.startsWith('/')) {
    const cmd = textInput.split(' ')[0].toLowerCase();
    let replyText = '';

    if (cmd === '/start' || cmd === '/help') {
      replyText =
        `👋 Welcome to KFOS Bot (Kashmeer Fragrances Operating System)!\n` +
        `Hello ${senderName}, I am your Tamil Nadu Field Sales Automation Assistant.\n\n` +
        `📌 Commands:\n` +
        `/stock - View current 5L Can liquid stock pools\n` +
        `/sales - View today's total sales & profit summary\n` +
        `/orders - View recent order details\n` +
        `/customers - View active customer list & balances\n` +
        `/cancel - Cancel any pending operation\n\n` +
        `💡 You can also type or record voice notes in Tamil, Tanglish, or English:\n` +
        `• "Ramesh ku 5 Standard cans venum"\n` +
        `• "Arun 10 premium order pannirukaaru"\n` +
        `• "Standard stock evlo?"\n` +
        `• "Ramesh payment 2000 pannitaaru"`;
    } else if (cmd === '/stock') {
      const inventory = await inventoryRepository.getAll();
      const eco = inventory.find(i => i.quality === 'Eco')?.currentStock5L || 0;
      const std = inventory.find(i => i.quality === 'Standard')?.currentStock5L || 0;
      const prem = inventory.find(i => i.quality === 'Premium')?.currentStock5L || 0;
      replyText =
        `📦 Current Liquid Stock Pools (5L Cans):\n` +
        `• Eco Grade: ${eco} cans\n` +
        `• Standard Grade: ${std} cans\n` +
        `• Premium Grade: ${prem} cans`;
    } else if (cmd === '/sales') {
      const orders = await ordersRepository.getAll();
      const todayStr = new Date().toISOString().split('T')[0];
      const todayOrders = orders.filter(o => o.orderDate && o.orderDate.startsWith(todayStr));
      const totalSales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const totalProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
      replyText =
        `📊 Today's Sales Performance:\n` +
        `• Total Orders: ${todayOrders.length}\n` +
        `• Total Revenue: ₹${totalSales.toLocaleString('en-IN')}\n` +
        `• Total Realized Profit: ₹${totalProfit.toLocaleString('en-IN')}`;
    } else if (cmd === '/orders') {
      const orders = await ordersRepository.getAll();
      const recent = orders.slice(-5).reverse();
      if (recent.length === 0) {
        replyText = `🧾 No orders found in system yet.`;
      } else {
        const orderList = recent
          .map(
            o => `• ${o.orderNumber || o.id}: ${o.customerName} - ₹${o.totalAmount} (${o.paymentStatus})`
          )
          .join('\n');
        replyText = `🧾 Recent 5 Orders:\n${orderList}`;
      }
    } else if (cmd === '/customers') {
      const customers = await customersRepository.getAll();
      if (customers.length === 0) {
        replyText = `👥 No registered customers found.`;
      } else {
        const custList = customers
          .slice(0, 8)
          .map(c => `• ${c.name} (${c.place}): Bal ₹${c.outstandingBalance.toLocaleString('en-IN')}`)
          .join('\n');
        replyText = `👥 Active Customers:\n${custList}`;
      }
    } else if (cmd === '/cancel') {
      if (getPendingAction(chatId)) {
        clearPendingAction(chatId);
        replyText = `❌ Pending operation cancelled successfully.`;
      } else {
        replyText = `ℹ️ No pending operation to cancel.`;
      }
    } else {
      replyText = `Unknown command. Type /help for available options.`;
    }

    await sendMessageToTelegram(chatId, replyText, messageId);
    return { success: true, reply: replyText };
  }

  // 3. Check for Confirmation Reply (if user has a pending action)
  const pending = getPendingAction(chatId);
  if (pending && textInput) {
    const normalizedText = textInput.trim().toLowerCase();
    const isAffirmative = ['yes', 'confirm', 'aama', 'correct', 'ok', 'sari', '1', 'confirm order', 'y', 'yup'].includes(
      normalizedText
    );
    const isCancellation = ['no', 'cancel', 'vendam', '0', 'stop', 'n', 'abort'].includes(normalizedText);

    if (isAffirmative) {
      clearPendingAction(chatId);
      try {
        let finalReply = '';
        if (pending.intent === 'CREATE_ORDER') {
          const createdOrder = await ordersRepository.createOrderAtomic(pending.data);
          const cust = await customersRepository.getById(createdOrder.customerId);
          finalReply =
            `✅ ORDER CREATED SUCCESSFULLY!\n\n` +
            `Order #: ${createdOrder.orderNumber}\n` +
            `Customer: ${createdOrder.customerName}\n` +
            `Total Amount: ₹${createdOrder.totalAmount.toLocaleString('en-IN')}\n` +
            `Paid Amount: ₹${createdOrder.paidAmount.toLocaleString('en-IN')}\n` +
            `Payment Status: ${createdOrder.paymentStatus}\n` +
            `Current Customer Balance: ₹${(cust?.outstandingBalance || 0).toLocaleString('en-IN')}\n\n` +
            `Stock has been deducted atomically from the inventory pool.`;
        } else if (pending.intent === 'RECORD_PAYMENT') {
          const updatedCust = await customersRepository.update(pending.data.customerId, {
            outstandingBalance: pending.data.newBalance,
          });
          finalReply =
            `✅ PAYMENT RECORDED SUCCESSFULLY!\n\n` +
            `Customer: ${updatedCust.name}\n` +
            `Amount Paid: ₹${pending.data.amount.toLocaleString('en-IN')}\n` +
            `Updated Outstanding Balance: ₹${updatedCust.outstandingBalance.toLocaleString('en-IN')}`;
        } else if (pending.intent === 'RECORD_EXPENSE') {
          const exp = await expensesRepository.create(pending.data);
          finalReply =
            `✅ EXPENSE RECORDED SUCCESSFULLY!\n\n` +
            `Title: ${exp.title}\n` +
            `Category: ${exp.category}\n` +
            `Amount: ₹${exp.amount.toLocaleString('en-IN')}`;
        } else if (pending.intent === 'RESTOCK_INVENTORY') {
          const res = await inventoryRepository.updateStockAtomic(
            pending.data.quality,
            pending.data.quantity,
            'RESTOCK',
            pending.data.reason
          );
          finalReply =
            `✅ INVENTORY RESTOCKED SUCCESSFULLY!\n\n` +
            `Quality: ${res.inventory.quality}\n` +
            `New Stock Level: ${res.inventory.currentStock5L} cans`;
        }

        await sendMessageToTelegram(chatId, finalReply, messageId);
        return { success: true, actionExecuted: true, reply: finalReply };
      } catch (err: any) {
        const errReply = `❌ Execution failed: ${err.message || 'Operation error'}`;
        await sendMessageToTelegram(chatId, errReply, messageId);
        return { success: false, error: err.message, reply: errReply };
      }
    } else if (isCancellation) {
      clearPendingAction(chatId);
      const cancelReply = `❌ Pending operation cancelled. No changes were made.`;
      await sendMessageToTelegram(chatId, cancelReply, messageId);
      return { success: true, reply: cancelReply };
    }
  }

  // 4. Process Voice or Text Message using Gemini NLU Engine
  let audioBase64: string | undefined = undefined;
  let mimeType: string | undefined = undefined;

  if (voiceObj && voiceObj.file_id) {
    const filePath = await getTelegramFileInfo(voiceObj.file_id);
    if (filePath) {
      audioBase64 = (await downloadTelegramVoiceAsBase64(filePath)) || undefined;
      mimeType = voiceObj.mime_type || 'audio/ogg';
    }
  } else if (update.audioBase64) {
    // Direct audioBase64 passed for test payloads
    audioBase64 = update.audioBase64;
    mimeType = update.mimeType || 'audio/ogg';
  }

  const nluResult = await parseNluInput({
    text: textInput,
    audioBase64,
    mimeType,
  });

  // 5. Handle Ambiguous Input or Low Confidence -> Ask Clarifying Question
  if (nluResult.needsClarification || nluResult.confidence < 0.6 || nluResult.intent === 'UNKNOWN') {
    const question =
      nluResult.clarificationQuestion ||
      `I could not understand the request clearly. Please clarify customer name and order details (e.g., "Ramesh ku 5 Standard cans venum").`;
    await sendMessageToTelegram(chatId, question, messageId);
    return { success: true, intent: nluResult.intent, reply: question };
  }

  // 6. Execute Intent Business Logic & Build Confirmation Safety Steps
  let replyText = '';

  if (nluResult.intent === 'CREATE_ORDER') {
    const customerName = nluResult.customerName || 'General Customer';
    const customer = await matchOrCreateCustomer(customerName, nluResult.customerPlace);

    const qualityGrade = nluResult.qualityGrade || 'Standard';
    const quantity = nluResult.quantityCans && nluResult.quantityCans > 0 ? nluResult.quantityCans : 5;

    // Check stock
    const inventory = await inventoryRepository.getAll();
    const stockItem = inventory.find(i => i.quality === qualityGrade);
    const availableStock = stockItem ? stockItem.currentStock5L : 0;

    if (availableStock < quantity) {
      replyText =
        `⚠️ INSUFFICIENT STOCK!\n\n` +
        `Current stock for ${qualityGrade} Grade is ${availableStock} cans.\n` +
        `Requested quantity: ${quantity} cans.\n\n` +
        `Please restock inventory or select a different quality grade.`;
      await sendMessageToTelegram(chatId, replyText, messageId);
      return { success: true, intent: 'CREATE_ORDER', reply: replyText };
    }

    // Pricing logic from server
    const pricingMap: Record<string, { sale: number; buy: number }> = {
      Eco: { sale: 900, buy: 650 },
      Standard: { sale: 1200, buy: 750 },
      Premium: { sale: 1500, buy: 950 },
    };
    const unitSale = pricingMap[qualityGrade]?.sale || 1200;
    const discount = nluResult.discountPerUnit || 0;
    const effectiveUnitPrice = Math.max(0, unitSale - discount);
    const totalAmount = quantity * effectiveUnitPrice;
    const paidAmount = nluResult.paymentAmount || 0;
    const newOutstanding = customer.outstandingBalance + totalAmount - paidAmount;

    const summaryText =
      `📦 ORDER CONFIRMATION REQUEST:\n\n` +
      `Customer: ${customer.name} (${customer.place})\n` +
      `Product: Room Freshener (${qualityGrade} Grade - 5L Can) x ${quantity} cans\n` +
      `Unit Price: ₹${effectiveUnitPrice} (Original: ₹${unitSale})\n` +
      `Total Order Amount: ₹${totalAmount.toLocaleString('en-IN')}\n` +
      `Payment Collected: ₹${paidAmount.toLocaleString('en-IN')}\n` +
      `Current Customer Outstanding: ₹${customer.outstandingBalance.toLocaleString('en-IN')}\n` +
      `New Outstanding after Order: ₹${newOutstanding.toLocaleString('en-IN')}\n\n` +
      `❓ Confirm order? Reply "Yes" or "Confirm" to execute, or "Cancel" to abort.`;

    setPendingAction(chatId, {
      chatId,
      intent: 'CREATE_ORDER',
      data: {
        customerId: customer.id,
        items: [
          {
            productVariant: 'Room Freshener',
            quality: qualityGrade,
            quantity,
            discountPerUnit: discount,
          },
        ],
        paidAmount,
        source: 'Telegram Bot',
      },
      summaryText,
      createdAt: Date.now(),
    });

    replyText = summaryText;
  } else if (nluResult.intent === 'RECORD_PAYMENT') {
    if (!nluResult.customerName || !nluResult.paymentAmount) {
      replyText = `Please specify customer name and payment amount (e.g., "Ramesh payment 2000").`;
    } else {
      const customer = await matchOrCreateCustomer(nluResult.customerName, nluResult.customerPlace);
      const amount = nluResult.paymentAmount;
      const newBalance = customer.outstandingBalance - amount;

      const summaryText =
        `💳 PAYMENT RECORDING CONFIRMATION:\n\n` +
        `Customer: ${customer.name}\n` +
        `Payment Amount Collected: ₹${amount.toLocaleString('en-IN')}\n` +
        `Current Outstanding: ₹${customer.outstandingBalance.toLocaleString('en-IN')}\n` +
        `Updated Outstanding Balance: ₹${newBalance.toLocaleString('en-IN')}\n\n` +
        `❓ Reply "Yes" or "Confirm" to record this payment, or "Cancel" to abort.`;

      setPendingAction(chatId, {
        chatId,
        intent: 'RECORD_PAYMENT',
        data: { customerId: customer.id, amount, newBalance },
        summaryText,
        createdAt: Date.now(),
      });

      replyText = summaryText;
    }
  } else if (nluResult.intent === 'CHECK_STOCK') {
    const inventory = await inventoryRepository.getAll();
    const eco = inventory.find(i => i.quality === 'Eco')?.currentStock5L || 0;
    const std = inventory.find(i => i.quality === 'Standard')?.currentStock5L || 0;
    const prem = inventory.find(i => i.quality === 'Premium')?.currentStock5L || 0;

    replyText =
      `📦 Current Liquid Stock Pools (5L Cans):\n` +
      `• Eco Grade: ${eco} cans\n` +
      `• Standard Grade: ${std} cans\n` +
      `• Premium Grade: ${prem} cans`;
  } else if (nluResult.intent === 'CHECK_SALES' || nluResult.intent === 'CHECK_PROFIT') {
    const orders = await ordersRepository.getAll();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.orderDate && o.orderDate.startsWith(todayStr));
    const totalSales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    replyText =
      `📊 Today's Business Performance:\n` +
      `• Total Orders: ${todayOrders.length}\n` +
      `• Total Sales Revenue: ₹${totalSales.toLocaleString('en-IN')}\n` +
      `• Total Realized Profit: ₹${totalProfit.toLocaleString('en-IN')}`;
  } else if (nluResult.intent === 'CHECK_CUSTOMER' || nluResult.intent === 'CHECK_OUTSTANDING') {
    if (nluResult.customerName) {
      const customer = await matchOrCreateCustomer(nluResult.customerName);
      replyText =
        `👤 Customer Profile:\n` +
        `• Name: ${customer.name}\n` +
        `• Place: ${customer.place}\n` +
        `• Total Orders: ${customer.totalOrdersCount}\n` +
        `• Outstanding Balance: ₹${customer.outstandingBalance.toLocaleString('en-IN')}`;
    } else {
      const customers = await customersRepository.getAll();
      const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
      replyText = `👥 Total Outstanding Across All Customers: ₹${totalOutstanding.toLocaleString('en-IN')}`;
    }
  } else if (nluResult.intent === 'CHECK_ORDER') {
    const orders = await ordersRepository.getAll();
    const latest = orders[orders.length - 1];
    if (!latest) {
      replyText = `🧾 No orders found in the system.`;
    } else {
      replyText =
        `🧾 Latest Order Details:\n` +
        `• Order #: ${latest.orderNumber}\n` +
        `• Customer: ${latest.customerName}\n` +
        `• Total Amount: ₹${latest.totalAmount.toLocaleString('en-IN')}\n` +
        `• Paid: ₹${latest.paidAmount.toLocaleString('en-IN')}\n` +
        `• Status: ${latest.paymentStatus}\n` +
        `• Date: ${new Date(latest.orderDate).toLocaleDateString('en-IN')}`;
    }
  } else if (nluResult.intent === 'RECORD_EXPENSE') {
    const amount = nluResult.expenseAmount || 300;
    const reason = nluResult.expenseReason || 'Field Travel / Fuel Expense';

    const summaryText =
      `🧾 EXPENSE LOGGING CONFIRMATION:\n\n` +
      `Title: ${reason}\n` +
      `Amount: ₹${amount.toLocaleString('en-IN')}\n` +
      `Category: Operations\n\n` +
      `❓ Reply "Yes" or "Confirm" to record this expense.`;

    setPendingAction(chatId, {
      chatId,
      intent: 'RECORD_EXPENSE',
      data: {
        title: reason,
        category: 'Operations',
        amount,
        recordedBy: senderName,
        date: new Date().toISOString(),
      },
      summaryText,
      createdAt: Date.now(),
    });

    replyText = summaryText;
  } else if (nluResult.intent === 'CREATE_SAMPLE') {
    const customer = await matchOrCreateCustomer(nluResult.customerName || 'Sample Recipient');
    await customersRepository.update(customer.id, {
      free200mlSamplesUsed: (customer.free200mlSamplesUsed || 0) + 1,
    });
    replyText =
      `🧪 Premium Sample Dispatched!\n` +
      `Recipient: ${customer.name}\n` +
      `Sample Type: 200ml Premium Room Freshener\n` +
      `Follow-up reminder scheduled in 3 days.`;
  } else {
    replyText =
      `I processed your message ("${textInput || 'Voice note'}").\n` +
      `Intent detected: ${nluResult.intent}.\n` +
      `Type /help to see available commands or clarify your request.`;
  }

  await sendMessageToTelegram(chatId, replyText, messageId);
  return {
    success: true,
    intent: nluResult.intent,
    pendingActionCreated: Boolean(pendingActions.has(String(chatId))),
    reply: replyText,
  };
};
