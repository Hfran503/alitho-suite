Imports PaceWebServiceSDK.efipaceservices

Public Class CreateEstimatePart

    Public Shared Sub Run()
        Dim invokeActionHttpBinding As InvokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding()
        Console.WriteLine("Enter the estimate id for which the estimate part has to be added")
        Dim estimateNumber As String = Console.ReadLine()

        Dim estimatePartInfo As EstimatePartInfo = createEstimatePartInfo(estimateNumber)

        Try
            Dim estimatePart As EstimatePart = invokeActionHttpBinding.addEstimatePart(estimatePartInfo)
            Console.WriteLine("Estimate Part was successfully added to the estimate " + estimatePart.estimate.ToString)
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try

    End Sub

    Public Shared Function createEstimatePartInfo(ByVal estimateNumber As String) As EstimatePartInfo
        Dim estimatePartInfo As EstimatePartInfo = New EstimatePartInfo()
        estimatePartInfo.estimateID = estimateNumber
        estimatePartInfo.foldPattern = "2:1"
        estimatePartInfo.finalSizeH = 12
        estimatePartInfo.finalSizeW = 22
        estimatePartInfo.eachOf = 22
        estimatePartInfo.numPlies = 32
        estimatePartInfo.grainSpecifications = 3

        estimatePartInfo.bindingMethod = 1
        estimatePartInfo.prepressWorkflow = 4

        estimatePartInfo.product = "FL"

        ' estimatePartInfo.setCompositeProduct(5001);
        estimatePartInfo.colorsSide1 = 4
        estimatePartInfo.colorsSide2 = 4
        estimatePartInfo.totalColors = 4
        estimatePartInfo.inkCoverageFront = 3

        estimatePartInfo.inkCoverageBack = 3

        estimatePartInfo.quantity1 = 1000
        estimatePartInfo.quantity2 = 2000
        estimatePartInfo.quantity1Desc = " qty1 desc "
        estimatePartInfo.quantity2Desc = " qty2 desc "

        Dim estimatePaperInfo As EstimatePaperInfo = createEstimatePaperInfo()
        Dim estimatePressInfo As EstimatePressInfo = createEstimatePressInfo()

        estimatePartInfo.estimatePaperInfo = estimatePaperInfo
        estimatePartInfo.estimatePressInfo = estimatePressInfo

        Return estimatePartInfo
    End Function

    Private Shared Function createEstimatePaperInfo() As EstimatePaperInfo
        Dim estimatePaperInfo As EstimatePaperInfo = New EstimatePaperInfo()
        estimatePaperInfo.materialType = "InventoryItem"
        estimatePaperInfo.inventoryItem = "1001"
        estimatePaperInfo.weight = 5002
        estimatePaperInfo.uom = "EA"

        Return estimatePaperInfo
    End Function

    Private Shared Function createEstimatePressInfo() As EstimatePressInfo
        Dim estimatePressInfo As EstimatePressInfo = New EstimatePressInfo()
        estimatePressInfo.primaryPress = 1
        estimatePressInfo.runMethod = 1
        Return estimatePressInfo
    End Function

End Class
