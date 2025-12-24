using System;
using System.Web.Services.Protocols;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for CloseJob.
	/// </summary>
	public class AddJobShipment
	{
		public static void Run()
		{
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();

            Console.WriteLine("Enter the job number");

			Job job = new Job();
			job.job = Console.ReadLine(); // parameter
            try
            {
                job = readObjectHttpBinding.readJob(job);
            }
			catch (SoapException e)
			{
				Console.WriteLine("Job: " + job.job + " does not exist. Cannot add shipment to job that does not exist" + e.Message );
				return;
			}

            Console.WriteLine("Job exists, attempting to add shipment");

            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            FindObjectsPortType findObjectHttpBinding = PaceClient.getFindObjectsHttpBinding();
            JobShipment JS = new JobShipment();
            JS.job = job.job;

            // change these values as appropriate to match your data..
            JS.shipmentType = 8; 
            JS.shipVia = 5004;

            // Look for job contacts
            ArrayOfString jobContacts = findObjectHttpBinding.find("JobContact", "@job='" + job.job + "'");

            // Ship to the 1st ship to contact on job
            foreach (String contact in jobContacts)
            {
                JobContact jobContact = new JobContact();
                jobContact.id = Convert.ToInt32(contact);
                jobContact = readObjectHttpBinding.readJobContact(jobContact);
                if( jobContact.shipTo == true )
                {
                    JS.jobContact = jobContact.id;
                    break;
                }
            }

            if(JS.jobContact == null)
            {
                Console.WriteLine("No ship to contact on job");
                return;
            }
            else
            {
                try
                {
                    JS.carton1Count = 1;
                    JS.carton1Quantity = 1;

                    JS = createObjectHttpBinding.createJobShipment(JS);

                    // The above adds default content to the carton. If you do not want this, you will need something like the following instead...

                    //Carton carton = new Carton();
                    //carton.addDefaultContent = false;
                    //carton.quantity = 1;
                    //carton.count = 1;
                    //carton.shipment = JS.id;
                    //carton = createObjectHttpBinding.createCarton(carton);

                    
                }
                catch (SoapException e)
                {
                    Console.WriteLine("Error adding shipment " + e.Message);
                    return;
                }
            }

            Console.WriteLine("Shipment added");

        }

    }
}
