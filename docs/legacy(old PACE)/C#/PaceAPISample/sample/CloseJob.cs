using System;
using System.Web.Services.Protocols;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for CloseJob.
	/// </summary>
	public class CloseJob
	{
		public static void Run()
		{
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();

            Console.WriteLine("Enter the job number");

			Job job = new Job();
			job.job = Console.ReadLine(); // parameter
            try { job = readObjectHttpBinding.readJob(job); }
			catch (SoapException e)
			{
				Console.WriteLine("Job: " + job.job + " does not exist. Cannot close job that does not exist" + e.Message );
				return;
			}

            Console.WriteLine("Job exists, attempting to update");
            job.adminStatus = "C";
            updateObjectHttpBinding.updateJob(job);
            Console.WriteLine("Sent Job change request");

            job = readObjectHttpBinding.readJob(job);
            if (!"C".Equals(job.adminStatus))
            {
                throw new Exception("Job closing update failed");
            }
            else
            {
                Console.WriteLine("Read shows changed Job is closed");
            }
        }
	}
}
