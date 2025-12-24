Imports PaceWebServiceSDK.efipaceservices

Public Class DeleteObject

    Public Shared Sub Run()

        Dim objectName As String = "CostCenter"
        Dim primaryKey As String = "TST"
        Dim deleteObjectHttpBinding As DeleteObjectHttpBinding = PaceClient.getDeleteObjectHttpBinding()
        Try
            deleteObjectHttpBinding.deleteObject(objectName, primaryKey)
            Console.WriteLine(objectName + " " + primaryKey + " deleted")
        Catch ex As Exception
            Console.WriteLine("Delete Object failed : " + ex.Message)
        End Try

    End Sub

End Class
