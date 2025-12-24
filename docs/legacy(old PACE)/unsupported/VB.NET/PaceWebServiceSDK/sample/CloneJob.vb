Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class CloneJob
    Public Shared Function Run()
        Console.WriteLine("Enter the customer id")
        Dim customerId As String = Console.ReadLine()

        Dim createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()
        Dim updateObjectHttpBinding As UpdateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding()
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Dim cloneObjectHttpBinding As CloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding()

        Dim customer As Customer = New Customer()

        ' Job Object for job attributes to override instead of null.
        Dim jobAttributesToOverride As Job = New Job()

        ' Create the instance of a new job.
        Dim job1 As Job = New Job()
        job1.customer = customerId
        job1.description = "Description of the job"

        job1 = createObjectHttpBinding.createJob(job1)

        Console.WriteLine("Created job " + job1.job + " for '" + job1.customer + "' on " + job1.dateSetup)


        ' 1. Clone of a job with current Customer and job attributes with new Primary key
        Dim cloneJob1 As Job = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride)
        Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob1.job)


        '2. Clone job, but pass in the new primary key to use.
        Console.WriteLine("Enter the primary key for a new clone job")
        Dim pk As String = Console.ReadLine()

        Dim cloneJob2 As Job = cloneObjectHttpBinding.cloneJob(job1, pk, customer, jobAttributesToOverride)
        Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob2.job)


        ' 3. Clone job, but pass in a new parent to use instead of current parent.
        customer.id = customerId
        Dim cloneJob3 As Job = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride)
        Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob3.job + " and the customer is : " + cloneJob3.customer)

        ' 4. Clone job, but pass in attributes to override on the cloned object
        jobAttributesToOverride.description = "test of description override."
        Dim cloneJob4 As Job = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride)
        Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob4.job + " and the new description is : " + cloneJob4.description)

        ' 5. Clone job part into a new job
        Dim jobPart As JobPart = getJobPart(readObjectHttpBinding, job1, "01")
        jobPart.description = "old job part description"
        updateObjectHttpBinding.updateJobPart(jobPart)

        Dim newJob As Job = New Job()
        newJob.description = " test of description override "

        Dim jobPartAttributesToOverride As JobPart = New JobPart()
        Dim newClonedJobPart As JobPart = cloneObjectHttpBinding.cloneJobPartIntoNewJob(jobPart, "", customer, newJob)
        Console.WriteLine("Successfully cloned JobPart to a new Job")

    End Function

    Private Shared Function getJobPart(ByVal readObjectHttpBinding As ReadObjectHttpBinding, ByVal job1 As Job, ByVal part As String) As JobPart
        Dim jobPart As JobPart = New JobPart()
        jobPart.job = job1.job
        jobPart.jobPart = part
        Return readObjectHttpBinding.readJobPart(jobPart)
    End Function

End Class
