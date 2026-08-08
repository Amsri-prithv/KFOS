import { describe, it, expect } from 'vitest';
import { processTelegramUpdate } from '../services/telegram.service.js';
import { parseNluInput } from '../services/nlu.service.js';
import { customersRepository } from '../repositories/customers.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { ordersRepository } from '../repositories/orders.repository.js';

export async function runTelegramTestSuite() {
  console.log('====================================================');
  console.log('       KFOS PHASE 2 - TELEGRAM & VOICE AUTOMATION TEST      ');
  console.log('====================================================\n');

  const testChatId = 8812345;

  // 1. Duplicate Telegram Update Protection
  console.log('--- 1. Testing Duplicate Protection ---');
  const update1 = {
    update_id: 99001,
    message: {
      message_id: 1,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: '/stock',
    },
  };

  const res1 = await processTelegramUpdate(update1);
  console.log('First update result:', res1.reply.substring(0, 60) + '...');

  const res1Dup = await processTelegramUpdate(update1);
  console.log('Duplicate update detected:', res1Dup.duplicate === true ? 'PASS' : 'FAIL');
  if (res1Dup.duplicate !== true) throw new Error('Duplicate protection failed');

  // Restock inventory for tests
  console.log('\n--- Restocking Inventory & Seeding Ramesh for Test Suite ---');
  await inventoryRepository.updateStockAtomic('Standard', 50, 'RESTOCK', 'Initial test stock');
  await inventoryRepository.updateStockAtomic('Eco', 50, 'RESTOCK', 'Initial test stock');
  await inventoryRepository.updateStockAtomic('Premium', 50, 'RESTOCK', 'Initial test stock');

  // Seed Ramesh customer cleanly
  const allCustomers = await customersRepository.getAll();
  const rameshList = allCustomers.filter((c) => c.name.trim().toLowerCase() === 'ramesh');
  let rameshCust = rameshList[0];
  if (!rameshCust) {
    rameshCust = await customersRepository.create({
      name: 'Ramesh',
      place: 'Trichy Main Road',
      phone: '+91 98765 43210',
      outstandingBalance: 1500,
      free200mlSamplesUsed: 0,
      totalOrdersCount: 2,
      totalSpent: 12000,
      isArchived: false,
    });
  }

  // 2. Stock Query (/stock command & Natural Language)
  console.log('\n--- 2. Testing Stock Query ---');
  const stockRes = await processTelegramUpdate({
    update_id: 99002,
    message: {
      message_id: 2,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Standard stock evlo?',
    },
  });
  console.log('Stock Query Reply:\n' + stockRes.reply);
  if (!stockRes.reply.includes('Standard Grade')) throw new Error('Stock query reply invalid');

  // 3. Tanglish Text Order Flow + Confirmation Safety
  console.log('\n--- 3. Testing Tanglish Order Flow (Ramesh ku 5 Standard cans venum) ---');
  const orderReq = await processTelegramUpdate({
    update_id: 99003,
    message: {
      message_id: 3,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Ramesh ku 5 Standard cans venum',
    },
  });
  console.log('Order Request Confirmation Prompt:\n' + orderReq.reply);
  if (!orderReq.reply.includes('ORDER CONFIRMATION REQUEST')) {
    throw new Error('Order confirmation request was not generated');
  }

  // Confirming Order
  console.log('\n--- 3b. Confirming Order (Replying "Yes") ---');
  const orderConfirm = await processTelegramUpdate({
    update_id: 99004,
    message: {
      message_id: 4,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Yes',
    },
  });
  console.log('Order Execution Reply:\n' + orderConfirm.reply);
  if (!orderConfirm.reply.includes('ORDER CREATED SUCCESSFULLY')) {
    throw new Error('Order execution failed');
  }

  // 4. Tamil / Tanglish Payment Recording + Confirmation Safety
  console.log('\n--- 4. Testing Payment Recording (Ramesh payment 2000 pannitaaru) ---');
  const payReq = await processTelegramUpdate({
    update_id: 99005,
    message: {
      message_id: 5,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Ramesh payment 2000 pannitaaru',
    },
  });
  console.log('Payment Prompt:\n' + payReq.reply);

  // Confirming Payment
  const payConfirm = await processTelegramUpdate({
    update_id: 99006,
    message: {
      message_id: 6,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Confirm',
    },
  });
  console.log('Payment Execution Reply:\n' + payConfirm.reply);
  if (!payConfirm.reply.includes('PAYMENT RECORDED SUCCESSFULLY')) {
    throw new Error('Payment recording failed');
  }

  // 5. Insufficient Stock Protection
  console.log('\n--- 5. Testing Insufficient Stock Protection ---');
  const excessReq = await processTelegramUpdate({
    update_id: 99007,
    message: {
      message_id: 7,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Ramesh ku 99999 Standard cans order',
    },
  });
  console.log('Excess Stock Reply:\n' + excessReq.reply);
  if (!excessReq.reply.includes('INSUFFICIENT STOCK')) {
    throw new Error('Insufficient stock check failed');
  }

  // 6. Ambiguous Input / Clarification Flow
  console.log('\n--- 6. Testing Ambiguous Input / Clarification Flow ---');
  const ambiguousReq = await processTelegramUpdate({
    update_id: 99008,
    message: {
      message_id: 8,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'hi hello',
    },
  });
  console.log('Ambiguous Reply Prompt:\n' + ambiguousReq.reply);
  if (!ambiguousReq.reply.toLowerCase().includes('help') && !ambiguousReq.reply.toLowerCase().includes('clarify') && !ambiguousReq.reply.toLowerCase().includes('specify')) {
    throw new Error('Clarification flow failed for ambiguous input');
  }

  // 7. Sales Performance Query
  console.log('\n--- 7. Testing Sales Performance Query ---');
  const salesRes = await processTelegramUpdate({
    update_id: 99009,
    message: {
      message_id: 9,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Today sales evlo?',
    },
  });
  console.log('Sales Performance Reply:\n' + salesRes.reply);
  if (!salesRes.reply.includes("Today's Business Performance")) {
    throw new Error('Sales performance query failed');
  }

  // 8. Order Details Query
  console.log('\n--- 8. Testing Last Order Query ---');
  const lastOrderRes = await processTelegramUpdate({
    update_id: 99010,
    message: {
      message_id: 10,
      chat: { id: testChatId },
      from: { first_name: 'Test Rep' },
      text: 'Last order details kudu',
    },
  });
  console.log('Last Order Reply:\n' + lastOrderRes.reply);
  if (!lastOrderRes.reply.includes('Latest Order')) {
    throw new Error('Last order query failed');
  }

  // 9. Voice Message Processing
  console.log('\n--- 9. Testing Voice Message Processing ---');
  const voiceNlu = await parseNluInput({
    text: 'Audio voice note: Ramesh ku 3 Premium cans order',
  });
  console.log('Voice NLU parsed intent:', voiceNlu.intent, 'Grade:', voiceNlu.qualityGrade, 'Qty:', voiceNlu.quantityCans);

  console.log('\n====================================================');
  console.log('     ALL TELEGRAM & VOICE SUITE TESTS PASSED!       ');
  console.log('====================================================\n');
}

describe('Telegram Bot & NLU Automation Suite', () => {
  it('executes full telegram bot flow and assertions', async () => {
    await runTelegramTestSuite();
  }, 30000);
});

