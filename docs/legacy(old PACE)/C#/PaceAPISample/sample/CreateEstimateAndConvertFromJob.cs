using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    class CreateEstimateAndConvertFromJob
    {
        public static void Run()
        {
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            InvokeActionPortType invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();

            Console.WriteLine("Enter the job number");

            Job job = new Job();
            job.job = Console.ReadLine(); // parameter
            try { job = readObjectHttpBinding.readJob(job); }
            catch (SoapException e)
            {
                Console.WriteLine("Job: " + job.job + " does not exist. " + e.Message);
                return;
            }

            try
            {
                job = invokeActionHttpBinding.createEstimateAndConvert( job );
                Console.WriteLine("Job generate schedule complete for  " + job.job);
            }
            catch (SoapException e)
            {
                Console.WriteLine(e.Message);
            }

        }

    }
}
