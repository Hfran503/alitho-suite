Imports PaceWebServiceSDK.efipaceservices

Public Class GetVersion
    Public Shared Sub Run()
        Dim versionHttpBinding As VersionHttpBinding = PaceClient.getVersionHttpBinding()

        Console.WriteLine(versionHttpBinding.getVersion())
    End Sub
End Class