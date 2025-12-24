Imports System.Web.Services.Protocols

Public Class CreateJobSample

    Public Shared Sub Run()

        ' Inputs
        Dim customerCode As String = "HOUSE"
        Dim quantityOrdered As Integer = 50

        ' Create job in public schema

        ' 1. Create instance of CreateObjectHttpBinding of efipaceservices.publiccompany namespace
        Dim createObjectHttpBinding As efipaceservices.publiccompany.CreateObjectHttpBinding = PaceClientCompanyPublic.getCreateObjectHttpBinding()

        If CustomerExistsInPublicSchema(customerCode) Then
            ' 2. Create a new Instance of Job
            Dim newJob As efipaceservices.publiccompany.Job = New efipaceservices.publiccompany.Job()

            '3. Set the required fields
            newJob.customer = customerCode

            '4. Persist the data to EFI Pace System by calling createJob
            newJob = createObjectHttpBinding.createJob(newJob)
            Console.WriteLine("Created job " + newJob.job + " for '" + newJob.customer + "' on " + newJob.dateSetup)
        End If

        ' Create job in sample schema

        ' 1. Create instance of CreateObjectHttpBinding of efipaceservices.samplecompany namespace
        Dim sampleCompanyCreateObjectHttpBinding As efipaceservices.samplecompany.CreateObjectHttpBinding = PaceClientCompanySample.getCreateObjectHttpBinding()

        If CustomerExistsInSampleSchema(customerCode) Then
            ' 2. Create a new Instance of Job
            Dim newJob As efipaceservices.samplecompany.Job = New efipaceservices.samplecompany.Job()

            '3. Set the required fields
            newJob.customer = customerCode

            '4. Persist the data to EFI Pace System by calling createJob
            newJob = sampleCompanyCreateObjectHttpBinding.createJob(newJob)
            Console.WriteLine("Created job " + newJob.job + " for '" + newJob.customer + "' on " + newJob.dateSetup)
        End If

    End Sub

    Private Shared Function CustomerExistsInPublicSchema(ByVal customerCode As String)
        ' 1. Create an instance of ReadObjectHttpBinding
        Dim readObjectHttpBinding As efipaceservices.publiccompany.ReadObjectHttpBinding = PaceClientCompanyPublic.getReadObjectHttpBinding()
        Try
            ' 2. Create an instance of Customer
            Dim cust As New efipaceservices.publiccompany.Customer()

            '3. Set the unique identifier.
            cust.id = customerCode

            '4. Read the Customer instance from the customer instance created in step 2
            cust = readObjectHttpBinding.readCustomer(cust)
            Console.WriteLine(cust.id + " Customer exist")
            Return True
        Catch e As SoapException
            Console.WriteLine(e.Message)
            Return False
        End Try
    End Function



    Private Shared Function CustomerExistsInSampleSchema(ByVal customerCode As String)
        ' 1. Create an instance of ReadObjectHttpBinding
        Dim readObjectHttpBinding As efipaceservices.samplecompany.ReadObjectHttpBinding = PaceClientCompanySample.getReadObjectHttpBinding()
        Try
            ' 2. Create an instance of Customer
            Dim cust As New efipaceservices.samplecompany.Customer()

            '3. Set the unique identifier.
            cust.id = customerCode

            '4. Read the Customer instance from the customer instance created in step 2
            cust = readObjectHttpBinding.readCustomer(cust)
            Console.WriteLine(cust.id + " Customer exist")
            Return True
        Catch e As SoapException
            Console.WriteLine(e.Message)
            Return False
        End Try
    End Function

End Class
