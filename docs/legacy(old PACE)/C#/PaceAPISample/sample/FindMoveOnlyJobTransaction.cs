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
            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectPortType cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            Console.WriteLine("Enter the Job number");
            String jobNumber = Console.ReadLine();

            Console.WriteLine("Enter the customer code");
            String customerCode = Console.ReadLine();

            Job job = getJobIfExistsOrCreateNew(jobNumber, customerCode, readObjectHttpBinding, createObjectHttpBinding);

            if (null != job)
            {
                String xpath = "activityCode/@chargeBasis = 6 and @job='" + job.job + "' and @jobPart='01' ";
                Console.WriteLine("Finding JobTransactions using XPath " + xpath);

                ArrayOfString keys = findObjectsHttpBinding.find("JobCost", xpath);

                if (keys.Count == 0)
                {
                    Console.WriteLine("No Move Job Transactions occured.");
                }
                else
                {
                    for (int i = 0; i < keys.Count; i++)
                    {
                        Console.WriteLine(keys[i]);
                    }
                }
            }
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
