import { db } from '@repo/database'
import { emailQueue } from '@/lib/queue'

interface NotificationRecipients {
  customer: boolean
  internal: boolean
}

interface StorefrontNotifications {
  orderPlaced: NotificationRecipients
  orderApproved: NotificationRecipients
  orderShipped: NotificationRecipients
  orderDelivered: NotificationRecipients
  orderCancelled: NotificationRecipients
  pickOrderCreated: NotificationRecipients
  pickOrderStarted: NotificationRecipients
  pickOrderCompleted: NotificationRecipients
  pickOrderCancelled: NotificationRecipients
}

interface WarehouseModuleConfig {
  emailNotificationsEnabled: boolean
  internalNotificationEmails: string[]
  notifications: StorefrontNotifications
}

interface OrderData {
  orderNumber: string
  customerName: string
  customerEmail?: string
  items: Array<{
    name: string
    sku?: string
    quantity: number
    referenceNumber?: string
  }>
  shippingAddress?: {
    name?: string
    address1?: string
    city?: string
    state?: string
    zip?: string
  }
  trackingNumber?: string
  carrier?: string
}

interface PickOrderData {
  pickOrderNumber: string
  destination: string
  priority: string
  items: Array<{
    name: string
    sku?: string
    requestedQty: number
    referenceNumber?: string
  }>
  createdBy: string
  createdByEmail?: string
}

interface PickOrderStatusData {
  pickOrderNumber: string
  destination: string
  priority: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  items: Array<{
    name: string
    sku?: string
    requestedQty: number
    pickedQty?: number
    referenceNumber?: string
  }>
  createdBy: string
  createdByEmail?: string
  completedAt?: Date
}

async function getModuleSettings(tenantId: string): Promise<WarehouseModuleConfig | null> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    })

    if (!tenant) return null

    const metadata = (tenant.metadata as Record<string, any>) || {}
    const modules = metadata.modules || {}
    const config = modules.warehouseStorefront as WarehouseModuleConfig | undefined

    if (!config || !config.emailNotificationsEnabled) {
      return null
    }

    return config
  } catch (error) {
    console.error('Error fetching module settings:', error)
    return null
  }
}

function generateOrderPlacedEmail(order: OrderData, isInternal: boolean): { subject: string; html: string } {
  const subject = isInternal
    ? `New Order Received - ${order.orderNumber}`
    : `Order Confirmation - ${order.orderNumber}`

  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.sku ? ` (${item.sku})` : ''}${item.referenceNumber ? `<br><span style="font-size: 12px; color: #6b7280;">Ref #: ${item.referenceNumber}</span>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4F46E5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
      ${isInternal ? '📦 New Order Received' : '✅ Order Confirmed'}
    </h1>
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">
      ${isInternal ? 'A new order has been placed and is ready for processing.' : `Thank you for your order, ${order.customerName}!`}
    </p>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
      <p style="margin: 5px 0 0; font-size: 20px; font-weight: bold; color: #4F46E5;">${order.orderNumber}</p>
    </div>

    ${isInternal ? `
    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Customer</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${order.customerName}</p>
      ${order.customerEmail ? `<p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">${order.customerEmail}</p>` : ''}
    </div>
    ` : ''}

    <h3 style="margin: 20px 0 10px; color: #374151;">Order Items</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
          <th style="padding: 10px; text-align: center; font-weight: 600;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    ${order.shippingAddress?.address1 ? `
    <h3 style="margin: 20px 0 10px; color: #374151;">Shipping Address</h3>
    <div style="background: white; padding: 15px; border-radius: 8px;">
      <p style="margin: 0;">${order.shippingAddress.name || order.customerName}</p>
      <p style="margin: 5px 0 0; color: #6b7280;">${order.shippingAddress.address1}</p>
      <p style="margin: 0; color: #6b7280;">${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zip || ''}</p>
    </div>
    ` : ''}

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      ${isInternal ? 'Please process this order as soon as possible.' : 'We will notify you when your order ships.'}
    </p>
  </div>

  <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification.</p>
  </div>
</body>
</html>
`

  return { subject, html }
}

