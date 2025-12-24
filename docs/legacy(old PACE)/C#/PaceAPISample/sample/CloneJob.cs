using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class CloneJob
    {
        public static void Run()
        {
            Console.WriteLine("Enter the customer id");
            String customerId = Console.ReadLine();

            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectPortType cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();

            // Customer Object instead of null.
            Customer customer = new Customer();

            // Job Object for job attributes to override instead of null.
            Job jobAttributesToOverride = new Job();

            // Create the instance of a new job.
            Job job1 = new Job();
            job1.customer = customerId;
            job1.description = "Description of the job";

            job1 = createObjectHttpBinding.createJob(job1); 

            Console.WriteLine("Created job " + job1.job + " for '" + job1.customer + "' on " + job1.dateSetup);


            // 1. Clone of a job with current Customer and job attributes with new Primary key
            Job cloneJob1 = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride);

            Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob1.job);


            // 2. Clone job, but pass in the new primary key to use.
            Console.WriteLine("Enter the primary key for a new clone job");
            String pk = Console.ReadLine();
            Job cloneJob2 = cloneObjectHttpBinding.cloneJob(job1, pk, customer, jobAttributesToOverride);

            Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob2.job);

            // 3. Clone job, but pass in a new parent to use instead of current parent.
            customer.id = customerId;
            Job cloneJob3 = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride);

            Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob3.job + " and the customer is : " + cloneJob3.customer);

            // 4. Clone job, but pass in attributes to override on the cloned object
            jobAttributesToOverride.description = "test of description override.";
            Job cloneJob4 = cloneObjectHttpBinding.cloneJob(job1, "", customer, jobAttributesToOverride);
            Console.WriteLine("Successfully cloned the job " + job1.job + " to " + cloneJob4.job  + " and the new description is : " + cloneJob4.description);

            // 5. Clone job part into a new job
            JobPart jobPart = getJobPart( readObjectHttpBinding, job1, "01" );
            jobPart.description = "old job part description";
            updateObjectHttpBinding.updateJobPart(jobPart);

            Job newJob = new Job();
            newJob.description = " test of description override ";

            JobPart jobPartAttributesToOverride = new JobPart();
            JobPart newClonedJobPart = cloneObjectHttpBinding.cloneJobPartIntoNewJob(jobPart, "", customer, newJob);
            Console.WriteLine("Successfully cloned JobPart to a new Job");

        }

        private static JobPart getJobPart(ReadObjectPortType readObjectHttpBinding, Job job1, string part)
        {
            JobPart jobPart = new JobPart();
            jobPart.job = job1.job;
            jobPart.jobPart = part;
            return readObjectHttpBinding.readJobPart(jobPart);
        }

    }
}
