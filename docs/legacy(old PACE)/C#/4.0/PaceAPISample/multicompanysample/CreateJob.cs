using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.multicompanysample
{
    class CreateJob
    {
        public static void Run()
		{

            // create job in public schema
            string publicCompanyCustomerCode = "HOUSE";
            efipaceservices.publiccompany.CreateObjectHttpBinding publicCompanyCreateObjectHttpBinding = PaceClientCompanyPublic.getCreateObjectHttpBinding();
            efipaceservices.publiccompany.ReadObjectHttpBinding publicCompanyReadObjectHttpBinding = PaceClientCompanyPublic.getReadObjectHttpBinding();
            efipaceservices.publiccompany.UpdateObjectHttpBinding publicCompanyUpdateObjectHttpBinding = PaceClientCompanyPublic.getUpdateObjectHttpBinding();

            if (CustomerExistsInPublicSchema(publicCompanyCustomerCode,publicCompanyReadObjectHttpBinding))
            {
                efipaceservices.publiccompany.Job job = new efipaceservices.publiccompany.Job();
                job.customer = publicCompanyCustomerCode;

                // create job in public schema
                job = publicCompanyCreateObjectHttpBinding.createJob(job);

                Console.WriteLine("Created job for '" + job.customer + "' on " + job.dateSetup.ToString() + " on public company");

                // update sample on sample company.
                int quantityRequired = 10;
                UpdateJobPartInPublicSchema(job, quantityRequired, publicCompanyReadObjectHttpBinding, publicCompanyUpdateObjectHttpBinding);
            }

            // create job in sample schema
            string sampleCompanyCustomerCode = "HOUSE";

            efipaceservices.samplecompany.CreateObjectHttpBinding sampleCompanyCreateObjectHttpBinding = PaceClientCompanySample.getCreateObjectHttpBinding();
                
            efipaceservices.samplecompany.ReadObjectHttpBinding sampleCompanyReadObjectHttpBinding = PaceClientCompanySample.getReadObjectHttpBinding();
            efipaceservices.samplecompany.UpdateObjectHttpBinding sampleCompanyUpdateObjectHttpBinding = PaceClientCompanySample.getUpdateObjectHttpBinding();

            if (CustomerExistsInSampleSchema(sampleCompanyCustomerCode, sampleCompanyReadObjectHttpBinding))
            {
                efipaceservices.samplecompany.Job job = new efipaceservices.samplecompany.Job();
                job.customer = sampleCompanyCustomerCode;

                // create sample
                job = sampleCompanyCreateObjectHttpBinding.createJob(job);
                Console.WriteLine("Created job for '" + job.customer + "' on " + job.dateSetup.ToString() + " on sample company");

                // update sample on sample company.
                int qtyRequired = 10;
                UpdateJobPartInSampleSchema(job,qtyRequired,sampleCompanyReadObjectHttpBinding,sampleCompanyUpdateObjectHttpBinding);
            }
            
		}

        private static void UpdateJobPartInSampleSchema(efipaceservices.samplecompany.Job job, int quantity, efipaceservices.samplecompany.ReadObjectHttpBinding sampleCompanyReadObjectHttpBinding, efipaceservices.samplecompany.UpdateObjectHttpBinding sampleCompanyUpdateObjectHttpBinding)
        {
            efipaceservices.samplecompany.JobPart part = new efipaceservices.samplecompany.JobPart();
            part.job = job.job;
            part.jobPart = "01";
            part = sampleCompanyReadObjectHttpBinding.readJobPart(part);

            Console.WriteLine("Quantity Ordered " + quantity);

            part.qtyOrdered = quantity;
            sampleCompanyUpdateObjectHttpBinding.updateJobPart(part);
            Console.WriteLine("Sent JobPart.qtyOrdered change request");

            part = sampleCompanyReadObjectHttpBinding.readJobPart(part);
            if (quantity != part.qtyOrdered)
                throw new Exception("JobPart quantity update failed");
            Console.WriteLine("Read shows change JobPart.qtyOrdered: '" + part.qtyOrdered + "'");
        }

        private static bool CustomerExistsInSampleSchema(string sampleCompanyCustomerCode, efipaceservices.samplecompany.ReadObjectHttpBinding sampleCompanyReadObjectHttpBinding)
        {
            try
            {
                efipaceservices.samplecompany.Customer cust = new efipaceservices.samplecompany.Customer();
                cust.id = sampleCompanyCustomerCode;
                sampleCompanyReadObjectHttpBinding.readCustomer(cust);
                return true;
            }
            catch (SoapException e)
            {
                Console.WriteLine("Customer: " + sampleCompanyCustomerCode + " does not exist. Not adding job" + e.Message);
                return false;
            }
        }

        // Read Sample
        private static bool CustomerExistsInPublicSchema(string customerCode, efipaceservices.publiccompany.ReadObjectHttpBinding readObjectHttpBinding)
		{
            			
			try
			{
                efipaceservices.publiccompany.Customer cust = new efipaceservices.publiccompany.Customer();
				cust.id			= customerCode;
                readObjectHttpBinding.readCustomer(cust);
				return true;
			}
			catch (Exception e)
			{
				Console.WriteLine("Customer: " + customerCode + " does not exist. Not adding job" + e.Message);
				return false;
			}
		}

        private static void UpdateJobPartInPublicSchema(efipaceservices.publiccompany.Job job, int quantity, efipaceservices.publiccompany.ReadObjectHttpBinding readObjectHttpBinding, efipaceservices.publiccompany.UpdateObjectHttpBinding updateObjectHttpBinding)
		{
            efipaceservices.publiccompany.JobPart part = new efipaceservices.publiccompany.JobPart();
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
