Imports PaceWebServiceSDK.efipaceservices

Public Class InvokeProcessTest
    Public Shared Sub Run()

        Dim invokeProcessHttpBinding As InvokeProcessHttpBinding = PaceClient.getInvokeProcessHttpBinding()

        Dim results As ProcessResults = invokeProcessHttpBinding.postGLBatchTrn("@approved")
        Console.WriteLine("GL Batch Post was a " & (If(CBool(results.successful), "success", "failure")))

        If results.successes.Length <> 0 Then
            For Each item As SuccessProcessItem In results.successes
                Console.WriteLine("Sucesses: " + item.reason)
            Next
        End If

        If results.failures.Length <> 0 Then
            For Each item As FailedProcessItem In results.failures
                Console.WriteLine("Failures: " + item.reason)
            Next
        End If

    End Sub
End Class
