Imports PaceWebServiceSDK.efipaceservices

Public Class ListKeysForPaceConnectType
    Public Shared Sub Run()
        Console.WriteLine("Enter the pace connect type")
        Dim paceConnectType As String = Console.ReadLine()
        Dim invokePaceConnectHttpBinding As InvokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding()
        Dim keys As String() = invokePaceConnectHttpBinding.getKeysForPaceConnectType(paceConnectType)

        Console.WriteLine(keys.Length)

        For Each key As String In keys
            Console.WriteLine(key)
        Next
            
    End Sub
End Class
