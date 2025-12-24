Imports PaceWebServiceSDK.efipaceservices

Public Class CreateEstimate
    Public Shared Sub Run()
        Dim invokeActionHttpBinding As InvokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding()
        Dim estimateInfo As EstimateInfo = createEstimateInfo()
        estimateInfo.estimatePartInfo = CreateEstimatePart.createEstimatePartInfo("")
        Try
            Dim estimate As Estimate = invokeActionHttpBinding.createEstimate(estimateInfo)
            Console.WriteLine("Estimate " + estimate.estimateNumber + " was successfully created for the customer HOUSE")
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try


    End Sub

    Public Shared Function createEstimateInfo() As EstimateInfo
        Dim estimateInfo As EstimateInfo = New EstimateInfo()
        estimateInfo.customer = "HOUSE"
        estimateInfo.estimateDescription = "Test Description"
        Return estimateInfo
    End Function

End Class