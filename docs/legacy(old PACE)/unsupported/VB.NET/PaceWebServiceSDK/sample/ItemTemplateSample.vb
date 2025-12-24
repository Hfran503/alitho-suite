Imports PaceWebServiceSDK.efipaceservices
Imports System.IO

Public Class ItemTemplateSample

    Private Shared createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()
    Public Shared Sub Run()
        Dim template As ItemTemplate = createItemTemplate("TMP")
        Dim job As Job = createJob(template)
        Console.WriteLine("Job " + job.job + " - " + job.description & " created of job value - " + Convert.ToString(job.jobValue))
        Dim findObjectsHttpBinding As FindObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding()
        Dim formIds As [String]() = findObjectsHttpBinding.find("JobPartPressForm", "@job='" + job.job & "' and @jobPart='01'")
        If 1 = formIds.Length Then
            Console.WriteLine("Successfully applied template")
        Else
            Console.WriteLine("Error applying template.")
        End If

    End Sub

    Public Shared Function createItemTemplate(ByVal code As String) As ItemTemplate
        ' 1. Create item template.
        Dim template As ItemTemplate = New ItemTemplate()
        template.code = code
        template.description = "Sample Template"
        template.itemTemplateType = "VAR" 'seeded item template type
        template.jobProductType = "DSFDEF" 'seeded job product type
        template.salesCategory = 1
        template.salesCategorySpecified = True
        template.baseObject = "JobPart"
        template.qtyOptions = 2 'N/A=0, 1=1, Multiple=2
        template = createObjectHttpBinding.createItemTemplate(template)

        '2. Create Item template lines for the above item template
        Dim line1 As ItemTemplateLine = New ItemTemplateLine()
        line1.itemTemplate = template.code
        line1.dataObject = "JobPartPressForm"
        line1 = createObjectHttpBinding.createItemTemplateLine(line1)

        '3. Create item template line attributes
        Dim line1Attr1 As ItemTemplateLineAttribute = New ItemTemplateLineAttribute()
        line1Attr1.itemTemplateLine = line1.id
        line1Attr1.attribute = "formNum"
        line1Attr1.expressionType = 2 'xpath=1, static=2, external-xpath=3
        line1Attr1.defaultValue = "1"
        line1Attr1 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr1)

        Dim line1Attr2 As ItemTemplateLineAttribute = New ItemTemplateLineAttribute()
        line1Attr2.itemTemplateLine = line1.id
        line1Attr2.attribute = "numUp"
        line1Attr2.expressionType = 2 'xpath=1, static=2, external-xpath=3
        line1Attr2.defaultValue = "1"
        line1Attr2 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr2)

        Dim line1Attr3 As ItemTemplateLineAttribute = New ItemTemplateLineAttribute()
        line1Attr3.itemTemplateLine = line1.id
        line1Attr3.attribute = "press"
        line1Attr3.expressionType = 2 'xpath=1, static=2, external-xpath=3
        line1Attr3.defaultValue = "1"
        line1Attr3 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr3)

        Dim line1Attr4 As ItemTemplateLineAttribute = New ItemTemplateLineAttribute()
        line1Attr4.itemTemplateLine = line1.id
        line1Attr4.attribute = "qtyToMfg"
        line1Attr4.expressionType = 1 'xpath=1, static=2, external-xpath=3
        line1Attr4.defaultValue = "../@qtyToMfg"
        line1Attr4 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr4)

        Return template
    End Function

    Public Shared Function createJob(ByVal itemTemplate As ItemTemplate) As Job
        Dim job As Job = New Job()
        job.description = "Created from template - " + itemTemplate.description
        job.customer = "HOUSE"
        job.itemTemplate = itemTemplate.code
        job.part1QuantityOrdered = 10
        job = createObjectHttpBinding.createJob(job)
        Return job
    End Function
End Class
