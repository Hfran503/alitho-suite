Imports PaceWebServiceSDK.efipaceservices

Public Class CreateJobTransactionUsingOverrideStatusAttribute

    Public Shared Sub Run()

        Dim createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()
        Dim updateObjectHttpBinding As UpdateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding()
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Dim cloneObjectHttpBinding As CloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding()

        Console.WriteLine("Enter the job number")

        Dim jobNumber As String = Console.ReadLine()

        Console.WriteLine("Enter the Customer code")
        Dim customerCode As String = Console.ReadLine()

        Console.WriteLine("Enter the Activity Code")
        Dim activityCode As String = Console.ReadLine()

        Dim job1 As Job = getJobIfExistsOrCreateNew(jobNumber, customerCode, readObjectHttpBinding, createObjectHttpBinding)
        Dim jobTransaction As JobCost = Nothing

        Try

            If job1 IsNot Nothing Then

                'close the job by setting it's status
                job1.adminStatus = "C"
                updateObjectHttpBinding.updateJob(job1)
                Console.WriteLine("Closed the job")

                'test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = true
                jobTransaction = createJobTransaction(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job1), True)
                Console.WriteLine("Successfully created the job transaction :" + jobTransaction.id)
                Try
                    'test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = false
                    ' We expect this to fail, that is a valid test!
                    createJobTransaction(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job1), False)
                Catch ex As Exception
                    Console.WriteLine("Setting unpersisted fields work for normal unpersisted non calculated attributes")
                End Try
                'reopen job for next sample use
                job1.adminStatus = "O"
                updateObjectHttpBinding.updateJob(job1)
            End If

        Catch ex As Exception
            Console.WriteLine("Failed : " + ex.Message)
        End Try

    End Sub

    Private Shared Function getJobPart(ByVal readObjectHttpBinding As ReadObjectHttpBinding, ByVal partString As String, ByVal job As Job) As JobPart
        Dim part As JobPart = New JobPart()
        part.job = job.job
        part.jobPart = partString
        Return readObjectHttpBinding.readJobPart(part)
    End Function

    Private Shared Function createJobTransaction(ByVal activityCode As String, ByVal createObjectHttpBinding As CreateObjectHttpBinding, ByVal part As JobPart, ByVal shouldOverride As Boolean) As JobCost

        Dim jobTransaction As JobCost = New JobCost()
        jobTransaction.JobPartKey = part.primaryKey
        jobTransaction.activityCode = activityCode
        jobTransaction.overrideJobStatus = shouldOverride
        Return createObjectHttpBinding.createJobCost(jobTransaction)
    End Function

    Private Shared Function getJobIfExistsOrCreateNew(ByVal jobNumber As String, ByVal customerCode As String, ByVal readObjectHttpBinding As ReadObjectHttpBinding, ByVal createObjectHttpBinding As CreateObjectHttpBinding) As Job

        Try
            Dim job As Job = New Job()
            job.job = jobNumber
            Return readObjectHttpBinding.readJob(job)
        Catch ex As Exception
            Console.WriteLine("Job: " + jobNumber + " does not exist. Creating new job")
            Dim job As Job = New Job()
            job.customer = customerCode
            job = createObjectHttpBinding.createJob(job)
            Return job
        End Try

    End Function

End Class
