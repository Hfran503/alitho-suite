Imports PaceWebServiceSDK.efipaceservices
Imports System.IO

Public Class AttachmentService

    Public Shared Sub Run()
        Console.WriteLine("Enter the file name to attach")
        Dim attachmentFileName As String = Console.ReadLine()

        Console.WriteLine("Enter the mime type")
        Dim mimeType As String = Console.ReadLine()

        If Not File.Exists(attachmentFileName) Then
            Console.WriteLine("{0} does not exist!", attachmentFileName)
            Return
        End If

        Console.WriteLine("Processing...")

        Dim content As Byte() = readFile(attachmentFileName)
        Dim fileNameParts As [String]() = attachmentFileName.Split("."c).ToArray()
        Dim fileName As [String] = fileNameParts(0)
        Dim extension As [String] = If((fileNameParts.Length > 1), fileNameParts(1), "")

        Dim attachment As Attachment = New Attachment()
        attachment.content = Convert.ToBase64String(content)
        attachment.fileExtension = extension
        attachment.mimeType = mimeType
        attachment.name = fileName


        Dim attachmentServiceHttpBinding As AttachmentServiceHttpBinding = PaceClient.getAttachmentServiceHttpBinding()

        '1. Add Attachment
        Console.WriteLine("Enter the Base Object")
        Dim baseObject As String = Console.ReadLine()

        Console.WriteLine("Enter the Primary key")
        Dim primaryKey As String = Console.ReadLine()

        Console.WriteLine("Enter the Attribute")
        Dim attribute As String = Console.ReadLine()

        Dim newKey As String = attachmentServiceHttpBinding.addAttachment(baseObject, primaryKey, attribute, attachment)

        '2. Retrieve the attachment
        Dim attachmentRetrieved As Attachment = attachmentServiceHttpBinding.getAttachmentFromKey(newKey)
        Console.WriteLine(attachmentRetrieved.content)

        '3. Remove all attachments
        Console.WriteLine("Removing all the attachments")
        attachmentServiceHttpBinding.removeAllAttachments(baseObject, primaryKey, attribute)

    End Sub

    Private Shared Function readFile(ByVal attachmentFileName As [String]) As Byte()
        Dim bytes As Byte() = New Byte(-1) {}
        Using fileStream As New FileStream(attachmentFileName, FileMode.Open, FileAccess.Read, FileShare.Read)
            bytes = New Byte(fileStream.Length - 1) {}
            Dim numBytesToRead As Integer = CInt(fileStream.Length)
            Dim numBytesRead As Integer = 0
            While numBytesToRead > 0
                Dim n As Integer = fileStream.Read(bytes, numBytesRead, numBytesToRead)

                If n = 0 Then
                    Exit While
                End If

                numBytesRead += n
                numBytesToRead -= n
            End While
        End Using
        Return bytes
    End Function


End Class