function generateOrderDeliveredEmail(order: OrderData, isInternal: boolean): { subject: string; html: string } {
  const subject = isInternal
    ? `Order Shipped - ${order.orderNumber}`
    : `Your Order Has Shipped! - ${order.orderNumber}`

  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.sku ? ` (${item.sku})` : ''}${item.referenceNumber ? `<br><span style="font-size: 12px; color: #6b7280;">Ref #: ${item.referenceNumber}</span>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #059669; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
      🚚 Order Shipped!
    </h1>
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">
      ${isInternal ? `Order ${order.orderNumber} has been shipped to ${order.customerName}.` : `Great news, ${order.customerName}! Your order is on its way.`}
    </p>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
      <p style="margin: 5px 0 0; font-size: 20px; font-weight: bold; color: #059669;">${order.orderNumber}</p>
    </div>

    ${order.trackingNumber ? `
    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Tracking Information</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${order.carrier ? `${order.carrier}: ` : ''}${order.trackingNumber}</p>
    </div>
    ` : ''}

    <h3 style="margin: 20px 0 10px; color: #374151;">Items Shipped</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
          <th style="padding: 10px; text-align: center; font-weight: 600;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    ${order.shippingAddress?.address1 ? `
    <h3 style="margin: 20px 0 10px; color: #374151;">Shipping To</h3>
    <div style="background: white; padding: 15px; border-radius: 8px;">
      <p style="margin: 0;">${order.shippingAddress.name || order.customerName}</p>
      <p style="margin: 5px 0 0; color: #6b7280;">${order.shippingAddress.address1}</p>
      <p style="margin: 0; color: #6b7280;">${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zip || ''}</p>
    </div>
    ` : ''}

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      ${isInternal ? 'This order has been successfully shipped.' : 'Thank you for your order!'}
    </p>
  </div>

  <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification.</p>
  </div>
</body>
</html>
`

  return { subject, html }
}

function generatePickOrderCreatedEmail(pickOrder: PickOrderData): { subject: string; html: string } {
  const subject = `New Pick Order - ${pickOrder.pickOrderNumber}`

  const priorityColors: Record<string, string> = {
    low: '#6b7280',
    normal: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
  }

  const itemsHtml = pickOrder.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.sku ? ` (${item.sku})` : ''}${item.referenceNumber ? `<br><span style="font-size: 12px; color: #6b7280;">Ref #: ${item.referenceNumber}</span>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.requestedQty}</td>
        </tr>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #7C3AED; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
      📋 New Pick Order Created
    </h1>
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">
      A new pick order has been created and requires attention.
    </p>

    <div style="display: flex; gap: 15px; margin: 15px 0;">
      <div style="background: white; padding: 15px; border-radius: 8px; flex: 1;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Pick Order</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold; color: #7C3AED;">${pickOrder.pickOrderNumber}</p>
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px; flex: 1;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Priority</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold; color: ${priorityColors[pickOrder.priority] || '#3b82f6'}; text-transform: uppercase;">${pickOrder.priority}</p>
      </div>
    </div>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Destination</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${pickOrder.destination}</p>
    </div>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Created By</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${pickOrder.createdBy}</p>
    </div>

    <h3 style="margin: 20px 0 10px; color: #374151;">Items to Pick</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
          <th style="padding: 10px; text-align: center; font-weight: 600;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      Please process this pick order according to priority level.
    </p>
  </div>

  <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from the warehouse system.</p>
  </div>
</body>
</html>
`

  return { subject, html }
}

