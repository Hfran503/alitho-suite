/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 *
 * Vendor Bills Export Script
 *
 * This scheduled script exports vendor bills created from purchase orders
 * and sends them to Calitho Suite via webhook for processing in PACE.
 *
 * Schedule: Daily (recommended to run at end of business day)
 */
define(['N/search', 'N/log', 'N/https', 'N/runtime'], function(search, log, https, runtime) {

    function execute(context) {
        // Get script parameters
        var script = runtime.getCurrentScript();
        var webhookUrl = script.getParameter({ name: 'custscript_webhook_url' });
        var webhookToken = script.getParameter({ name: 'custscript_webhook_token' });

        // Default to production URL if parameter not set
        if (!webhookUrl) {
            webhookUrl = 'https://calithosuite.com/api/webhooks/netsuite/vendor-bills';
        }

        // Calculate the target date for 1 day ago.
        var targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
        var formattedDate = formatDate(targetDate);

        log.audit('Script Start', 'Processing vendor bills for date: ' + formattedDate);

        // -----------------------------
        // Step 1: Vendor Bill Search using the creation date (1 day ago)
        // -----------------------------
        var vendorBillSearch = search.create({
            type: search.Type.VENDOR_BILL,
            filters: [
                // Filter by the date the record was created.
                ['datecreated', 'onorafter', formattedDate],
                'AND',
                ['datecreated', 'onorbefore', formattedDate],
                'AND',
                // Only bills that were created from a Purchase Order.
                ['createdfrom', 'noneof', '@NONE@'],
                'AND',
                ['createdfrom.type', 'anyof', 'PurchOrd']
            ],
            columns: [
                'tranid',
                'entity',
                'amount',
                'datecreated',
                'createdfrom',
                search.createColumn({ name: 'item' }),
                search.createColumn({ name: 'quantity' }),
                search.createColumn({ name: 'custcolpolineid' }),
                search.createColumn({ name: 'custentity_calitho_ext_id_unstored', join: 'vendor' }),
                search.createColumn({ name: 'trandate' }),
                search.createColumn({ name: 'duedate' })
            ]
        });

        var vendorBillResults = [];
        var poLineIdsSet = {};

        vendorBillSearch.run().each(function(result) {
            var amount = result.getValue('amount');
            var quantity = result.getValue('quantity');
            var numAmount = parseFloat(amount);
            var numQuantity = parseFloat(quantity);

            // Exclude rows where both amount and quantity are zero.
            if (numAmount === 0 && numQuantity === 0) {
                return true;
            }

            var polineId = result.getValue('custcolpolineid');
            if (polineId) {
                poLineIdsSet[polineId] = true;
            }

            vendorBillResults.push({
                tranid: result.getValue('tranid'),
                vendor: result.getText('entity'),
                amount: amount,
                trandate: result.getValue('datecreated'),
                purchaseorder: result.getText('createdfrom'),
                item: result.getText('item') || result.getValue('item'),
                quantity: quantity,
                polineid: polineId || '',
                vendorexternalid: result.getValue({ name: 'custentity_calitho_ext_id_unstored', join: 'vendor' }),
                invoiceDate: result.getValue('trandate'),
                invoiceDueDate: result.getValue('duedate')
            });
            return true;
        });

        log.audit('Vendor Bills Found', vendorBillResults.length + ' records');

        // -----------------------------
        // Step 2: Item Receipt Search (with pagination to handle large result sets)
        // -----------------------------
        var itemReceiptResults = [];
        try {
            var itemReceiptSearch = search.create({
                type: search.Type.ITEM_RECEIPT,
                filters: [],
                columns: [
                    'tranid',
                    'entity',
                    'trandate',
                    search.createColumn({ name: 'item' }),
                    search.createColumn({ name: 'quantity' }),
                    search.createColumn({ name: 'custcolreceipt_po_line_id' }),
                    search.createColumn({ name: 'custcolreceipt_line_id' })
                ]
            });

            var pageSize = 1000;
            var pagedData = itemReceiptSearch.runPaged({ pageSize: pageSize });
            var pageCount = pagedData.pageRanges.length;

            log.debug('Item Receipt Search', 'Total pages: ' + pageCount + ', Total results: ' + pagedData.count);

            for (var i = 0; i < pageCount; i++) {
                var currentPage = pagedData.fetch({ index: i });

                currentPage.data.forEach(function(result) {
                    var receiptPoLineId = result.getValue('custcolreceipt_po_line_id');
                    if (receiptPoLineId && poLineIdsSet[receiptPoLineId]) {
                        itemReceiptResults.push({
                            tranid: result.getValue('tranid'),
                            vendor: result.getText('entity'),
                            trandate: result.getValue('trandate'),
                            item: result.getText('item') || result.getValue('item'),
                            quantity: result.getValue('quantity'),
                            polineid: receiptPoLineId,
                            receiptlineid: result.getValue('custcolreceipt_line_id')
                        });
                    }
                });

                log.debug('Pagination Progress', 'Processed page ' + (i + 1) + ' of ' + pageCount);
            }

            log.audit('Item Receipts Found', itemReceiptResults.length + ' matching records');

        } catch (e) {
            log.error('Error in Item Receipt Search', e);
        }

        // -----------------------------
        // Step 3: Merge Vendor Bills and Item Receipts by PO Line ID
        // -----------------------------
        var vendorMap = {};
        vendorBillResults.forEach(function(record) {
            var key = record.polineid;
            if (key) {
                vendorMap[key] = vendorMap[key] || [];
                vendorMap[key].push(record);
            }
        });

        var receiptMap = {};
        itemReceiptResults.forEach(function(record) {
            var key = record.polineid;
            if (key) {
                receiptMap[key] = receiptMap[key] || [];
                receiptMap[key].push(record);
            }
        });

        var mergedKeys = {};
        for (var key in vendorMap) {
            mergedKeys[key] = true;
        }
        for (var key in receiptMap) {
            mergedKeys[key] = true;
        }

        var csvContentMerge = 'PO Line ID,Vendor Bill Transaction ID,Vendor Bill Vendor,Vendor Bill Amount,Date Created,Vendor Bill Purchase Order,Vendor Bill Item,Vendor Bill Quantity,Vendor External ID,Invoice Date,Invoice Due Date,Item Receipt Transaction ID,Item Receipt Vendor,Item Receipt Transaction Date,Item Receipt Item,Item Receipt Quantity,Receipt Line ID\n';

        for (var id in mergedKeys) {
            var vbRecords = vendorMap[id] || [];
            var irRecords = receiptMap[id] || [];

            if (vbRecords.length && irRecords.length) {
                vbRecords.forEach(function(vb) {
                    irRecords.forEach(function(ir) {
                        csvContentMerge += '"' + id + '","' + vb.tranid + '","' + vb.vendor + '","' + vb.amount + '","' +
                            vb.trandate + '","' + vb.purchaseorder + '","' + vb.item + '","' + vb.quantity + '","' +
                            (vb.vendorexternalid || '') + '","' + (vb.invoiceDate || '') + '","' + (vb.invoiceDueDate || '') + '","' +
                            ir.tranid + '","' + ir.vendor + '","' + ir.trandate + '","' + ir.item + '","' + ir.quantity + '","' + (ir.receiptlineid || '') + '"\n';
                    });
                });
            } else if (vbRecords.length) {
                vbRecords.forEach(function(vb) {
                    csvContentMerge += '"' + id + '","' + vb.tranid + '","' + vb.vendor + '","' + vb.amount + '","' +
                        vb.trandate + '","' + vb.purchaseorder + '","' + vb.item + '","' + vb.quantity + '","' +
                        (vb.vendorexternalid || '') + '","' + (vb.invoiceDate || '') + '","' + (vb.invoiceDueDate || '') + '","","","","","","' + '"\n';
                });
            } else if (irRecords.length) {
                irRecords.forEach(function(ir) {
                    csvContentMerge += '"' + id + '","' + '","","","","","","","","","","' +
                        ir.tranid + '","' + ir.vendor + '","' + ir.trandate + '","' + ir.item + '","' + ir.quantity + '","' + (ir.receiptlineid || '') + '"\n';
                });
            }
        }

        // -----------------------------
        // Step 4: Transform the Merged File into the New File with Required Fields
        // -----------------------------
        var csvContentNew = '_ACTION_,billBatch,billType,dateDue,vendor,invoiceDate,invoiceNumber,voucherDate,bill,discountApplicable,glAccount,poQuantity,poUnitPrice,poUom,purchaseOrderReceipt,invoiceAmount\n';

        function parseCSVLine(line) {
            if (line.charAt(0) === '"' && line.charAt(line.length - 1) === '"') {
                line = line.substring(1, line.length - 1);
            }
            return line.split('","');
        }

        var mergeLines = csvContentMerge.split('\n');

        for (var i = 1; i < mergeLines.length; i++) {
            var row = mergeLines[i].trim();
            if (!row) continue;
            var cols = parseCSVLine(row);

            var action = "I";
            var billBatch = "";
            var billType = "1";
            var invoiceDue = cols[10] || "";
            var invoiceDate = cols[9] || "";
            var dateDue = invoiceDue;

            if (!dateDue && invoiceDate) {
                var parts = invoiceDate.split('/');
                if (parts.length === 3) {
                    var dt = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
                    dt.setDate(dt.getDate() + 30);
                    var month = (dt.getMonth() + 1).toString();
                    if (month.length < 2) {
                        month = '0' + month;
                    }
                    var day = dt.getDate().toString();
                    if (day.length < 2) {
                        day = '0' + day;
                    }
                    dateDue = month + '/' + day + '/' + dt.getFullYear();
                }
            }

            var vendor = cols[8] || "";
            var invoiceDateField = invoiceDate;
            var invoiceNumber = cols[1] || "";
            var voucherDate = "";

            if (cols[4]) {
                var rawDate = new Date(cols[4]);
                if (!isNaN(rawDate.getTime())) {
                    voucherDate = formatDate(rawDate);
                }
            }

            var bill = "";
            var discountApplicable = "FALSE";
            var glAccount = "2";
            var poQuantity = cols[7] || "";
            var vendorBillAmount = parseFloat(cols[3]) || 0;
            var vendorBillQuantity = parseFloat(poQuantity) || 0;
            var poUnitPrice = vendorBillQuantity !== 0 ? (vendorBillAmount / vendorBillQuantity).toFixed(4) : "0";
            var poUom = "EA";
            var purchaseOrderReceipt = cols[16] || "";
            var invoiceAmount = cols[3] || "";

            var newRowArray = [
                action,
                billBatch,
                billType,
                dateDue,
                vendor,
                invoiceDateField,
                invoiceNumber,
                voucherDate,
                bill,
                discountApplicable,
                glAccount,
                poQuantity,
                poUnitPrice,
                poUom,
                purchaseOrderReceipt,
                invoiceAmount
            ];
            var newRow = '"' + newRowArray.join('","') + '"';
            csvContentNew += newRow + "\n";
        }

        // -----------------------------
        // Step 5: Send Transformed File via Webhook
        // -----------------------------
        sendToWebhook(csvContentNew, formattedDate, vendorBillResults.length, itemReceiptResults.length, webhookUrl, webhookToken);

        log.audit('Script Complete', 'Processing finished successfully');
    }

    /**
     * Send CSV data to webhook as JSON payload
     */
    function sendToWebhook(csvContent, processDate, vendorBillCount, itemReceiptCount, webhookUrl, webhookToken) {
        try {
            // Count actual data rows (excluding header)
            var lines = csvContent.split('\n').filter(function(line) {
                return line.trim() !== '';
            });
            var recordCount = lines.length - 1; // Subtract header row

            var payload = {
                source: 'NetSuite',
                type: 'vendor_bills_transformed',
                processDate: processDate,
                timestamp: new Date().toISOString(),
                recordCount: recordCount,
                vendorBillCount: vendorBillCount,
                itemReceiptCount: itemReceiptCount,
                filename: 'Transformed_Merge_File_' + processDate.replace(/\//g, '-') + '.csv',
                data: csvContent
            };

            log.audit('Webhook Request', 'Sending ' + recordCount + ' records to ' + webhookUrl);

            var headers = {
                'Content-Type': 'application/json',
                'X-NetSuite-Script': 'VendorBillExport'
            };

            // Add Bearer token if configured
            if (webhookToken) {
                headers['Authorization'] = 'Bearer ' + webhookToken;
            }

            var response = https.post({
                url: webhookUrl,
                body: JSON.stringify(payload),
                headers: headers
            });

            if (response.code === 200 || response.code === 201) {
                log.audit('Webhook Success', {
                    status: response.code,
                    body: response.body,
                    recordsSent: recordCount
                });
            } else {
                log.error('Webhook Error', {
                    status: response.code,
                    body: response.body,
                    message: 'Unexpected response code from webhook'
                });
            }

        } catch (e) {
            log.error('Webhook Exception', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
            throw e; // Re-throw to mark script execution as failed
        }
    }

    /**
     * Helper function to format a Date object as MM/DD/YYYY.
     */
    function formatDate(date) {
        var month = (date.getMonth() + 1).toString();
        if (month.length < 2) {
            month = '0' + month;
        }
        var day = date.getDate().toString();
        if (day.length < 2) {
            day = '0' + day;
        }
        var year = date.getFullYear();
        return month + '/' + day + '/' + year;
    }

    return {
        execute: execute
    };
});
