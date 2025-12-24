Imports PaceWebServiceSDK.efipaceservices

Public Class ReceivePOLine

    Public Shared Sub Run()
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Dim invokeActionHttpBinding As InvokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding()

        Try
            Console.WriteLine("Enter the purchase order line id [accepts only integer]")
            Dim purchaseOrderLineId As Integer = Convert.ToInt32(Console.ReadLine())

            Console.WriteLine("Enter the unit price")
            Dim unitPrice As Decimal = Convert.ToDecimal(Console.ReadLine())

            Console.WriteLine("Enter the qty received")
            Dim qtyReceived As [Double] = Convert.ToDouble(Console.ReadLine())

            Console.WriteLine("Enter the serial id ")
            Dim serialId As String = Console.ReadLine()

            Console.WriteLine("Enter the number of ids")
            Dim numIds As Integer = Convert.ToInt32(Console.ReadLine())

            Console.WriteLine("Enter the bin")
            Dim bin As String = Console.ReadLine()

            Dim purchaseOrderLine As PurchaseOrderLine = New PurchaseOrderLine()
            purchaseOrderLine.id = purchaseOrderLineId

            purchaseOrderLine = readObjectHttpBinding.readPurchaseOrderLine(purchaseOrderLine)
            Console.WriteLine("PurchaseOrderLine loaded with id - " & purchaseOrderLine.id)

            purchaseOrderLine = invokeActionHttpBinding.receivePurchaseOrderLine(purchaseOrderLine, DateTime.Now, unitPrice, "Received by SDK", True, qtyReceived, serialId, numIds, bin)

            Console.WriteLine("In PurchaseOrderLine(" & purchaseOrderLine.id & "), Qty Received = " & purchaseOrderLine.qtyOrdered & " and Qty to be received = " & purchaseOrderLine.quantityToReceive)
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try
    End Sub

   

End Class
