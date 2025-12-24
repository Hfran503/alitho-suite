Imports PaceWebServiceSDK.efipaceservices
Imports System.IO

Public Class InvokePaceConnect
    Public Shared Sub Run()
        Console.WriteLine("Enter the pace connect id")
        Dim connectId As String = Console.ReadLine()

        Console.WriteLine("Enter the file name")
        Dim connectInput As String = readInputFromFile(Console.ReadLine())
        Dim invokePaceConnectHttpBinding As InvokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding()

        Try
            Dim results As ProcessResults = invokePaceConnectHttpBinding.invokePaceConnect(connectId, connectInput)

            Dim successes As SuccessProcessItem() = results.successes

            If successes IsNot Nothing Then

                Dim str As [String] = ""
                For Each successProcessItem As SuccessProcessItem In successes
                    str += vbLf & vbTab + successProcessItem.reason
                Next
                Console.WriteLine("Successes: " & str)
            End If

            Dim failures As FailedProcessItem() = results.failures

            If failures IsNot Nothing Then

                Dim str As [String] = ""
                For Each failureProcessItem As FailedProcessItem In failures
                    str += vbLf & vbTab + failureProcessItem.reason
                Next
                Console.WriteLine("Failures: " & str)
            End If

        Catch ex As Exception

        End Try

    End Sub

    Public Shared Function readInputFromFile(ByVal fileName As [String]) As [String]
        Dim fileInput As [String] = ""
        If Not File.Exists(fileName) Then
            Console.WriteLine("{0} does not exist!", fileName)
            Throw New FileNotFoundException("File {0} entered not found", fileName)
        Else
            Dim fileStream As New FileStream(fileName, FileMode.Open, FileAccess.Read, FileShare.Read)
            Using streamReader As New StreamReader(fileStream)
                Dim input As String = ""
                While streamReader.Peek() > -1
                    input += streamReader.ReadLine()
                End While
                fileInput = input
            End Using
            Return fileInput
        End If
    End Function


End Class
