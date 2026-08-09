import { parseNluInput } from './nlu.service.js';
import { ordersRepository } from '../repositories/orders.repository.js';
import { customersRepository, CustomerDoc } from '../repositories/customers.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { expensesRepository } from '../repositories/expenses.repository.js';
import { genericRepository } from '../repositories/generic.repository.js';
import { firestoreDb, COLLECTIONS } from '../firebase/firestore.js';
import { config } from '../config/env.js';
import { PRICING_MATRIX, QualityGrade } from '../../src/types/kfos.js';

// India Timezone Date Helper (Asia/Kolkata)
export function getIndiaDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

// 1. Persistent Idempotency in Firestore (telegramProcessedUpdates)
export async function isDuplicateUpdatePersistent(updateId?: number): Promise<boolean> {
  if (!updateId) return false;
  const docId = `update_${updateId}`;
  const docRef = firestoreDb.collection('telegramProcessedUpdates').doc(docId);

  return await firestoreDb.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (doc.exists) {
      return true; // Duplicate detected
    }
    tx.set(docRef, {
      updateId,
      processedAt: new Date().toISOString(),
    });
    return false; // First time
  });
}

// Synchronous stub for test interface compatibility
export function isDuplicateUpdate(updateId?: number): boolean {
  return false;
}

// 2. Persistent Confirmation State in Firestore (telegramPendingActions)
export interface PendingActionDoc {
  chatId: string;
  telegramUserId?: string;
  intent: 'CREATE_ORDER' | 'RECORD_PAYMENT' | 'RECORD_EXPENSE' | 'RESTOCK_INVENTORY' | 'CREATE_CUSTOMER';
  data: any;
  summaryText: string;
  createdAt: string;
  expiresAt: number;
  status: 'pending' | 'processing' | 'executed' | 'cancelled' | 'expired' | 'failed';
  claimedAt?: string;
  claimedBy?: string;
  executedAt?: string;
  failedAt?: string;
  lastError?: string;
}

export interface PendingAction {
  chatId: string | number;
  intent: 'CREATE_ORDER' | 'RECORD_PAYMENT' | 'RECORD_EXPENSE' | 'RESTOCK_INVENTORY' | 'CREATE_CUSTOMER';
  data: any;
  summaryText: string;
  createdAt: number;
}

// User-Safe Document ID Generator
export function getPendingDocId(chatId: string | number, telegramUserId?: string | number): string {
  if (telegramUserId) {
    return `chat_${chatId}_user_${telegramUserId}`;
  }
  return `chat_${chatId}`;
}

export async function getPendingActionPersistent(
  chatId: string | number,
  telegramUserId?: string | number
): Promise<(PendingActionDoc & { docId: string }) | null> {
  const primaryId = getPendingDocId(chatId, telegramUserId);
  let doc = await firestoreDb.collection('telegramPendingActions').doc(primaryId).get();
  let docId = primaryId;

  if (!doc.exists && telegramUserId) {
    // Fallback to chat-only ID if primary not found
    const fallbackId = `chat_${chatId}`;
    const fbDoc = await firestoreDb.collection('telegramPendingActions').doc(fallbackId).get();
    if (fbDoc.exists) {
      doc = fbDoc;
      docId = fallbackId;
    }
  }

  if (!doc.exists) return null;
  const data = doc.data() as PendingActionDoc;
  if (data.status !== 'pending') return null;

  if (Date.now() > data.expiresAt) {
    await firestoreDb.collection('telegramPendingActions').doc(docId).update({ status: 'expired' });
    return null;
  }

  // Security check: User isolation verification
  if (data.telegramUserId && telegramUserId && data.telegramUserId !== String(telegramUserId)) {
    console.warn(`[Security] Telegram user ${telegramUserId} attempted to view pending action owned by ${data.telegramUserId}`);
    return null;
  }

  return { ...data, docId };
}

export async function setPendingActionPersistent(
  chatId: string | number,
  telegramUserId: string | number | undefined,
  action: {
    intent: PendingActionDoc['intent'];
    data: any;
    summaryText: string;
  }
): Promise<void> {
  const docId = getPendingDocId(chatId, telegramUserId);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
  await firestoreDb.collection('telegramPendingActions').doc(docId).set({
    chatId: String(chatId),
    telegramUserId: telegramUserId ? String(telegramUserId) : undefined,
    intent: action.intent,
    data: action.data,
    summaryText: action.summaryText,
    createdAt: new Date().toISOString(),
    expiresAt,
    status: 'pending',
  });
}

