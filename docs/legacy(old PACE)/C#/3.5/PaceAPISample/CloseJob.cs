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
			ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();

			Job job = new Job();
			job.job = "2"; // parameter
            try { job = readObjectHttpBinding.readJob(job); }
			catch (SoapException e)
			{
				Console.WriteLine("Job: " + job.job + " does not exist. Not can not close job that does not exist" + e.Message );
				return;
			}

			Console.WriteLine("Job exists, attempting to update");
			job.adminStatus = "C";
			updateObjectHttpBinding.updateJob(job);
			Console.WriteLine("Sent Job change request");

            job = readObjectHttpBinding.readJob(job);
			if ( !"C".Equals( job.adminStatus ) )
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
