Imports PaceWebServiceSDK.efipaceservices

Public Class ListPaceConnectTypes
    Public Shared Sub Run()
        Dim invokePaceConnectHttpBinding As InvokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding()
        Dim paceConnectTypes As String() = invokePaceConnectHttpBinding.getPaceConnectTypes()

        For Each paceConnectType As String In paceConnectTypes
            Console.WriteLine("Type : " + paceConnectType)
        Next

    End Sub
End Class
