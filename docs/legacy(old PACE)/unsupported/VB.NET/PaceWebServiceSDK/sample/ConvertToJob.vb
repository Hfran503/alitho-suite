Imports PaceWebServiceSDK.efipaceservices
Imports System.Web.Services.Protocols

Public Class ConvertToJob

    Public Shared Sub Run()

        Dim createObjectHttpBinding As CreateObjectHttpBinding = PaceClient.getCreateObjectHttpBinding()
        Dim updateObjectHttpBinding As UpdateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding()
        Dim readObjectHttpBinding As ReadObjectHttpBinding = PaceClient.getReadObjectHttpBinding()
        Dim cloneObjectHttpBinding As CloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding()
        Dim invokeActionHttpBinding As InvokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding()

        Dim customerId As String = "HOUSE"
        Dim jobTypeId As Integer = 1
        Dim quoteId As Integer = 5066
        Dim estimateId As Integer = 5785

        Dim customer As Customer = New Customer()
        customer.id = customerId

        Dim type As JobType = New JobType()
        type.id = jobTypeId

        Dim quote As Quote = New Quote()
        quote.id = quoteId


        ' 1. Convert Quote to a Job
        Dim convertQuote As QuoteConvertToJob = invokeActionHttpBinding.getQuoteConvertToJob(quote)
        ' Set some fields on the object
        convertQuote.description = "test foo convert"
        convertQuote.poNumber = "test po"
        convertQuote.promiseDate = DateTime.Now

        If convertQuote.customer Is Nothing Then
            convertQuote.customer = customer
        Else
            customer = convertQuote.customer
        End If

        convertQuote.jobType = type
        Dim job1 As Job = invokeActionHttpBinding.convertQuoteToJob(convertQuote)
        Console.WriteLine("Converted the quote " + quote.id.ToString + " to the job " + job1.job)

        Dim company As Company = New Company()
        Dim quoteAttributesToOverride As Quote = New Quote()
        Dim newQuote As Quote = cloneObjectHttpBinding.cloneQuote(quote, "", company, quoteAttributesToOverride)

        Console.WriteLine("Cloning of the quote " + quote.id.ToString + " was successful and is cloned to " + newQuote.id.ToString)

        newQuote = invokeActionHttpBinding.calculateQuote(newQuote)

        Dim convertNewQuote As QuoteConvertToJob = invokeActionHttpBinding.getQuoteConvertToJob(newQuote)

        convertNewQuote.description = "test foo clone/convert"
        convertNewQuote.poNumber = "test po"
        convertNewQuote.promiseDate = DateTime.Now

        If convertNewQuote.customer Is Nothing Then
            convertNewQuote.customer = customer
        Else
            customer = convertNewQuote.customer
        End If

        convertNewQuote.jobType = type

        Dim job As Job = invokeActionHttpBinding.convertQuoteToJob(convertNewQuote)

        Console.WriteLine("Converted the Quote " + newQuote.id.ToString + " to a job : " + job.job)

        ' 2. Convert an estimate to a job.
        Dim estimate As Estimate = New Estimate()
        estimate.id = estimateId

        ' Get a new Convert To Job object for this estimate, the object is filled out with default data that is overridable
        Dim convert As EstimateConvertToJob = invokeActionHttpBinding.getEstimateConvertToJob(estimate)

        'Set some fields on the object
        convert.description = "test foo convert"
        convert.poNumber = "test po"
        convert.promiseDate = DateTime.Now

        If convert.customer Is Nothing Then
            convert.customer = customer
        Else
            customer = convert.customer
        End If

        convert.jobType = type

        ' See what Parts are avail for convert
        Dim parts As EstimateConvertToJobPart() = convert.estimateConvertToJobParts

        For i As Integer = 0 To parts.Length - 1

            Dim part As EstimateConvertToJobPart = parts(i)
            Dim qty As EstimateQuantity = New EstimateQuantity()

            qty.id = part.quantityToConvert.id
            qty = readObjectHttpBinding.readEstimateQuantity(qty)

            Console.WriteLine("Part " + (i + 1).ToString + " is avail for convert")
            Console.WriteLine("Part " + (i + 1).ToString + " description =" + part.description)
            Console.WriteLine("Part " + (i + 1).ToString + " quantity to convert quoted price =" + part.quantityToConvert.quotedPrice.ToString)
            Console.WriteLine("Part " + (i + 1).ToString + " quantity =" + qty.quantityOrdered.ToString)

            'We can also change the QuanityToConvert by selecting another Qty avail on this part
            'part.quanities
            'We can also choose not to convert this part
            'part.selected = false;
        Next
                
        Dim convertTo As Job = invokeActionHttpBinding.convertEstimateToJob(convert)
        Console.WriteLine("Converted Estimate " + estimate.id.ToString + " to Job " + convertTo.job)
        Console.WriteLine("Job Po Number = " + convertTo.poNum)
        Console.WriteLine("Job Description = " + convertTo.description)

    End Sub


End Class
