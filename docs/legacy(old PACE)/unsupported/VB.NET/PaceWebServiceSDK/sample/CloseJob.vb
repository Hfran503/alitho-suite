Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class CloseJob

    Public Shared Sub Run()

        'read inputs
        Console.WriteLine("Enter the job number that needs to be closed")

        Try
            ' 1. read the job object
            Dim job As Job = readJob(Console.ReadLine())

            '2. Set the adminStatus to C
            job.adminStatus = "C"

            '3. Read the instance of UpdateObjectHttpBinding 
            Dim updateObjectHttpBinding As UpdateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding()

            '4. Update the job.
            updateObjectHttpBinding.updateJob(job)
            Console.WriteLine("Closed the Job Successfully")
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try

    End Sub

    Private Shared Function readJob(ByVal jobNumber As String) As Job
        Try
            Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
            Dim job As Job = New Job()
            job.job = jobNumber
            Return readObjectHttpBinding.readJob(job)
        Catch ex As SoapException
            Console.WriteLine(ex.Message)
            Return Nothing
        End Try
    End Function

End Class
