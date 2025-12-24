Imports PaceWebServiceSDK.efipaceservices

Public Class FindOpenJobs

    Public Shared Sub Run()
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()
        Dim keys As String() = findObjectsHttpBinding.find("Job", "adminStatus/@openJob")
        Console.WriteLine(keys.Length.ToString + " Open Jobs")
        Console.WriteLine(String.Join(",", keys))
    End Sub

End Class
