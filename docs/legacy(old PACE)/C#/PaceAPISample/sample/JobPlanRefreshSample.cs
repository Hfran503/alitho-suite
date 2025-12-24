using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class JobPlanRefreshSample
    {
        private static CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
        private static ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
        private static InvokeProcessPortType invokeProcessHttpBinding = PaceClient.getInvokeProcessHttpBinding();

        public static void Run()
        {
            Job job;
            Console.WriteLine("Enter Y if you want to create a sample job from the item template ");
            if( "Y".Equals(Console.ReadLine()))
            {
                String itemTemp = SDK.readStringInputFromTheUser( "Please enter item template name to be created : " );
                ItemTemplate template = ItemTemplateSample.createItemTemplate( itemTemp );
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
            invokeProcessHttpBinding.updateLinksJobPlansForJob(job);
            Console.WriteLine("Links Updated");
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
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();
            ArrayOfString jobPlanIds = findObjectsHttpBinding.find("JobPlan", "@job='" + jobId + "'");
            Console.WriteLine(jobPlanIds.Count + " job plans for job " + jobId);
        }
    }
}
