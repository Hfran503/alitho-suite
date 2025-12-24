Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class ReadCustomer
    Public Shared Function Run() As Customer
        ' Inputs
        Console.WriteLine("Enter the Customer Code")
        Dim customerCode As String = Console.ReadLine()

        Dim customer As Customer = readCustomer(customerCode)
        Return customer
    End Function

    Public Shared Function readCustomer(ByVal customerCode As String) As Customer
        ' 1. Create an instance of ReadObjectHttpBinding
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Try
            ' 2. Create an instance of Customer
            Dim cust As New Customer()

            '3. Set the unique identifier.
            cust.id = customerCode

            '4. Read the Customer instance from the customer instance created in step 2
            cust = readObjectHttpBinding.readCustomer(cust)
            Console.WriteLine(cust.id + " Customer read successful")
            Return cust
        Catch e As SoapException
            Console.WriteLine(e.Message)
            Return Nothing
        End Try
    End Function
End Class
