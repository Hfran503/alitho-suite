Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class CreateJob

    Public Shared Function Run() As Job

        ' Inputs
        Console.WriteLine("Enter the customer code")
        Dim customerCode As String = Console.ReadLine()
        Dim quantityOrdered As Integer = 50

        ' 1. CreateObjectHttpBinding instance.
        Dim createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()

        If CustomerExists(customerCode) Then
            ' 2. Create a new Instance of Job
            Dim newJob As Job = New Job()

            '3. Set the required fields
            newJob.customer = customerCode

            '4. Persist the data to EFI Pace System by calling createJob
            newJob = createObjectHttpBinding.createJob(newJob)
            Console.WriteLine("Created job " + newJob.job + " for '" + newJob.customer + "' on " + newJob.dateSetup)
            Return newJob
        Else
            Return Nothing
        End If

    End Function

    Private Shared Function CustomerExists(ByVal customerCode As String) As Boolean
        Dim customer As Customer = ReadCustomer.readCustomer(customerCode)
        Return customer IsNot Nothing
    End Function

End Class
