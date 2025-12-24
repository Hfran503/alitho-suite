Imports PaceWebServiceSDK.efipaceservices

Public Class ReportServiceSample

    Private Shared findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()

    Public Shared Sub Run()
        printReportList()
        Console.WriteLine("Enter the report Id for reading the report")
        Dim reportId As String = Console.ReadLine()
        Dim reportParametersValueObjectArray As ValueObject() = getReportParameters(reportId)
        readReport(reportId, reportParametersValueObjectArray)
    End Sub


    Private Shared Sub printReportList()
        Dim reportDescriptor As ValueObjectDescriptor = createValueObjectDescriptorForReport("@active='true'")

        Dim valueObjectGroup As ValueObjectsGroup = FindObjectsHttpBinding.loadValueObjects(reportDescriptor)
        Console.WriteLine("Total Number of active reports : " + Convert.ToString(valueObjectGroup.totalRecords))

        Dim valueObjectArray As ValueObject() = valueObjectGroup.valueObjects

        For Each valueObject As ValueObject In valueObjectArray
            Dim fields As ValueField() = valueObject.fields

            For Each valueField As ValueField In fields
                Console.Write("   " + valueField.value & "   ")
            Next

            Console.WriteLine()
        Next
    End Sub

    Private Shared Function createValueObjectDescriptorForReport(ByVal filter As String) As ValueObjectDescriptor
        ' 1. Create a ValueObjectDescriptor with objectName as Report.
        Dim reportDescriptor As New ValueObjectDescriptor()
        reportDescriptor.objectName = "Report"
        reportDescriptor.xpathFilter = filter
        reportDescriptor.offset = 0
        reportDescriptor.limit = 1000

        '2. Create Look up fields of Report Object.
        Dim reportFieldDescriptors As New List(Of FieldDescriptor)()
        Dim fieldDescriptor1 As New FieldDescriptor()
        fieldDescriptor1.name = "id"
        fieldDescriptor1.xpath = "@id"

        reportFieldDescriptors.Add(fieldDescriptor1)

        Dim fieldDescriptor2 As New FieldDescriptor()
        fieldDescriptor2.name = "Name"
        fieldDescriptor2.xpath = "@displayName"

        reportFieldDescriptors.Add(fieldDescriptor2)

        reportDescriptor.fields = reportFieldDescriptors.ToArray()

        Return reportDescriptor
    End Function

    Private Shared Function getReportParameters(ByVal reportId As String) As ValueObject()
        Dim reportDescriptor As ValueObjectDescriptor = createValueObjectDescriptorForReport("@id=" & reportId)

        ' Create ValueObjectDescriptor for ReportParameter
        Dim reportParameterDescriptor As New ValueObjectDescriptor()
        reportParameterDescriptor.objectName = "ReportParameter"
        ' Get promptable ReportParameter
        'reportParameterDescriptor.xpathFilter = "@prompt=true";
        reportParameterDescriptor.offset = 0
        reportParameterDescriptor.limit = 1000

        ' Create fields to lookup for ReportParameter Object
        Dim reportFieldDescriptors As New List(Of FieldDescriptor)()

        Dim fieldDescriptor1 As New FieldDescriptor()
        fieldDescriptor1.name = "id"
        fieldDescriptor1.xpath = "@id"
        reportFieldDescriptors.Add(fieldDescriptor1)

        Dim fieldDescriptor2 As New FieldDescriptor()
        fieldDescriptor2.name = "Expression Type"
        fieldDescriptor2.xpath = "@expressionType"
        reportFieldDescriptors.Add(fieldDescriptor2)

        Dim fieldDescriptor3 As New FieldDescriptor()
        fieldDescriptor3.name = "Expression"
        fieldDescriptor3.xpath = "@expression"
        reportFieldDescriptors.Add(fieldDescriptor3)

        reportParameterDescriptor.fields = reportFieldDescriptors.ToArray()

        reportDescriptor.children = New ValueObjectDescriptor(0) {}
        reportDescriptor.children(0) = reportParameterDescriptor

        Dim valueObjectGroup As ValueObjectsGroup = FindObjectsHttpBinding.loadValueObjects(reportDescriptor)

        Dim reportParameterValueObjects As ValueObject() = Nothing
        ' Usually there is only one record.
        If valueObjectGroup.valueObjects.Length <> 0 Then
            Dim valueObject As ValueObject = valueObjectGroup.valueObjects(0)
            Dim reportParametersVOGroup As ValueObjectsGroup() = valueObject.children

            If reportParametersVOGroup.Length <> 0 Then
                reportParameterValueObjects = reportParametersVOGroup(0).valueObjects
                Console.WriteLine("   id      type      value")
                For Each reportParameterValueObject As ValueObject In reportParameterValueObjects
                    Dim valueFields As ValueField() = reportParameterValueObject.fields

                    For Each valueField As ValueField In valueFields
                        Console.Write("   " + valueField.value & "   ")
                    Next
                    Console.WriteLine()
                Next
            End If
        Else
            Console.WriteLine("Entered report id doesn't exist in the system.")
        End If

        Return reportParameterValueObjects
    End Function

    Private Shared Sub readReport(ByVal reportId As String, ByVal valueObjects As ValueObject())
        Dim reportServiceHttpBinding As ReportServiceHttpBinding = PaceClient.getReportServiceHttpBinding()

        '1. Create ReportWrapper
        Dim reportWrapper As New ReportWrapper()

        '2. Create Report with its id set and set it to the ReportWrapper
        reportWrapper.reportId = reportId

        ' 3. Create ReportParameterWrapper array.
        Dim array As ReportParameterWrapper() = New ReportParameterWrapper(valueObjects.Length - 1) {}
        reportWrapper.reportParameterWrappers = array

        For index As Integer = 0 To valueObjects.Length - 1
            Dim valueObject As ValueObject = valueObjects(index)
            Dim valueFieldArray As ValueField() = valueObject.fields

            Dim reportParameterWrapper As New ReportParameterWrapper()


            For i As Integer = 0 To valueFieldArray.Length - 1
                Dim valueField As ValueField = valueFieldArray(i)
                If i = 1 Then
                    reportParameterWrapper.reportParameterId = valueField.value
                End If
                If i = 2 Then
                    reportParameterWrapper.value = valueField.value
                End If
            Next
            array(index) = reportParameterWrapper
        Next

        ' 4. Read the report Or
        reportWrapper = reportServiceHttpBinding.executeReport(reportWrapper)

        ' Print Report
        reportServiceHttpBinding.printReport(reportWrapper)

        ' 5. Decode the content obtained from executeReport call.
        Dim decoded As Byte() = System.Convert.FromBase64String(reportWrapper.content)

        ' 6. Write the content to the file.
        Dim fileStream As New IO.FileStream("report.pdf", System.IO.FileMode.Create, System.IO.FileAccess.Write)
        fileStream.Write(decoded, 0, decoded.Length)
        fileStream.Close()

        Console.WriteLine("Report got published successfully")
    End Sub

End Class
