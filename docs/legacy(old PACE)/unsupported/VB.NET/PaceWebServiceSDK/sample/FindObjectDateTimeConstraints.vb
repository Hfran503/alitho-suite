Imports PaceWebServiceSDK.efipaceservices

Public Class FindObjectDateTimeConstraints
    Public Shared Sub Run()
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()


        'Date Filter Sample with @date = ''
        Dim keys3 As [String]() = findObjectsHttpBinding.find("Job", "@dateSetup =''")
        Console.WriteLine(keys3.Length & " Jobs with @dateSetup = null")

        'Time Filter Sample with @time = ''
        Dim keys4 As [String]() = findObjectsHttpBinding.find("Job", "@timeSetUp =''")
        Console.WriteLine(keys4.Length & " Jobs with @timeSetUp = null")

        'Time Filter Sample with @time != ''
        Dim keys5 As [String]() = findObjectsHttpBinding.find("Job", "@timeSetUp = time( 13, 20, 29 )")

        Console.WriteLine(keys5.Length & " Jobs with @timeSetUp (13,20,29)")
    End Sub
End Class
