using System;
using System.Web.Services.Protocols;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for CreateJob.
	/// </summary>
	public class CreateJob
	{
		public static Job Run()
		{
			string customerCode	= "HOUSE";
			int quantityOrdered	= 2;

			CreateObjectHttpBinding createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();

            if (CustomerExists(customerCode))
            {
                Job job = new Job();
                job.customer = customerCode;

                job = createObjectHttpBinding.createJob(job);

                // see how the default populated?
                Console.WriteLine("Created job for '" + job.customer + "' on " + job.dateSetup.ToString());
                // update the Job PartQty Ordered
                UpdateJobPart(job, quantityOrdered);
                return job;
            }
            else
            {
                return null;
            }
		}

		private static bool CustomerExists(string customerCode)
		{
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();			
			try
			{
				Customer cust	= new Customer();
				cust.id			= customerCode;
                readObjectHttpBinding.readCustomer(cust);
				return true;
			}
			catch (SoapException e)
			{
				Console.WriteLine("Customer: " + customerCode + " does not exist. Not adding job" + e.Message);
				return false;
			}
		}

		private static void UpdateJobPart(Job job, int quantity)
		{
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();						

			JobPart part = new JobPart();
			part.job	 = job.job;
			part.jobPart = "01";
            part = readObjectHttpBinding.readJobPart(part);

			Console.WriteLine("Quantity Ordered " + quantity);
			part.qtyOrdered = quantity;
            updateObjectHttpBinding.updateJobPart(part);
			Console.WriteLine("Sent JobPart.qtyOrdered change request");

            part = readObjectHttpBinding.readJobPart(part);
			if ( quantity != part.qtyOrdered )
				throw new Exception("JobPart quantity update failed");
			Console.WriteLine("Read shows change JobPart.qtyOrdered: '" + part.qtyOrdered + "'");
		}
	}
}
