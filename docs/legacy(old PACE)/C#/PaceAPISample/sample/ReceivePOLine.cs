using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ReceivePOLine
    {
        public static void Run()
        {
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            InvokeActionPortType invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();

            try
            {
                Console.WriteLine("Enter the purchase order line id [accepts only integer]");
                int purchaseOrderLineId = Convert.ToInt32(Console.ReadLine());

                Console.WriteLine("Enter the unit price");
                Decimal unitPrice = Convert.ToDecimal(Console.ReadLine());

                Console.WriteLine("Enter the qty received");
                Double qtyReceived = Convert.ToDouble(Console.ReadLine());

                Console.WriteLine("Enter the serial id ");
                String serialId = Console.ReadLine();

                Console.WriteLine("Enter the number of ids");
                int numIds = Convert.ToInt32(Console.ReadLine());

                Console.WriteLine("Enter the bin");
                String bin = Console.ReadLine();

                PurchaseOrderLine purchaseOrderLine = new PurchaseOrderLine();
                purchaseOrderLine.id = purchaseOrderLineId;

                purchaseOrderLine = readObjectHttpBinding.readPurchaseOrderLine(purchaseOrderLine);
                Console.WriteLine("PurchaseOrderLine loaded with id - " + purchaseOrderLine.id);

                purchaseOrderLine = invokeActionHttpBinding.receivePurchaseOrderLine(purchaseOrderLine, DateTime.Now, unitPrice, "Received by SDK", true, qtyReceived, serialId, numIds, null, null, bin);
                Console.WriteLine("In PurchaseOrderLine(" + purchaseOrderLine.id + "), Qty Received = " +
                       purchaseOrderLine.qtyOrdered + " and Qty to be received = " + purchaseOrderLine.quantityToReceive);

            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }
    }
}
