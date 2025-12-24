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
            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectPortType cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();

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
                    try
                    {
                        jobTransaction = createJobCost(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job), true, true);
                        Console.WriteLine("Successfully created the job transaction :" + jobTransaction.id);
                    }
                    catch(Exception e)
                    {
                        Console.WriteLine("Setting unpersisted fields work for normal unpersisted non calculated attributes");
                    }
                    try
                    {
                        //test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = false
                        // We expect this to fail, that is a valid test!
                        createJobCost(activityCode, createObjectHttpBinding, getJobPart(readObjectHttpBinding, "01", job), false, false);
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

        private static JobPart getJobPart(ReadObjectPortType readObjectHttpBinding, String partString, Job job)
        {
            JobPart part = new JobPart();
            part.job = job.job;
            part.jobPart = partString;
            return readObjectHttpBinding.readJobPart(part);
        }

        private static JobCost createJobCost(String activityCode, CreateObjectPortType createObjectHttpBinding, JobPart part, Boolean shouldOverride, Boolean posted)
        {
            JobCost jobCost= new JobCost();
            jobCost.JobPartKey = part.primaryKey;
            jobCost.activityCode = activityCode;
            jobCost.overrideJobStatus = shouldOverride;
            jobCost.posted = posted;
            return createObjectHttpBinding.createJobCost(jobCost);
        }

        private static Job getJobIfExistsOrCreateNew(String jobNumber, String customerCode, ReadObjectPortType readObjectHttpBinding, CreateObjectPortType createObjectHttpBinding)
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