export async function clearPendingActionPersistent(
  chatId: string | number,
  telegramUserId?: string | number,
  status: 'executed' | 'cancelled' | 'failed' = 'cancelled'
): Promise<void> {
  const primaryId = getPendingDocId(chatId, telegramUserId);
  const docRef = firestoreDb.collection('telegramPendingActions').doc(primaryId);
  const snap = await docRef.get();
  
  if (snap.exists) {
    await docRef.set({ status, updatedAt: new Date().toISOString() }, { merge: true });
  } else {
    const fallbackRef = firestoreDb.collection('telegramPendingActions').doc(`chat_${chatId}`);
    await fallbackRef.set({ status, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

// Atomic Claim & Execution Flow
export async function claimAndExecutePendingActionAtomic(
  chatId: string | number,
  telegramUserId: string | number | undefined,
  executor: (action: PendingActionDoc, docId: string) => Promise<string>
): Promise<{ success: boolean; reply: string }> {
  const primaryId = getPendingDocId(chatId, telegramUserId);
  let targetDocId = primaryId;
  let claimedAction: PendingActionDoc | null = null;

  // Step 1: Claim pending action atomically inside Firestore transaction
  try {
    claimedAction = await firestoreDb.runTransaction(async (tx) => {
      let docRef = firestoreDb.collection('telegramPendingActions').doc(primaryId);
      let snap = await tx.get(docRef);

      if (!snap.exists && telegramUserId) {
        const fallbackRef = firestoreDb.collection('telegramPendingActions').doc(`chat_${chatId}`);
        const fbSnap = await tx.get(fallbackRef);
        if (fbSnap.exists) {
          snap = fbSnap;
          docRef = fallbackRef;
          targetDocId = `chat_${chatId}`;
        }
      }

      if (!snap.exists) {
        throw new Error('No pending action found to execute.');
      }

      const data = snap.data() as PendingActionDoc;
      if (data.status !== 'pending') {
        throw new Error(`Action is no longer pending (current status: ${data.status}).`);
      }

      if (Date.now() > data.expiresAt) {
        tx.update(docRef, { status: 'expired' });
        throw new Error('Action confirmation request has expired.');
      }

      if (data.telegramUserId && telegramUserId && data.telegramUserId !== String(telegramUserId)) {
        throw new Error('Unauthorized: This action was requested by a different user.');
      }

      // Atomically claim the pending action
      tx.update(docRef, {
        status: 'processing',
        claimedAt: new Date().toISOString(),
        claimedBy: telegramUserId ? String(telegramUserId) : 'unknown',
      });

      return data;
    });
  } catch (err: any) {
    return { success: false, reply: `⚠️ ${err.message || 'Action execution failed.'}` };
  }

  // Step 2: Execute actual business operation
  try {
    const replyText = await executor(claimedAction, targetDocId);

    // Step 3: Mark executed upon success
    await firestoreDb.collection('telegramPendingActions').doc(targetDocId).set(
      { status: 'executed', executedAt: new Date().toISOString() },
      { merge: true }
    );

    return { success: true, reply: replyText };
  } catch (err: any) {
    console.error('[Telegram Action Execution Error]', err);
    // Step 4: Mark failed on error so state is preserved safely
    await firestoreDb.collection('telegramPendingActions').doc(targetDocId).set(
      { status: 'failed', lastError: err.message || 'Execution error', failedAt: new Date().toISOString() },
      { merge: true }
    );

    return { success: false, reply: `❌ Execution failed: ${err.message || 'Operation error'}` };
  }
}

// Helper stubs for backwards compatibility
export function getPendingAction(chatId: string | number): PendingAction | undefined {
  return undefined;
}
export function clearPendingAction(chatId: string | number): void {}
export function setPendingAction(chatId: string | number, action: PendingAction): void {}

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
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Telegram API Error: ${res.status} - ${errorText}`);
    }
    return true;
  } catch (err) {
    console.warn('[Telegram Service] Failed to send message to Telegram API:', err);
    throw err;
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

// 3. Safe Customer Search (No Automatic Customer Creation)
export interface CustomerMatchResult {
  status: 'EXACT' | 'MULTIPLE' | 'NOT_FOUND';
  customer?: CustomerDoc;
  matches?: CustomerDoc[];
  queriedName?: string;
}

export async function matchCustomerSafe(nameQuery?: string | null): Promise<CustomerMatchResult> {
  if (!nameQuery || !nameQuery.trim()) {
    return { status: 'NOT_FOUND', queriedName: nameQuery || '' };
  }

  const customers = await customersRepository.getAll();
  const activeCustomers = customers.filter(c => c && !c.isArchived);
  const normalized = nameQuery.trim().toLowerCase();

  // 1. Exact match on name or businessName
  const exactMatches = activeCustomers.filter(
    c => (c.name && c.name.toLowerCase() === normalized) || (c.businessName && c.businessName.toLowerCase() === normalized)
  );

  if (exactMatches.length === 1) {
    return { status: 'EXACT', customer: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { status: 'MULTIPLE', matches: exactMatches };
  }

  // 2. Partial match (contains string)
  const partialMatches = activeCustomers.filter(
    c => (c.name && c.name.toLowerCase().includes(normalized)) || (c.businessName && c.businessName.toLowerCase().includes(normalized))
  );

  if (partialMatches.length === 1) {
    return { status: 'EXACT', customer: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { status: 'MULTIPLE', matches: partialMatches };
  }

  // 3. Word-based partial match
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const wordMatches = activeCustomers.filter(c =>
      c.name && words.some(w => c.name.toLowerCase().includes(w))
    );
    if (wordMatches.length === 1) {
      return { status: 'EXACT', customer: wordMatches[0] };
    }
    if (wordMatches.length > 1) {
      return { status: 'MULTIPLE', matches: wordMatches };
    }
  }

  return { status: 'NOT_FOUND', queriedName: nameQuery };
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
  try {
    const updateId = update.update_id;

    // 1. Persistent Idempotency Check
    if (updateId) {
      const isDup = await isDuplicateUpdatePersistent(updateId);
      if (isDup) {
        return {
          success: true,
          duplicate: true,
          reply: 'Duplicate update ignored.',
        };
      }
    }

    // Extract message from webhook payload robustly
    const payload = update.message || update.callback_query?.message || update.edited_message || update.channel_post || update;
    const chatId = payload?.chat?.id || update.chatId;

    if (!chatId) {
      console.warn('[Telegram Service] Could not determine chat ID from update payload.');
      return { success: false, reply: 'Invalid payload' };
    }

    // KFOS-BUG-003: Chat ID Authorization Check
    if (config.allowedTelegramChatIds.length > 0 && !config.allowedTelegramChatIds.includes(String(chatId))) {
      const authMsg = `Unauthorized access. Your Chat ID is ${chatId}. Please contact the administrator.`;
      await sendMessageToTelegram(chatId, authMsg);
      return { success: false, error: 'Unauthorized Chat ID', reply: authMsg };
    }

    const sender = update.callback_query?.from || payload?.from;
    const telegramUserId = sender?.id;
    const messageId = payload?.message_id;
    const senderName = sender?.first_name || sender?.username || 'Field Rep';

    const textInput: string = update.callback_query?.data || payload?.text || update.text || '';
    const voiceObj = payload?.voice || payload?.audio || update.voice;

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
        const todayStr = getIndiaDateString(); // India timezone date
        const todayOrders = orders.filter(o => o.orderDate && o.orderDate.startsWith(todayStr));
        const totalSales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
        replyText =
          `📊 Today's Business Performance:\n` +
          `• Total Orders: ${todayOrders.length}\n` +
          `• Total Sales Revenue: ₹${totalSales.toLocaleString('en-IN')}\n` +
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
        const pending = await getPendingActionPersistent(chatId);
        if (pending) {
          await clearPendingActionPersistent(chatId, 'cancelled');
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

    // 3. Check for Confirmation Reply (Persistent State in Firestore)
    const pending = await getPendingActionPersistent(chatId, telegramUserId);
    if (pending && textInput) {
      const normalizedText = textInput.trim().toLowerCase();
      const isAffirmative = ['yes', 'confirm', 'aama', 'correct', 'ok', 'sari', '1', 'confirm order', 'y', 'yup'].includes(
        normalizedText
      );
      const isCancellation = ['no', 'cancel', 'vendam', '0', 'stop', 'n', 'abort'].includes(normalizedText);

      if (isAffirmative) {
        const result = await claimAndExecutePendingActionAtomic(chatId, telegramUserId, async (action, actionDocId) => {
          let finalReply = '';

          if (action.intent === 'CREATE_CUSTOMER') {
            if (!action.data.place || !action.data.phone) {
              throw new Error(`Location and phone number are required to create customer '${action.data.name}'. Please specify location and phone (e.g., "${action.data.name} Madurai 9876543210").`);
            }
            const newCustomer = await customersRepository.create({
              name: action.data.name,
              businessName: action.data.name,
              place: action.data.place,
              phone: action.data.phone,
              outstandingBalance: 0,
              free200mlSamplesUsed: 0,
              totalOrdersCount: 0,
              totalSpent: 0,
              isArchived: false,
            });

            finalReply =
              `✅ NEW CUSTOMER CREATED SUCCESSFULLY!\n\n` +
              `Name: ${newCustomer.name}\n` +
              `Place: ${newCustomer.place}\n` +
              `Phone: ${newCustomer.phone}\n` +
              `Outstanding Balance: ₹0`;

            // Chained intent after customer creation
            if (action.data.nextIntent === 'CREATE_ORDER' && action.data.orderParams) {
              const orderParams = action.data.orderParams;
              const qualityGrade = orderParams.qualityGrade || 'Standard';
              const quantity = orderParams.quantityCans || 5;

              const inventory = await inventoryRepository.getAll();
              const stockItem = inventory.find(i => i.quality === qualityGrade);
              const availableStock = stockItem ? stockItem.currentStock5L : 0;

              if (availableStock < quantity) {
                finalReply += `\n\n⚠️ Cannot auto-create order: INSUFFICIENT STOCK for ${qualityGrade} (${availableStock} cans available).`;
              } else {
                const pricing = PRICING_MATRIX[qualityGrade as QualityGrade] || { salePrice: 1200, buyPrice: 750 };
                const discount = orderParams.discountPerUnit || 0;
                const effectiveUnitPrice = Math.max(0, pricing.salePrice - discount);
                const totalAmount = quantity * effectiveUnitPrice;
                const paidAmount = orderParams.paymentAmount || 0;

                const orderSummary =
                  `📦 ORDER CONFIRMATION REQUEST:\n\n` +
                  `Customer: ${newCustomer.name} (${newCustomer.place})\n` +
                  `Product: Room Freshener (${qualityGrade} Grade - 5L Can) x ${quantity} cans\n` +
                  `Unit Price: ₹${effectiveUnitPrice}\n` +
                  `Total Order Amount: ₹${totalAmount.toLocaleString('en-IN')}\n` +
                  `Payment Collected: ₹${paidAmount.toLocaleString('en-IN')}\n\n` +
                  `❓ Confirm order for new customer? Reply "Yes" or "Confirm" to execute.`;

                await setPendingActionPersistent(chatId, telegramUserId, {
                  intent: 'CREATE_ORDER',
                  data: {
                    customerId: newCustomer.id,
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
                  summaryText: orderSummary,
                });

                finalReply += `\n\n${orderSummary}`;
              }
            } else if (action.data.nextIntent === 'RECORD_PAYMENT' && action.data.paymentAmount) {
              const amount = action.data.paymentAmount;
              const paySummary =
                `💳 PAYMENT RECORDING CONFIRMATION:\n\n` +
                `Customer: ${newCustomer.name}\n` +
                `Payment Amount Collected: ₹${amount.toLocaleString('en-IN')}\n` +
                `Current Outstanding: ₹0\n\n` +
                `❓ Confirm payment of ₹${amount} for ${newCustomer.name}? Reply "Yes" or "Confirm" to execute.`;

              await setPendingActionPersistent(chatId, telegramUserId, {
                intent: 'RECORD_PAYMENT',
                data: { customerId: newCustomer.id, amount },
                summaryText: paySummary,
              });

              finalReply += `\n\n${paySummary}`;
            }
          } else if (action.intent === 'CREATE_ORDER') {
            const createdOrder = await ordersRepository.createOrderAtomic(action.data);
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
          } else if (action.intent === 'RECORD_PAYMENT') {
            const { payment, customer } = await customersRepository.recordPaymentAtomic({
              customerId: action.data.customerId,
              amount: action.data.amount,
              idempotencyKey: actionDocId || (updateId ? `upd_${updateId}` : undefined),
              recordedBy: senderName,
              notes: 'Recorded via Telegram Bot',
            });

            finalReply =
              `✅ PAYMENT RECORDED SUCCESSFULLY!\n\n` +
              `Customer: ${customer.name}\n` +
              `Amount Paid: ₹${payment.amount.toLocaleString('en-IN')}\n` +
              `Updated Outstanding Balance: ₹${customer.outstandingBalance.toLocaleString('en-IN')}`;
          } else if (action.intent === 'RECORD_EXPENSE') {
            const exp = await expensesRepository.create(action.data);
            finalReply =
              `✅ EXPENSE RECORDED SUCCESSFULLY!\n\n` +
              `Title: ${exp.title}\n` +
              `Category: ${exp.category}\n` +
              `Amount: ₹${exp.amount.toLocaleString('en-IN')}`;
          } else if (action.intent === 'RESTOCK_INVENTORY') {
            const res = await inventoryRepository.updateStockAtomic(
              action.data.quality,
              action.data.quantity,
              'RESTOCK',
              action.data.reason
            );
            finalReply =
              `✅ INVENTORY RESTOCKED SUCCESSFULLY!\n\n` +
              `Quality: ${res.inventory.quality}\n` +
              `New Stock Level: ${res.inventory.currentStock5L} cans`;
          }

          return finalReply;
        });

        await sendMessageToTelegram(chatId, result.reply, messageId);
        return { success: result.success, actionExecuted: result.success, reply: result.reply };
      } else if (isCancellation) {
        await clearPendingActionPersistent(chatId, telegramUserId, 'cancelled');
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
      audioBase64 = update.audioBase64;
      mimeType = update.mimeType || 'audio/ogg';
    }

    const nluResult = await parseNluInput({
      text: textInput,
      audioBase64,
      mimeType,
    });

    // 5. Handle Ambiguous Input / Low Confidence -> Ask Clarifying Question
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
      // Validate customer name
      if (!nluResult.customerName) {
        replyText = `Endha customer name ku order create pannanam? Please specify customer name.`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'CREATE_ORDER', reply: replyText };
      }

      // Safe Customer Matching
      const matchRes = await matchCustomerSafe(nluResult.customerName);

      if (matchRes.status === 'NOT_FOUND') {
        const formattedName = nluResult.customerName.charAt(0).toUpperCase() + nluResult.customerName.slice(1);
        replyText = `Customer record kidaikkala for '${formattedName}'. New customer create pannava? Reply "Yes" or "Confirm" to create customer, or "Cancel" to abort.`;

        await setPendingActionPersistent(chatId, telegramUserId, {
          intent: 'CREATE_CUSTOMER',
          data: {
            name: formattedName,
            place: nluResult.customerPlace || 'Tamil Nadu',
            nextIntent: 'CREATE_ORDER',
            orderParams: nluResult,
          },
          summaryText: replyText,
        });

        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'CREATE_ORDER', pendingActionCreated: true, reply: replyText };
      }

      if (matchRes.status === 'MULTIPLE' && matchRes.matches) {
        const matchNames = matchRes.matches.map(c => `${c.name} (${c.place})`).join(', ');
        replyText = `Multiple customer records found matching '${nluResult.customerName}': ${matchNames}. Please specify the exact customer name or place.`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'CREATE_ORDER', reply: replyText };
      }

      const customer = matchRes.customer!;
      const qualityGrade = nluResult.qualityGrade || 'Standard';
      const quantity = nluResult.quantityCans && nluResult.quantityCans > 0 ? nluResult.quantityCans : undefined;

      if (!quantity) {
        replyText = `Evlo ${qualityGrade} cans venum? Please specify quantity.`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'CREATE_ORDER', reply: replyText };
      }

      // Server Stock Validation
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

      // Server Authoritative Pricing
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

      await setPendingActionPersistent(chatId, telegramUserId, {
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
      });

      replyText = summaryText;
    } else if (nluResult.intent === 'RECORD_PAYMENT') {
      if (!nluResult.customerName || !nluResult.paymentAmount || nluResult.paymentAmount <= 0) {
        replyText = `Please specify customer name and valid payment amount (e.g., "Ramesh payment 2000").`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'RECORD_PAYMENT', reply: replyText };
      }

      // Safe Customer Matching
      const matchRes = await matchCustomerSafe(nluResult.customerName);

      if (matchRes.status === 'NOT_FOUND') {
        const formattedName = nluResult.customerName.charAt(0).toUpperCase() + nluResult.customerName.slice(1);
        replyText = `Customer record kidaikkala for '${formattedName}'. New customer create pannava? Reply "Yes" or "Confirm" to create customer, or "Cancel" to abort.`;

        await setPendingActionPersistent(chatId, telegramUserId, {
          intent: 'CREATE_CUSTOMER',
          data: {
            name: formattedName,
            place: nluResult.customerPlace || 'Tamil Nadu',
            nextIntent: 'RECORD_PAYMENT',
            paymentAmount: nluResult.paymentAmount,
          },
          summaryText: replyText,
        });

        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'RECORD_PAYMENT', pendingActionCreated: true, reply: replyText };
      }

      if (matchRes.status === 'MULTIPLE' && matchRes.matches) {
        const matchNames = matchRes.matches.map(c => `${c.name} (${c.place})`).join(', ');
        replyText = `Multiple customer records found matching '${nluResult.customerName}': ${matchNames}. Please specify the exact customer name or place.`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'RECORD_PAYMENT', reply: replyText };
      }

      const customer = matchRes.customer!;
      const amount = nluResult.paymentAmount;

      // Overpayment Check
      if (amount > customer.outstandingBalance && customer.outstandingBalance > 0) {
        const overpayment = amount - customer.outstandingBalance;
        replyText =
          `⚠️ PAYMENT EXCEEDS OUTSTANDING BALANCE!\n\n` +
          `Customer: ${customer.name}\n` +
          `Current Outstanding Balance: ₹${customer.outstandingBalance.toLocaleString('en-IN')}\n` +
          `Payment Amount: ₹${amount.toLocaleString('en-IN')}\n\n` +
          `Overpayment of ₹${overpayment.toLocaleString('en-IN')} would result in a negative balance.\n` +
          `❓ Reply "Confirm" if you want to record this full payment anyway, or "Cancel" to abort.`;
      } else {
        const newBalance = Math.max(0, customer.outstandingBalance - amount);
        replyText =
          `💳 PAYMENT RECORDING CONFIRMATION:\n\n` +
          `Customer: ${customer.name}\n` +
          `Payment Amount Collected: ₹${amount.toLocaleString('en-IN')}\n` +
          `Current Outstanding: ₹${customer.outstandingBalance.toLocaleString('en-IN')}\n` +
          `Updated Outstanding Balance: ₹${newBalance.toLocaleString('en-IN')}\n\n` +
          `❓ Reply "Yes" or "Confirm" to record this payment, or "Cancel" to abort.`;
      }

      await setPendingActionPersistent(chatId, telegramUserId, {
        intent: 'RECORD_PAYMENT',
        data: { customerId: customer.id, amount },
        summaryText: replyText,
      });
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
      const expenses = await expensesRepository.getAll();
      const todayStr = getIndiaDateString(); // India timezone

      const todayOrders = orders.filter(o => {
        if (!o.orderDate || o.isArchived || o.isReturned) return false;
        const istDate = new Date(o.orderDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return istDate === todayStr;
      });

      const todayExpenses = expenses.filter(e => {
        if (!e.date) return false;
        const istDate = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return istDate === todayStr;
      });

      const totalSales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const grossProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
      const totalExpenseAmount = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = grossProfit - totalExpenseAmount;

      replyText =
        `📊 Today's Business Performance:\n` +
        `• Total Orders: ${todayOrders.length}\n` +
        `• Total Sales Revenue: ₹${totalSales.toLocaleString('en-IN')}\n` +
        `• Gross Profit: ₹${grossProfit.toLocaleString('en-IN')}\n` +
        `• Total Expenses: ₹${totalExpenseAmount.toLocaleString('en-IN')}\n` +
        `• Net Profit: ₹${netProfit.toLocaleString('en-IN')}`;
    } else if (nluResult.intent === 'CHECK_CUSTOMER' || nluResult.intent === 'CHECK_OUTSTANDING') {
      if (nluResult.customerName) {
        const matchRes = await matchCustomerSafe(nluResult.customerName);
        if (matchRes.status === 'EXACT' && matchRes.customer) {
          const c = matchRes.customer;
          replyText =
            `👤 Customer Profile:\n` +
            `• Name: ${c.name}\n` +
            `• Place: ${c.place}\n` +
            `• Total Orders: ${c.totalOrdersCount}\n` +
            `• Outstanding Balance: ₹${c.outstandingBalance.toLocaleString('en-IN')}`;
        } else if (matchRes.status === 'MULTIPLE' && matchRes.matches) {
          replyText = `Multiple customer records match '${nluResult.customerName}': ${matchRes.matches.map(c => c.name).join(', ')}`;
        } else {
          replyText = `Customer record not found for '${nluResult.customerName}'.`;
        }
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
      const amount = nluResult.expenseAmount;
      const reason = nluResult.expenseReason || 'Field Operations Expense';

      if (!amount || amount <= 0) {
        replyText = `Evlo amount expense aachu? Please specify the expense amount (e.g., "Petrol expense 300").`;
        await sendMessageToTelegram(chatId, replyText, messageId);
        return { success: true, intent: 'RECORD_EXPENSE', reply: replyText };
      }

      const summaryText =
        `🧾 EXPENSE LOGGING CONFIRMATION:\n\n` +
        `Title: ${reason}\n` +
        `Amount: ₹${amount.toLocaleString('en-IN')}\n` +
        `Category: Operations\n\n` +
        `❓ Reply "Yes" or "Confirm" to record this expense.`;

      await setPendingActionPersistent(chatId, telegramUserId, {
        intent: 'RECORD_EXPENSE',
        data: {
          title: reason,
          category: 'Operations',
          amount,
          recordedBy: senderName,
          date: new Date().toISOString(),
        },
        summaryText,
      });

      replyText = summaryText;
    } else if (nluResult.intent === 'CREATE_SAMPLE') {
      if (!nluResult.customerName) {
        replyText = `Endha customer ku sample dispatch pannitaaru? Please specify customer name.`;
      } else {
        const matchRes = await matchCustomerSafe(nluResult.customerName);
        if (matchRes.status === 'EXACT' && matchRes.customer) {
          const cust = matchRes.customer;
          try {
            const { sampleRecord, customer: updatedCust } = await customersRepository.recordSampleAtomic({
              customerId: cust.id,
              sampleType: '200ml Premium Room Freshener',
              recordedBy: senderName,
            });
            replyText =
              `🧪 Premium Free Sample Dispatched & Recorded!\n` +
              `Recipient: ${updatedCust.name}\n` +
              `Sample Type: ${sampleRecord.sampleType}\n` +
              `Lifetime Free Samples Used: ${updatedCust.free200mlSamplesUsed}/3\n` +
              `Follow-up reminder scheduled in 3 days.`;
          } catch (sampleErr: any) {
            replyText = `⚠️ Free Sample Allocation Failed: ${sampleErr.message}`;
          }
        } else if (matchRes.status === 'MULTIPLE' && matchRes.matches) {
          replyText = `Multiple customers match '${nluResult.customerName}': ${matchRes.matches.map(c => `${c.name} (${c.place})`).join(', ')}. Please specify exact name or place.`;
        } else {
          replyText = `Customer record not found for sample recipient '${nluResult.customerName}'. Please create customer record first.`;
        }
      }
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
      pendingActionCreated: Boolean(await getPendingActionPersistent(chatId)),
      reply: replyText,
    };
  } catch (err: any) {
    console.error('[Telegram Service Error]', err);
    // Sanitize user reply
    const errorMsg = '❌ An error occurred while processing your request. Please try again.';
    if (update?.message?.chat?.id || update?.chatId) {
      const chatId = update?.message?.chat?.id || update?.chatId;
      await sendMessageToTelegram(chatId, errorMsg);
    }
    return {
      success: false,
      error: 'Processing error',
      reply: errorMsg,
    };
  }
};
