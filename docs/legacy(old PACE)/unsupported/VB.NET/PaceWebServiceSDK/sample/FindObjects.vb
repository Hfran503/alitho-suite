Imports PaceWebServiceSDK.efipaceservices

Public Class FindObjects
    Public Shared Sub Run()
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()

        'create a sort for the keys
        Dim sort As XPathDataSort() = New XPathDataSort(2) {}

        Dim xPathDataSort1 As XPathDataSort = New XPathDataSort()
        xPathDataSort1.descending = False
        xPathDataSort1.xpath = "customer/@custName"

        Dim xPathDataSort2 As XPathDataSort = New XPathDataSort()

        xPathDataSort2.descending = True
        xPathDataSort2.xpath = "@description"

        sort(0) = xPathDataSort1
        sort(1) = xPathDataSort2

        'Open Job Filter Sample
        Dim keys As String() = findObjectsHttpBinding.find("Job", "adminStatus/@openJob")
        Console.WriteLine(keys.Length.ToString + " Open Jobs")
        Console.WriteLine(String.Join(",", keys))
    End Sub

End Class