export async function sendOrderPlacedNotification(
  tenantId: string,
  order: OrderData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    const settings = config.notifications.orderPlaced

    // Send to customer
    if (settings.customer && order.customerEmail) {
      const { subject, html } = generateOrderPlacedEmail(order, false)
      await emailQueue.add('send-email', {
        tenantId,
        to: order.customerEmail,
        subject,
        html,
      })
      console.log(`📧 Order placed email queued for customer: ${order.customerEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      const { subject, html } = generateOrderPlacedEmail(order, true)
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Order placed email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending order placed notification:', error)
  }
}

export async function sendOrderDeliveredNotification(
  tenantId: string,
  order: OrderData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    const settings = config.notifications.orderDelivered

    // Send to customer
    if (settings.customer && order.customerEmail) {
      const { subject, html } = generateOrderDeliveredEmail(order, false)
      await emailQueue.add('send-email', {
        tenantId,
        to: order.customerEmail,
        subject,
        html,
      })
      console.log(`📧 Order delivered email queued for customer: ${order.customerEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      const { subject, html } = generateOrderDeliveredEmail(order, true)
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Order delivered email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending order delivered notification:', error)
  }
}

function generateOrderCancelledEmail(order: OrderData, isInternal: boolean): { subject: string; html: string } {
  const subject = isInternal
    ? `Order Cancelled - ${order.orderNumber}`
    : `Order Cancelled - ${order.orderNumber}`

  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.sku ? ` (${item.sku})` : ''}${item.referenceNumber ? `<br><span style="font-size: 12px; color: #6b7280;">Ref #: ${item.referenceNumber}</span>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #DC2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
      ❌ Order Cancelled
    </h1>
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">
      ${isInternal ? `Order ${order.orderNumber} has been cancelled.` : `We're sorry, ${order.customerName}. Your order has been cancelled.`}
    </p>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
      <p style="margin: 5px 0 0; font-size: 20px; font-weight: bold; color: #DC2626;">${order.orderNumber}</p>
    </div>

    ${isInternal ? `
    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Customer</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${order.customerName}</p>
      ${order.customerEmail ? `<p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">${order.customerEmail}</p>` : ''}
    </div>
    ` : ''}

    <h3 style="margin: 20px 0 10px; color: #374151;">Cancelled Items</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
          <th style="padding: 10px; text-align: center; font-weight: 600;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      ${isInternal ? 'Reserved inventory has been released back to available stock.' : 'If you have any questions about this cancellation, please contact us.'}
    </p>
  </div>

  <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification.</p>
  </div>
</body>
</html>
`

  return { subject, html }
}

export async function sendOrderCancelledNotification(
  tenantId: string,
  order: OrderData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    // Default to sending to both if setting doesn't exist (for older configs)
    const settings = config.notifications.orderCancelled || { customer: true, internal: true }

    // Send to customer
    if (settings.customer && order.customerEmail) {
      const { subject, html } = generateOrderCancelledEmail(order, false)
      await emailQueue.add('send-email', {
        tenantId,
        to: order.customerEmail,
        subject,
        html,
      })
      console.log(`📧 Order cancelled email queued for customer: ${order.customerEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      const { subject, html } = generateOrderCancelledEmail(order, true)
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Order cancelled email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending order cancelled notification:', error)
  }
}

export async function sendPickOrderCreatedNotification(
  tenantId: string,
  pickOrder: PickOrderData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    const settings = config.notifications.pickOrderCreated
    const { subject, html } = generatePickOrderCreatedEmail(pickOrder)

    // Send to the user who created the pick order (customer toggle = creator)
    if (settings.customer && pickOrder.createdByEmail) {
      await emailQueue.add('send-email', {
        tenantId,
        to: pickOrder.createdByEmail,
        subject,
        html,
      })
      console.log(`📧 Pick order created email queued for creator: ${pickOrder.createdByEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Pick order created email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending pick order created notification:', error)
  }
}

function generatePickOrderStatusEmail(pickOrder: PickOrderStatusData): { subject: string; html: string } {
  const isCompleted = pickOrder.status === 'COMPLETED'
  const isCancelled = pickOrder.status === 'CANCELLED'

  let subject: string
  if (isCompleted) {
    subject = `Pick Order Completed - ${pickOrder.pickOrderNumber}`
  } else if (isCancelled) {
    subject = `Pick Order Cancelled - ${pickOrder.pickOrderNumber}`
  } else {
    subject = `Pick Order Started - ${pickOrder.pickOrderNumber}`
  }

  const priorityColors: Record<string, string> = {
    low: '#6b7280',
    normal: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
  }

  let headerColor: string
  let headerIcon: string
  let headerText: string

  if (isCompleted) {
    headerColor = '#059669'
    headerIcon = '✅'
    headerText = 'Pick Order Completed'
  } else if (isCancelled) {
    headerColor = '#DC2626'
    headerIcon = '❌'
    headerText = 'Pick Order Cancelled'
  } else {
    headerColor = '#F59E0B'
    headerIcon = '🔄'
    headerText = 'Pick Order In Progress'
  }

  const itemsHtml = pickOrder.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.sku ? ` (${item.sku})` : ''}${item.referenceNumber ? `<br><span style="font-size: 12px; color: #6b7280;">Ref #: ${item.referenceNumber}</span>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.requestedQty}</td>
          ${isCompleted ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.pickedQty ?? item.requestedQty}</td>` : ''}
        </tr>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${headerColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">
      ${headerIcon} ${headerText}
    </h1>
  </div>

  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">
      ${isCompleted
        ? `Pick order ${pickOrder.pickOrderNumber} has been completed and items have been pulled from inventory.`
        : isCancelled
        ? `Pick order ${pickOrder.pickOrderNumber} has been cancelled. Reserved inventory has been released.`
        : `Pick order ${pickOrder.pickOrderNumber} is now being processed by the warehouse team.`}
    </p>

    <div style="display: flex; gap: 15px; margin: 15px 0;">
      <div style="background: white; padding: 15px; border-radius: 8px; flex: 1;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Pick Order</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold; color: ${headerColor};">${pickOrder.pickOrderNumber}</p>
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px; flex: 1;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Priority</p>
        <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold; color: ${priorityColors[pickOrder.priority] || '#3b82f6'}; text-transform: uppercase;">${pickOrder.priority}</p>
      </div>
    </div>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Destination</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${pickOrder.destination}</p>
    </div>

    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Created By</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${pickOrder.createdBy}</p>
    </div>

    ${isCompleted && pickOrder.completedAt ? `
    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Completed At</p>
      <p style="margin: 5px 0 0; font-weight: 600;">${new Date(pickOrder.completedAt).toLocaleString()}</p>
    </div>
    ` : ''}

    <h3 style="margin: 20px 0 10px; color: #374151;">${isCompleted ? 'Items Picked' : isCancelled ? 'Items (Not Shipped)' : 'Items Being Picked'}</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left; font-weight: 600;">Item</th>
          <th style="padding: 10px; text-align: center; font-weight: 600;">Requested</th>
          ${isCompleted ? '<th style="padding: 10px; text-align: center; font-weight: 600;">Picked</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      ${isCompleted
        ? 'All items have been successfully picked and inventory has been updated.'
        : isCancelled
        ? 'This pick order has been cancelled. Any reserved inventory has been released back to available stock.'
        : 'The warehouse team is actively processing this pick order.'}
    </p>
  </div>

  <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from the warehouse system.</p>
  </div>
</body>
</html>
`

  return { subject, html }
}

export async function sendPickOrderStartedNotification(
  tenantId: string,
  pickOrder: PickOrderStatusData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    // Default to sending to creator if setting doesn't exist (for older configs)
    const settings = config.notifications.pickOrderStarted || { customer: true, internal: false }

    const { subject, html } = generatePickOrderStatusEmail({ ...pickOrder, status: 'IN_PROGRESS' })

    // Send to the user who created the pick order (customer toggle = creator)
    if (settings.customer && pickOrder.createdByEmail) {
      await emailQueue.add('send-email', {
        tenantId,
        to: pickOrder.createdByEmail,
        subject,
        html,
      })
      console.log(`📧 Pick order started email queued for creator: ${pickOrder.createdByEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Pick order started email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending pick order started notification:', error)
  }
}

export async function sendPickOrderCompletedNotification(
  tenantId: string,
  pickOrder: PickOrderStatusData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    // Default to sending to both if setting doesn't exist (for older configs)
    const settings = config.notifications.pickOrderCompleted || { customer: true, internal: true }

    const { subject, html } = generatePickOrderStatusEmail({ ...pickOrder, status: 'COMPLETED' })

    // Send to the user who created the pick order (customer toggle = creator)
    if (settings.customer && pickOrder.createdByEmail) {
      await emailQueue.add('send-email', {
        tenantId,
        to: pickOrder.createdByEmail,
        subject,
        html,
      })
      console.log(`📧 Pick order completed email queued for creator: ${pickOrder.createdByEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Pick order completed email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending pick order completed notification:', error)
  }
}

export async function sendPickOrderCancelledNotification(
  tenantId: string,
  pickOrder: PickOrderStatusData
): Promise<void> {
  try {
    const config = await getModuleSettings(tenantId)
    if (!config) return

    // Default to sending to both if setting doesn't exist (for older configs)
    const settings = config.notifications.pickOrderCancelled || { customer: true, internal: true }

    const { subject, html } = generatePickOrderStatusEmail({ ...pickOrder, status: 'CANCELLED' })

    // Send to the user who created the pick order (customer toggle = creator)
    if (settings.customer && pickOrder.createdByEmail) {
      await emailQueue.add('send-email', {
        tenantId,
        to: pickOrder.createdByEmail,
        subject,
        html,
      })
      console.log(`📧 Pick order cancelled email queued for creator: ${pickOrder.createdByEmail}`)
    }

    // Send to internal (warehouse crew)
    if (settings.internal && config.internalNotificationEmails.length > 0) {
      await emailQueue.add('send-email', {
        tenantId,
        to: config.internalNotificationEmails,
        subject,
        html,
      })
      console.log(`📧 Pick order cancelled email queued for internal: ${config.internalNotificationEmails.join(', ')}`)
    }
  } catch (error) {
    console.error('Error sending pick order cancelled notification:', error)
  }
}
