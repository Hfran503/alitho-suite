/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * PACE Invoice Creation RESTlet
 * Receives JSON invoice data from PACE webhook and creates invoices in NetSuite
 */
define(['N/record', 'N/search', 'N/log', 'N/error', 'N/cache'],
function(record, search, log, error, cache) {

    /**
     * POST handler - Create invoice from JSON payload
     * @param {Object} requestBody - The invoice data from PACE
     * @returns {Object} Response with success status and invoice details
     */
    function post(requestBody) {
        var invoiceNumber = '';
        var lockKey = '';
        var invoiceCache = cache.getCache({
            name: 'invoiceCache',
            scope: cache.Scope.PROTECTED
        });

        try {
            // Validate request body
            if (!requestBody || !requestBody.invoice) {
                throw error.create({
                    name: 'INVALID_REQUEST',
                    message: 'Missing invoice data in request body'
                });
            }

            var invoiceData = requestBody.invoice;
            var salesDistributions = requestBody.salesDistributions || [];
            var invoiceExtras = requestBody.invoiceExtras || [];

            // Extract invoice header fields
            invoiceNumber = invoiceData.invoiceNum;
            var customerExternalId = invoiceData.customerId;
            var invoiceDate = invoiceData.invoiceDate; // Format: YYYY-MM-DD
            var poNumber = invoiceData.poNumber;
            var customerName = invoiceData.customerName;
            var taxAmount = invoiceData.taxAmount || 0;
            var invoiceAmount = invoiceData.invoiceAmount || 0;

            log.audit('Processing Invoice', {
                invoiceNumber: invoiceNumber,
                customerExternalId: customerExternalId,
                invoiceDate: invoiceDate,
                lineItems: salesDistributions.length,
                extras: invoiceExtras.length,
                totalAmount: invoiceAmount
            });

            // Validate required fields
            if (!invoiceNumber) {
                throw error.create({
                    name: 'MISSING_INVOICE_NUMBER',
                    message: 'Invoice number is required'
                });
            }

            if (!customerExternalId) {
                throw error.create({
                    name: 'MISSING_CUSTOMER',
                    message: 'Customer ID is required'
                });
            }

            // Check for duplicate processing using cache lock
            lockKey = 'invoice_' + invoiceNumber;
            if (invoiceCache.get({ key: lockKey })) {
                log.error('Duplicate Processing', 'Invoice ' + invoiceNumber + ' is currently being processed');
                return {
                    success: false,
                    error: 'Invoice is currently being processed',
                    invoiceNumber: invoiceNumber
                };
            }
            invoiceCache.put({ key: lockKey, value: 'processing', ttl: 300 });

            // Check if invoice already exists
            if (checkIfInvoiceExists(invoiceNumber)) {
                log.audit('Invoice Already Exists', 'Invoice #' + invoiceNumber + ' already exists in NetSuite');
                return {
                    success: false,
                    error: 'Invoice already exists in NetSuite',
                    invoiceNumber: invoiceNumber
                };
            }

            // Look up customer by External ID
            var customerId = getCustomerIdByExternalId(customerExternalId);
            if (!customerId) {
                throw error.create({
                    name: 'CUSTOMER_NOT_FOUND',
                    message: 'Customer not found for External ID: ' + customerExternalId
                });
            }

            // Validate all sales distribution items exist before creating invoice
            var itemDetails = [];
            for (var i = 0; i < salesDistributions.length; i++) {
                var dist = salesDistributions[i];
                var salesCategoryId = dist.salesCategoryId.toString();
                var salesCategoryName = dist.salesCategoryName;
                var quantity = dist.quantity || 1;
                var amount = dist.amount || 0;

                // Look up item by External ID (sales category ID)
                var itemId = getItemIdByExternalID(salesCategoryId);
                if (!itemId) {
                    throw error.create({
                        name: 'ITEM_NOT_FOUND',
                        message: 'Item not found for sales category: ' + salesCategoryName + ' (' + salesCategoryId + ')'
                    });
                }

                itemDetails.push({
                    itemId: itemId,
                    externalId: salesCategoryId,
                    description: salesCategoryName,
                    quantity: quantity,
                    rate: amount // Amount is the rate since quantity is typically 1
                });
            }

            // Parse invoice date (format: YYYY-MM-DD or MM/DD/YYYY)
            var formattedDate = parseInvoiceDate(invoiceDate);

            // Create the invoice record
            var invoiceRecord = record.create({
                type: record.Type.INVOICE,
                isDynamic: true
            });

            // Set header fields
            invoiceRecord.setValue({ fieldId: 'entity', value: customerId });
            invoiceRecord.setValue({ fieldId: 'trandate', value: formattedDate });
            invoiceRecord.setValue({ fieldId: 'tranid', value: invoiceNumber });
            invoiceRecord.setValue({ fieldId: 'otherrefnum', value: poNumber || '' });

            // Set memo with customer name and details
            var memoText = 'PACE Invoice for ' + customerName +
                           '\nPO#: ' + (poNumber || 'N/A') +
                           '\nAmount: $' + invoiceAmount.toFixed(2);
            invoiceRecord.setValue({ fieldId: 'memo', value: memoText });

            // Add sales distribution line items
            log.debug('Adding Line Items', 'Adding ' + itemDetails.length + ' sales distribution lines');
            for (var j = 0; j < itemDetails.length; j++) {
                var item = itemDetails[j];

                log.debug('Adding Line Item', {
                    externalId: item.externalId,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate
                });

                invoiceRecord.selectNewLine({ sublistId: 'item' });
                invoiceRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: item.itemId
                });
                invoiceRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: item.quantity
                });
                invoiceRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: parseFloat(item.rate)
                });
                invoiceRecord.commitLine({ sublistId: 'item' });
            }

            // Add invoice extras (Freight, Handling, Postage, etc.)
            log.debug('Adding Invoice Extras', 'Adding ' + invoiceExtras.length + ' extra charges');
            for (var k = 0; k < invoiceExtras.length; k++) {
                var extra = invoiceExtras[k];
                var extraPrice = extra.price || 0;
                var extraQty = extra.quantity || 1;
                var extraName = extra.invoiceExtraTypeName;

                if (extraPrice > 0) {
                    // Map invoice extra type to NetSuite item ID
                    var extraItemId = getInvoiceExtraItemId(extraName);
                    if (extraItemId) {
                        log.debug('Adding Extra Charge', {
                            type: extraName,
                            itemId: extraItemId,
                            quantity: extraQty,
                            price: extraPrice
                        });

                        invoiceRecord.selectNewLine({ sublistId: 'item' });
                        invoiceRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: extraItemId
                        });
                        invoiceRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: extraQty
                        });
                        invoiceRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: parseFloat(extraPrice)
                        });
                        invoiceRecord.commitLine({ sublistId: 'item' });
                    } else {
                        log.warn('Extra Item Not Mapped', 'No NetSuite item mapping for: ' + extraName);
                    }
                }
            }

            // Save the invoice
            var netsuiteInvoiceId = invoiceRecord.save();

            log.audit('Invoice Created Successfully', {
                netsuiteInvoiceId: netsuiteInvoiceId,
                invoiceNumber: invoiceNumber,
                customer: customerName,
                totalAmount: invoiceAmount
            });

            return {
                success: true,
                message: 'Invoice created successfully',
                invoiceId: netsuiteInvoiceId,
                invoiceNumber: invoiceNumber,
                customer: customerName,
                totalAmount: invoiceAmount
            };

        } catch (e) {
            log.error('Error Creating Invoice', {
                invoiceNumber: invoiceNumber,
                error: e.name + ': ' + e.message,
                stack: e.stack
            });

            return {
                success: false,
                error: e.message || 'Unknown error occurred',
                errorDetails: {
                    name: e.name,
                    message: e.message
                },
                invoiceNumber: invoiceNumber
            };

        } finally {
            // Always remove the cache lock
            if (lockKey) {
                try {
                    invoiceCache.remove({ key: lockKey });
                } catch (lockError) {
                    log.error('Error Removing Lock', lockError);
                }
            }
        }
    }

    /**
     * GET handler - Test endpoint
     */
    function get(requestParams) {
        return {
            success: true,
            message: 'PACE Invoice RESTlet is active',
            version: '1.0',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check if invoice already exists in NetSuite
     */
    function checkIfInvoiceExists(invoiceNumber) {
        try {
            var invoiceSearch = search.create({
                type: search.Type.INVOICE,
                filters: [['tranid', 'is', invoiceNumber]],
                columns: ['internalid']
            });
            var result = invoiceSearch.run().getRange({ start: 0, end: 1 });
            return result.length > 0;
        } catch (e) {
            log.error('Error Checking Invoice', e);
            return false;
        }
    }

    /**
     * Look up customer by External ID
     */
    function getCustomerIdByExternalId(externalId) {
        try {
            var customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [['externalid', 'is', externalId]],
                columns: ['internalid']
            });
            var result = customerSearch.run().getRange({ start: 0, end: 1 });
            if (result && result.length > 0) {
                return result[0].getValue('internalid');
            }
            return null;
        } catch (e) {
            log.error('Error Searching Customer', { externalId: externalId, error: e });
            return null;
        }
    }

    /**
     * Look up item by Custom External ID (sales category ID)
     * Uses custom field: custitem_calitho_ext_id
     */
    function getItemIdByExternalID(externalId) {
        try {
            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [['custitem_calitho_ext_id', 'is', externalId]],
                columns: ['internalid', 'itemid']
            });
            var result = itemSearch.run().getRange({ start: 0, end: 1 });
            if (result.length > 0) {
                return result[0].getValue('internalid');
            }
            return null;
        } catch (e) {
            log.error('Error Searching Item', { externalId: externalId, error: e });
            return null;
        }
    }

    /**
     * Map invoice extra type names to NetSuite item internal IDs
     * These match the IDs from your TXT processing script
     */
    function getInvoiceExtraItemId(typeName) {
        var mapping = {
            'Freight': 376,
            'Handling': 376,
            'Postage': 372,
            'Sales Tax': 310
        };
        return mapping[typeName] || null;
    }

    /**
     * Parse invoice date from YYYY-MM-DD or MM/DD/YYYY format
     */
    function parseInvoiceDate(dateString) {
        try {
            if (!dateString) {
                return new Date();
            }

            // Check if format is YYYY-MM-DD
            if (dateString.indexOf('-') > -1) {
                var parts = dateString.split('-');
                var year = parseInt(parts[0], 10);
                var month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
                var day = parseInt(parts[2], 10);
                return new Date(year, month, day);
            }

            // Otherwise assume MM/DD/YYYY format
            var dateParts = dateString.split('/');
            if (dateParts.length === 3) {
                var month = parseInt(dateParts[0], 10) - 1;
                var day = parseInt(dateParts[1], 10);
                var year = parseInt(dateParts[2], 10);
                if (year < 100) {
                    year += 2000;
                }
                return new Date(year, month, day);
            }

            return new Date();
        } catch (e) {
            log.error('Error Parsing Date', { dateString: dateString, error: e });
            return new Date();
        }
    }

    return {
        get: get,
        post: post
    };
});
