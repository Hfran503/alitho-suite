using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class JobPlanRefreshSample
    {
        private static CreateObjectHttpBinding createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
        private static ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
        private static InvokeProcessHttpBinding invokeProcessHttpBinding = PaceClient.getInvokeProcessHttpBinding();

        public static void Run()
        {
            Job job;
            Console.WriteLine("Enter Y if you want to create a sample job from the item template - TMP1");
            if( "Y".Equals(Console.ReadLine()))
            {
                ItemTemplate template = ItemTemplateSample.createItemTemplate("TMP1");
                job = ItemTemplateSample.createJob(template);
            }
            else
            {
                job = new Job();
                Console.WriteLine("Enter the job number");
                job.job = Console.ReadLine();
                job = readObjectHttpBinding.readJob(job);
            }

            createSampleJobCosts( job.job, "01" );

            findJobPlans( job.job, "01" );
            invokeProcessHttpBinding.refreshJobPlansForJob( job );
            Console.WriteLine("Job Plans refreshed");
            findJobPlans( job.job, "01" );
        }

        public static void createSampleJobCosts(String jobId, String partId)
        {
            JobCost jobCost = new JobCost();
            jobCost.job = jobId;
            jobCost.jobPart = partId;

            jobCost.activityCode = "000";
            jobCost.chargeClass = 1;

            jobCost = createObjectHttpBinding.createJobCost(jobCost);
        }

        public static void findJobPlans(String jobId, String partId)
        {
            FindObjectsHttpBinding findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();
            String[] jobPlanIds = findObjectsHttpBinding.find("JobPlan", "@job='" + jobId + "'");
            Console.WriteLine(jobPlanIds.Length + " job plans for job " + jobId);
        }
    }
}
