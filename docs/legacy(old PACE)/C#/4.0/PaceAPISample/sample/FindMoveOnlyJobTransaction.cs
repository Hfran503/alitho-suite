using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class FindMoveOnlyJoTransaction
    {

        public static void Run()
        {
            CreateObjectHttpBinding createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectHttpBinding updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectHttpBinding cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();
            FindObjectsHttpBinding findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            Console.WriteLine("Enter the Job number");
            String jobNumber = Console.ReadLine();

            Console.WriteLine("Enter the customer code");
            String customerCode = Console.ReadLine();

            Job job = getJobIfExistsOrCreateNew(jobNumber, customerCode, readObjectHttpBinding, createObjectHttpBinding);

            if (null != job)
            {
                String xpath = "activityCode/@chargeBasis = 6 and @job='" + job.job + "' and @jobPart='01' ";
                Console.WriteLine("Finding JobTransactions using XPath " + xpath);

                String[] keys = findObjectsHttpBinding.find("JobCost", xpath);

                int keysLength = keys.Length;

                if (keys.Length == 0)
                {
                    Console.WriteLine("No Move Job Transactions occured.");
                }
                else
                {
                    for (int i = 0; i < keys.Length; i++)
                    {
                        Console.WriteLine(keys[i]);
                    }
                }
            }
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
