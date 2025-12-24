using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ConvertToJob
    {
        public static void Run()
        {
            CreateObjectHttpBinding createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectHttpBinding cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();
            InvokeActionHttpBinding invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();

            String customerId = "HOUSE";
            int jobTypeId = 1;
            int quoteId = 5066;
            int estimateId = 5785;


            Customer customer = new Customer();
            customer.id = customerId;

            JobType type = new JobType();
            type.id = jobTypeId;

            Quote quote = new Quote();
            quote.id = quoteId;


            // 1. Convert Quote to a Job
            QuoteConvertToJob convertQuote = invokeActionHttpBinding.getQuoteConvertToJob(quote);
            // Set some fields on the object
            convertQuote.description = "test foo convert";
            convertQuote.poNumber = "test po";
            convertQuote.promiseDate = DateTime.Now;

            if (null == convertQuote.customer)
            {
                convertQuote.customer = customer;
            }
            else
            {
                customer = convertQuote.customer;
            }

            convertQuote.jobType = type;
            Job job1 = invokeActionHttpBinding.convertQuoteToJob(convertQuote);

            Console.WriteLine("Converted the quote " + quote.id + " to the job " + job1.job);

            Company company = new Company();
            Quote quoteAttributesToOverride = new Quote();
            Quote newQuote = cloneObjectHttpBinding.cloneQuote(quote, "", company, quoteAttributesToOverride);

            Console.WriteLine("Cloning of the quote " + quote.id + " was successful and is cloned to " + newQuote.id);

            newQuote = invokeActionHttpBinding.calculateQuote(newQuote);

            QuoteConvertToJob convertNewQuote = invokeActionHttpBinding.getQuoteConvertToJob(newQuote);

            convertNewQuote.description = "test foo clone/convert";
            convertNewQuote.poNumber = "test po";
            convertNewQuote.promiseDate = DateTime.Now;

            if (null == convertNewQuote.customer)
            {
                convertNewQuote.customer = customer;
            }
            else
            {
                customer = convertNewQuote.customer;
            }

            convertNewQuote.jobType = type;

            Job job = invokeActionHttpBinding.convertQuoteToJob(convertNewQuote);

            Console.WriteLine("Converted the Quote " + newQuote.id + " to a job : " + job.job);

            // 2. Convert an estimate to a job.
            Estimate estimate = new Estimate();
            estimate.id = estimateId;

            // Get a new Convert To Job object for this estimate, the object is filled out with default data that is overridable
            EstimateConvertToJob convert = invokeActionHttpBinding.getEstimateConvertToJob(estimate);

            //Set some fields on the object
            convert.description = "test foo convert";
            convert.poNumber = "test po";
            convert.promiseDate = DateTime.Now;

            if (null == convert.customer)
            {
                convert.customer = customer;
            }
            else
            {
                customer = convert.customer;
            }

            convert.jobType = type;

            // See what Parts are avail for convert
            EstimateConvertToJobPart[] parts = convert.estimateConvertToJobParts;

            for (int i = 0; i < parts.Length; i++)
            {
                EstimateConvertToJobPart part = parts[i];

                EstimateQuantity qty = new EstimateQuantity();

                qty.id = part.quantityToConvert.id;
                qty = readObjectHttpBinding.readEstimateQuantity(qty);

                Console.WriteLine("Part " + (i + 1) + " is avail for convert");
                Console.WriteLine("Part " + (i + 1) + " description =" + part.description);
                Console.WriteLine("Part " + (i + 1) + " quantity to convert quoted price =" + part.quantityToConvert.quotedPrice);
                Console.WriteLine("Part " + (i + 1) + " quantity =" + qty.quantityOrdered);

                // We can also change the QuanityToConvert by selecting another Qty avail on this part

                //part.quanities

                // We can also choose not to convert this part
                //part.selected = false;
            }

            Job convertTo = invokeActionHttpBinding.convertEstimateToJob(convert);

            Console.WriteLine("Converted Estimate " + estimate.id + " to Job " + convertTo.job);
            Console.WriteLine("Job Po Number = " + convertTo.poNum);
            Console.WriteLine("Job Description = " + convertTo.description);

        }
    }
}
