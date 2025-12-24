using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class CreateJobTransactionUsingOverrideStatusAttribute
    {
        public static void Run()
        {
            CreateObjectHttpBinding createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectHttpBinding cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();

            Console.WriteLine("Enter the job number");
            String jobNumber = Console.ReadLine();

            Console.WriteLine("Enter the Customer code");
            String customerCode = Console.ReadLine();

            Console.WriteLine("Enter the Activity Code");
            String activityCode = Console.ReadLine();

            Job job = getJobIfExistsOrCreateNew(jobNumber, customerCode, readObjectHttpBinding, createObjectHttpBinding);

            JobCost jobTransaction = null;
            try
            {
                if (null != job)
                {
                    //close the job by setting it's status
                    job.adminStatus = "C";
                    updateObjectHttpBinding.updateJob(job);
                    Console.WriteLine("Closed the job");

                    //test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = true
                    jobTransaction = createJobCost(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job), true);
                    Console.WriteLine("Successfully created the job transaction :" + jobTransaction.id);
                    try
                    {
                        //test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = false
                        // We expect this to fail, that is a valid test!
                        createJobTransaction(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job), false);
                    }
                    catch (Exception e)
                    {
                        Console.WriteLine("Setting unpersisted fields work for normal unpersisted non calculated attributes");
                    }
                    //reopen job for next sample use
                    job.adminStatus = "O";
                    updateObjectHttpBinding.updateJob(job);
                }

            }
            catch (Exception e)
            {
                Console.WriteLine("Failed : " + e.Message);
            }
        }

        private static JobPart getJobPart(ReadObjectHttpBinding readObjectHttpBinding, String partString, Job job)
        {
            JobPart part = new JobPart();
            part.job = job.job;
            part.jobPart = partString;
            return readObjectHttpBinding.readJobPart(part);
        }

        private static JobCost createJobTransaction(String activityCode, CreateObjectHttpBinding createObjectHttpBinding, JobPart part, Boolean shouldOverride)
        {
            JobCost jobTransaction = new JobCost();
            jobTransaction.JobPartKey = part.primaryKey;
            jobTransaction.activityCode = activityCode;
            jobTransaction.overrideJobStatus = shouldOverride;
            return createObjectHttpBinding.createJobCost(jobTransaction);
        }

        private static Job getJobIfExistsOrCreateNew(String jobNumber, String customerCode, ReadObjectHttpBinding readObjectHttpBinding, CreateObjectHttpBinding createObjectHttpBinding)
        {
            try
            {
                Job job = new Job();
                job.job = jobNumber;
                return readObjectHttpBinding.readJob(job);
            }
            catch (Exception e)
            {
                Console.WriteLine("Job: " + jobNumber + " does not exist. Creating new job");
                Job job = new Job();
                job.customer = customerCode;
                job = createObjectHttpBinding.createJob(job);
                return job;
            }
        }
    }
}
