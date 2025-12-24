Imports PaceWebServiceSDK.efipaceservices

Public Class FindObjectsAggregate

    Public Shared Sub Run()
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()

        'create the Job ValueObjectDescriptor for first batch of 10 records
        Dim jobDescriptor As ValueObjectDescriptor = createJobDescriptor(0, 10)

        ' Open Job aggregate value object loader Sample
        Dim jobVOs As ValueObjectsGroup = findObjectsHttpBinding.loadValueObjects(jobDescriptor)
        printValueObjectGroupDetail(jobVOs, 0)

        'if there are more records, print the next batch.
        'Note:- you may use this pagination feature on any level of ValueObjectDescriptors
        If jobVOs.totalRecords > 10 Then
            printValueObjectGroupDetail(findObjectsHttpBinding.loadValueObjects(createJobDescriptor(11, 10)), 0)
        End If
    End Sub

    Private Shared Sub printValueObjectGroupDetail(ByVal voGroup As ValueObjectsGroup, ByVal level As Integer)
        Console.WriteLine("Total " + voGroup.objectName + " available " + voGroup.totalRecords.ToString)

        Dim vos As ValueObject() = voGroup.valueObjects

        For Each valueObject As ValueObject In vos
            Dim fields As ValueField() = valueObject.fields
            Console.WriteLine("*** " + valueObject.objectName + " PK:" + valueObject.primaryKey + " ***")

            For Each valueField As ValueField In fields
                Console.WriteLine(valueObject.objectName + " Field: Name=" + valueField.name + ", Type=" + valueField.type + ",Value=" + valueField.value + ", XPath= " + valueField.xpath)
            Next

            Dim children As ValueObjectsGroup() = valueObject.children

            For Each child As ValueObjectsGroup In children
                printValueObjectGroupDetail(child, level + 1)
            Next
            Console.WriteLine("*** " + valueObject.objectName + " PK:" + valueObject.primaryKey + " ***")
        Next
    End Sub


    Private Shared Function createJobDescriptor(ByVal offset As Integer, ByVal limit As Integer) As ValueObjectDescriptor

        ' create the root ValueObjectDescriptor
        Dim jobDescriptor As ValueObjectDescriptor = New ValueObjectDescriptor()
        ' set descriptor properties for Job lookup
        jobDescriptor.objectName = "Job"
        jobDescriptor.offset = offset
        jobDescriptor.limit = limit
        jobDescriptor.xpathFilter = "@dateSetup = date( 2012, 08, 01 )"

        ' create fields to lookup
        Dim jobFieldDescriptors As New List(Of FieldDescriptor)()

        Dim fieldDescriptor2 As FieldDescriptor = New FieldDescriptor()
        fieldDescriptor2.name = "description"
        fieldDescriptor2.xpath = "@description"
        jobFieldDescriptors.Add(fieldDescriptor2)


        Dim fieldDescriptor3 As FieldDescriptor = New FieldDescriptor()
        fieldDescriptor3.name = "promiseDate"
        fieldDescriptor3.xpath = "@promiseDate"
        jobFieldDescriptors.Add(fieldDescriptor3)


        ' add fields to job descriptor
        jobDescriptor.fields = jobFieldDescriptors.ToArray()

        ' define sorts to be used
        Dim sort As XPathDataSort() = New XPathDataSort(1) {}

        Dim xPathDataSort1 As XPathDataSort = New XPathDataSort()
        xPathDataSort1.descending = False
        xPathDataSort1.xpath = "customer/@custName"

        Dim xPathDataSort2 As XPathDataSort = New XPathDataSort()
        xPathDataSort2.descending = True
        xPathDataSort2.xpath = "@description"

        sort(0) = xPathDataSort1
        sort(1) = xPathDataSort2

        jobDescriptor.xpathSorts = sort

        ' create the JobPart descriptor that we want to pull with the Jobs
        Dim jobPartDescriptor As ValueObjectDescriptor = New ValueObjectDescriptor()
        jobPartDescriptor.objectName = "JobPart"
        jobPartDescriptor.offset = 0
        jobPartDescriptor.limit = 10
        ' xpath is relative to this object. Leave null if you do not need a filter at this level
        'The parent filter will automatically be applied for the children
        'For eg:- the below filter will always be evaluated in context of the selected Job
        jobPartDescriptor.xpathFilter = "productionStatus/@openJob"

        ' create fields to lookup
        Dim jobPartFieldDescriptors As New List(Of FieldDescriptor)()

        Dim jobPartfieldDescriptor1 As FieldDescriptor = New FieldDescriptor()
        jobPartfieldDescriptor1.name = "job"
        jobPartfieldDescriptor1.xpath = "@job"
        jobPartFieldDescriptors.Add(jobPartfieldDescriptor1)

        Dim jobPartfieldDescriptor2 As FieldDescriptor = New FieldDescriptor()
        jobPartfieldDescriptor2.name = "jobPart"
        jobPartfieldDescriptor2.xpath = "@jobPart"
        jobPartFieldDescriptors.Add(jobPartfieldDescriptor2)


        Dim jobPartfieldDescriptor3 As FieldDescriptor = New FieldDescriptor()
        jobPartfieldDescriptor3.name = "productionStatusDesc"
        jobPartfieldDescriptor3.xpath = "productionStatus/@description"
        jobPartFieldDescriptors.Add(jobPartfieldDescriptor3)

        Dim jobPartfieldDescriptor4 As FieldDescriptor = New FieldDescriptor()
        jobPartfieldDescriptor4.name = "qtyToMfg"
        jobPartfieldDescriptor4.xpath = "@qtyToMfg"
        jobPartFieldDescriptors.Add(jobPartfieldDescriptor4)

        jobPartDescriptor.fields = jobPartFieldDescriptors.ToArray()


        ' create the JobShipment descriptor that we want to pull with the Jobs
        Dim jobShipmentDescriptor As ValueObjectDescriptor = New ValueObjectDescriptor()
        jobShipmentDescriptor.objectName = "JobShipment"
        jobShipmentDescriptor.offset = 0
        jobShipmentDescriptor.limit = 10


        ' create fields to lookup
        Dim jobShipmentFieldDescriptors As New List(Of FieldDescriptor)()

        Dim jobShipmentFieldDescriptor1 As FieldDescriptor = New FieldDescriptor()
        jobShipmentFieldDescriptor1.name = "id"
        jobShipmentFieldDescriptor1.xpath = "@id"

        Dim jobShipmentFieldDescriptor2 As FieldDescriptor = New FieldDescriptor()
        jobShipmentFieldDescriptor2.name = "job"
        jobShipmentFieldDescriptor2.xpath = "@job"

        Dim jobShipmentFieldDescriptor3 As FieldDescriptor = New FieldDescriptor()
        jobShipmentFieldDescriptor3.name = "jobPart"
        jobShipmentFieldDescriptor3.xpath = "@jobPart"

        Dim jobShipmentFieldDescriptor4 As FieldDescriptor = New FieldDescriptor()
        jobShipmentFieldDescriptor4.name = "Shipment Type"
        jobShipmentFieldDescriptor4.xpath = "@shipmentType/@description"

        ' add fields to jobpart descriptor
        jobShipmentDescriptor.fields = jobShipmentFieldDescriptors.ToArray()

        ' set the child in the jobdescriptor
        jobDescriptor.children = New ValueObjectDescriptor() {jobPartDescriptor, jobShipmentDescriptor}

        Return jobDescriptor
    End Function
End Class
