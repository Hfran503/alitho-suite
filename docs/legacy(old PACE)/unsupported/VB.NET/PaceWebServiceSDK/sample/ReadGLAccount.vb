Imports PaceWebServiceSDK.efipaceservices

Public Class ReadGLAccount
    Public Shared Sub Run()

        Dim accountID As Integer = 1

        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()

        Dim acct As GLAccount = New GLAccount()
        acct.id = accountID
        Try
            acct = readObjectHttpBinding.readGLAccount(acct)
            Console.WriteLine("The account balance is " + acct.currentPeriodBalance.ToString)
        Catch ex As Exception
            Console.WriteLine(ex.Message)
        End Try
    End Sub
End Class
