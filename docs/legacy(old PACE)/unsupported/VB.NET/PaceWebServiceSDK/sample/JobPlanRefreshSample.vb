Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class JobPlanRefreshSample

    Private Shared createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()
    Private Shared readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
    Private Shared invokeProcessHttpBinding As InvokeProcessHttpBinding = PaceClient.getInvokeProcessHttpBinding()

    Public Shared Sub Run()
        Dim job As Job
        Console.WriteLine("Enter Y if you want to create a sample job from the item template - TEMP1")
        If "Y".Equals(Console.ReadLine()) Then
            Dim template As ItemTemplate = ItemTemplateSample.createItemTemplate("TEMP1")
            job = ItemTemplateSample.createJob(template)
        Else
            job = New Job()
            Console.WriteLine("Enter the job number")
            job.job = Console.ReadLine()
            job = readObjectHttpBinding.readJob(job)
        End If

        createSampleJobCosts(job.job, "01")
        findJobPlans(job.job, "01")
        invokeProcessHttpBinding.refreshJobPlansForJob(job)
        Console.WriteLine("Job Plans refreshed")
        findJobPlans(job.job, "01")
    End Sub

    Public Shared Sub createSampleJobCosts(ByVal jobId As String, ByVal partId As String)
        Dim jobCost As New JobCost()
        jobCost.job = jobId
        jobCost.jobPart = partId

        jobCost.activityCode = "000"
        jobCost.chargeClass = 1

        jobCost = createObjectHttpBinding.createJobCost(jobCost)
    End Sub

    Public Shared Sub findJobPlans(ByVal jobId As String, ByVal partId As String)
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()
        Dim jobPlanIds As [String]() = findObjectsHttpBinding.find("JobPlan", "@job='" & Convert.ToString(jobId) & "'")
        Console.WriteLine(Convert.ToString(jobPlanIds.Length) + " job plans for job " & Convert.ToString(jobId))
    End Sub

End Class
