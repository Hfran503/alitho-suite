using System;
using System.Web.Services.Protocols;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for CloseJob.
	/// </summary>
	public class InvoiceJob
	{
		public static void Run()
		{
            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            Console.WriteLine("Enter the job number");

            Job job = new Job();
			job.job = Console.ReadLine(); // parameter
            try { job = readObjectHttpBinding.readJob(job); }
			catch (SoapException e)
			{
				Console.WriteLine("Job: " + job.job + " does not exist. Cannot invoice job that does not exist. " + e.Message );
				return;
			}

            int batchId = SDK.readInputFromTheUser("Enter the invoice batch id");
            InvoiceBatch batch = new InvoiceBatch();
            batch.id = batchId;
            try { batch = readObjectHttpBinding.readInvoiceBatch(batch); }
            catch (SoapException e)
            {
                Console.WriteLine("Invoice Batch: " + batchId + " does not exist." + e.Message);
                return;
            }

            Invoice invoice = new Invoice();
            invoice.invoiceBatch = batchId;
            invoice.job = job.job;
            invoice.invoiceType = 5;
            invoice.taxDistributionSource = 2;
            invoice.commissionDistributionSource = 2;

            //Finds ALL Job Parts for job
            ArrayOfString jobparts = findObjectsHttpBinding.find("JobPart", "@job='" + job.job + "'");

            foreach (String jobpart in jobparts)
            {
                if (invoice.partsToInvoice == null)
                    invoice.partsToInvoice = jobpart;
                else
                    invoice.partsToInvoice = invoice.partsToInvoice + "," + jobpart;
            }
                        
            Console.WriteLine("Parts to invoice: " + invoice.partsToInvoice);

            try
            { 
                invoice = createObjectHttpBinding.createInvoice(invoice);
                Console.WriteLine("Added invoice " + invoice.invoiceNum + " for job " + job.job);
            }
            catch( Exception e)
            {
                Console.WriteLine("Invoice not added " + e.Message);
            }
}
	}
}
