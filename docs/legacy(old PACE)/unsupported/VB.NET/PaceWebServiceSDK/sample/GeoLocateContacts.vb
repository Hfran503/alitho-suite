Imports PaceWebServiceSDK.efipaceservices

Public Class GeoLocateContacts
    Public Shared Sub Run()
        Dim latitude As String = "30"
        Dim longitude As String = "-81.5"

        Dim radius As Integer = 50
        Dim xpath As String = "@firstName = 'EFI Pace'"

        findContacts(latitude, longitude, radius, xpath)
    End Sub

    Private Shared Sub findContacts(ByVal latitude As String, ByVal longitude As String, ByVal radius As Integer, ByVal xpathExpression As String)

        Dim geoLocateHttpBinding As GeoLocateHttpBinding = PaceClient.getGeoLocateHttpBinding()
        Dim keys As [String]() = geoLocateHttpBinding.findContacts(latitude, longitude, radius, xpathExpression)


        Console.WriteLine("Following contacts in range: ")

        For Each contact As [String] In keys
            Console.WriteLine(contact)
        Next
    End Sub

End Class
