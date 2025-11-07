import { db } from '@repo/database';

/**
 * Generate the next order number in the format CS501, CS502, etc.
 * @param tenantId - The tenant ID to scope the order numbers
 * @returns The next order number (e.g., "CS501")
 */
export async function generateNextOrderNumber(tenantId: string): Promise<string> {
  // Get the latest order number for this tenant
  const latestOrder = await db.atlassianOrder.findFirst({
    where: {
      tenantId,
      orderNumber: {
        not: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      orderNumber: true,
    },
  });

  if (!latestOrder || !latestOrder.orderNumber) {
    // First order for this tenant
    return 'CS501';
  }

  // Extract the number from the order number (e.g., "CS501" -> 501)
  const match = latestOrder.orderNumber.match(/^CS(\d+)$/);
  if (!match) {
    // If the format is invalid, start from CS501
    console.warn(
      `Invalid order number format: ${latestOrder.orderNumber}. Starting from CS501.`
    );
    return 'CS501';
  }

  const currentNumber = parseInt(match[1], 10);
  const nextNumber = currentNumber + 1;

  return `CS${nextNumber}`;
}

/**
 * Retry logic for generating a unique order number
 * This handles race conditions where multiple orders might be processed simultaneously
 */
export async function generateUniqueOrderNumber(
  tenantId: string,
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const orderNumber = await generateNextOrderNumber(tenantId);

    // Check if this order number is already taken
    const existing = await db.atlassianOrder.findUnique({
      where: { orderNumber },
    });

    if (!existing) {
      return orderNumber;
    }

    // If taken, retry with a small delay
    console.log(
      `Order number ${orderNumber} already exists. Retrying... (attempt ${attempt + 1}/${maxRetries})`
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Fallback: use timestamp-based order number to ensure uniqueness
  const timestamp = Date.now().toString().slice(-6);
  const fallbackOrderNumber = `CS${timestamp}`;
  console.warn(
    `Failed to generate unique order number after ${maxRetries} attempts. Using fallback: ${fallbackOrderNumber}`
  );
  return fallbackOrderNumber;
}
