/**
 * Example: Intelligence Log Transaction System
 * 
 * This example demonstrates the new transaction-based logging system
 * for tracking balance changes in the intelligence system.
 */

import {
  rechargeIntelligenceAccessBalance,
  logIntelligenceUsage,
  calculateBalanceFromLogs,
  syncBalanceFromLogs,
  getIntelligenceAccessById,
  type IntelligenceLogType,
} from '@/core/ai/files/intelligence/store';

/**
 * Example 1: Recharge Balance
 * 
 * When a user recharges their account, the system:
 * 1. Logs the transaction with type='recharge'
 * 2. Updates the balance in the intelligence_access table
 */
async function exampleRecharge() {
  const accessId = 'acc_123456789';
  const accountId = 'user_account_id';
  const rechargeAmount = 100.00; // $100

  await rechargeIntelligenceAccessBalance({
    accessId,
    accountId,
    amount: rechargeAmount,
  });

  console.log(`✅ Recharged ${rechargeAmount} to access ${accessId}`);
  
  // This creates a log entry like:
  // {
  //   access_id: 'acc_123456789',
  //   type: 'recharge',
  //   balance: 100.00,
  //   from: 'manual_recharge',
  //   details: {
  //     recharge_amount: 100.00,
  //     timestamp: '2026-06-05T12:00:00.000Z'
  //   }
  // }
}

/**
 * Example 2: Log AI Usage (Discharge)
 * 
 * When a user makes an AI request, the system:
 * 1. Calculates the cost based on tokens
 * 2. Logs the transaction with type='discharge'
 * 3. Updates the balance
 */
async function exampleUsage() {
  const accessId = 'acc_123456789';
  const cost = 2.50; // $2.50 for this request

  await logIntelligenceUsage({
    accessId,
    details: {
      query: 'What is the meaning of life?',
      response: 'The meaning of life is...',
      cost: cost,
      inputTokens: 15,
      outputTokens: 250,
      currency: 'USD',
      modal: 'openai/gpt-4',
    },
    from: 'openai/gpt-4/token_123',
    type: 'discharge' as IntelligenceLogType,
    balance: cost,
    devDetails: null,
  });

  console.log(`✅ Logged usage of ${cost} for access ${accessId}`);
}

/**
 * Example 3: Calculate Balance from Logs
 * 
 * Recalculate the balance from all transaction logs.
 * Useful for auditing and reconciliation.
 */
async function exampleCalculateBalance() {
  const accessId = 'acc_123456789';

  // Calculate balance from all logs
  const calculatedBalance = await calculateBalanceFromLogs(accessId);
  
  console.log(`💰 Calculated balance from logs: ${calculatedBalance}`);

  // The calculation works like this:
  // recharge transactions: +100, +50, +25 = +175
  // discharge transactions: -2.50, -10.00, -5.75 = -18.25
  // total balance: 175 - 18.25 = 156.75
}

/**
 * Example 4: Sync Balance from Logs
 * 
 * Update the intelligence_access table balance to match
 * what's calculated from the logs. Useful if there's a discrepancy.
 */
async function exampleSyncBalance() {
  const accessId = 'acc_123456789';
  const accountId = 'user_account_id';

  // Before sync
  const accessBefore = await getIntelligenceAccessById(accountId, accessId);
  console.log(`Before sync - stored balance: ${accessBefore?.token_balance}`);

  // Sync from logs
  await syncBalanceFromLogs(accessId, accountId);

  // After sync
  const accessAfter = await getIntelligenceAccessById(accountId, accessId);
  console.log(`After sync - stored balance: ${accessAfter?.token_balance}`);
  
  const calculatedBalance = await calculateBalanceFromLogs(accessId);
  console.log(`Calculated from logs: ${calculatedBalance}`);
  
  console.log(`✅ Balance synchronized!`);
}

/**
 * Example 5: Custom Transaction
 * 
 * For special cases like refunds, adjustments, or credits.
 */
async function exampleCustomTransaction() {
  const accessId = 'acc_123456789';
  const adjustmentAmount = -15.50; // Negative for deduction, positive for credit

  await logIntelligenceUsage({
    accessId,
    details: {
      reason: 'Customer refund for failed request',
      original_cost: 15.50,
      timestamp: new Date().toISOString(),
    },
    from: 'admin_adjustment',
    type: 'transaction' as IntelligenceLogType,
    balance: adjustmentAmount, // Can be positive or negative
    devDetails: {
      admin_id: 'admin_001',
      reason_code: 'REFUND_FAILED_REQUEST',
    },
  });

  console.log(`✅ Logged custom transaction of ${adjustmentAmount}`);
}

/**
 * Example 6: Query Transaction History
 * 
 * Get all logs and filter by transaction type.
 */
async function exampleQueryHistory() {
  // This would typically be done with a custom query, but here's the concept:
  
  // Get all recharge transactions
  const rechargeQuery = `
    SELECT * FROM intelligence_log
    WHERE access_id = $1 AND type = 'recharge'
    ORDER BY logged_on DESC
  `;

  // Get all discharge (usage) transactions
  const usageQuery = `
    SELECT * FROM intelligence_log
    WHERE access_id = $1 AND type = 'discharge'
    ORDER BY logged_on DESC
  `;

  // Get transactions within a date range
  const dateRangeQuery = `
    SELECT * FROM intelligence_log
    WHERE access_id = $1 
      AND logged_on BETWEEN $2 AND $3
    ORDER BY logged_on DESC
  `;

  console.log('📊 Query examples for transaction history');
}

// Export examples
export {
  exampleRecharge,
  exampleUsage,
  exampleCalculateBalance,
  exampleSyncBalance,
  exampleCustomTransaction,
  exampleQueryHistory,
};
