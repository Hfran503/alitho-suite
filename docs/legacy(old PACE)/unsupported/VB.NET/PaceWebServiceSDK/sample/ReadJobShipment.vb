Imports PaceWebServiceSDK.efipaceservices

Public Class ReadJobShipment
    Public Shared Sub Run()

        Dim id As Integer = 5150
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Dim jobShipment As JobShipment = New JobShipment()

        jobShipment.id = id
        Try
            jobShipment = readObjectHttpBinding.readJobShipment(jobShipment)
            Console.WriteLine("Job Shipment : " + jobShipment.id + " was read successfully")
        Catch ex As Exception
            Console.WriteLine("JobShipment: " + id + " does not exist. " + ex.Message)
        End Try

    End Sub


End Class
