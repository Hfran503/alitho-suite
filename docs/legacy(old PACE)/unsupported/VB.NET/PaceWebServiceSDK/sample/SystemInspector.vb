Imports PaceWebServiceSDK.efipaceservices

Public Class SystemInspector

    Public Shared Sub Run()
        Dim systemInspectorHttpBinding As SystemInspectorHttpBinding = PaceClient.getSystemInspectorHttpBinding()
        Try
            Dim keys As [String]() = systemInspectorHttpBinding.inspect("com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace (UI 3.0)]")
            For Each key As String In keys
                Console.WriteLine(key)
            Next
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try

    End Sub
End Class
