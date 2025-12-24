using efipaceservices;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    class GangedActivityJobCost
    {
        private static ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
        private static InvokeActionPortType invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();

        public static void Run()
        {
            Console.WriteLine("Enter the employee id");
            String employeeCode = Console.ReadLine();

            Employee employee = SignInEmployee(employeeCode);

            List<JobPart> jobPartsToGang = new List<JobPart>();

            string customerCode = "HOUSE";
            int orderQty = 12345;

            jobPartsToGang.Add(CreateJob(customerCode, orderQty));
            jobPartsToGang.Add(CreateJob(customerCode, orderQty));
            jobPartsToGang.Add(CreateJob(customerCode, orderQty));

            string activityCode = "20420";

            ActivityCode activity = GetActivityCode(activityCode);

            /*
                 *
                 * Start a ganged job transaction
                 *
                 * @param rpcEmployee  Employee
                 * @param jobParts  List of Job Parts to create job transactions for
                 * @param activityCode ActivityCode
                 * @param hours  Hours
                 * @param prodUnits  Production Units
                 * @param complete Compelte
                 * @param beginCount  Begin Count
                 * @param endCount End Count
                 * @param beginMeter Begin Meter
                 * @param endMeter End Meter
                 * @param notes Notes
                 * @param nonPlannedReason NonPlannedResonID
                 * @return JobCost's created
                 * @throws XFireFault
                 */

            // Elapse time example

            List<JobCost> gangedActivities = invokeActionHttpBinding.startGangedJobTransaction(employee,
                                                                jobPartsToGang.ToArray(),
                                                                activity,
                                                                0,
                                                                0,
                                                                false,
                                                                0,
                                                                0,
                                                                0,
                                                                0,
                                                                null,
                                                                null).ToList();

            Console.WriteLine("Started Ganged Job Activity");

            System.Threading.Thread.Sleep(1000 * 60 * 2);

            invokeActionHttpBinding.pauseGangedJobTransaction(employee, gangedActivities.ToArray());

            Console.WriteLine("Paused Ganged Job Activity");

            System.Threading.Thread.Sleep(1000 * 60 * 2);

            invokeActionHttpBinding.resumeGangedJobTransaction(employee, gangedActivities.ToArray());

            Console.WriteLine("Resumed Ganged Job Activity");

            System.Threading.Thread.Sleep(1000 * 60 * 2);

            /*
                 *
                 * Complete a ganged job transaction
                 *
                 * @param rpcEmployee  Employee
                 * @param gangedCosts  Existing list of ganged JobCosts
                 * @param prodUnits        Production Units
                 * @param complete         Compelte
                 * @param beginCount       Begin Count
                 * @param endCount         End Count
                 * @param beginMeter       Begin Meter
                 * @param endMeter         End Meter
                 * @param notes            Notes
                 * @param nonPlannedReason NonPlannedResonID
                 *
                 * @return JobCost's created
                 */

            gangedActivities = invokeActionHttpBinding.completeGangedJobTransaction(employee,
                                                                                        gangedActivities.ToArray(),
                                                                                        0,
                                                                                        true,
                                                                                        1,
                                                                                        99,
                                                                                        99,
                                                                                        50,
                                                                                        "Ganged Activity Note",
                                                                                        null).ToList();

            Console.WriteLine("Completed Ganged Job Activity");

        }

        private static ActivityCode GetActivityCode( string activityCode)
        {
            ActivityCode activity = new ActivityCode();
            activity.id = activityCode;
            activity = readObjectHttpBinding.readActivityCode(activity);

            return activity;            
        }

        private static Employee SignInEmployee(string employeeCode)
        {
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();            

            Employee employee = new Employee();
            employee.id = employeeCode;
            employee = readObjectHttpBinding.readEmployee(employee);

            invokeActionHttpBinding.employeeSignIn(employee);

            Console.WriteLine("Signed in Employee " + employee.firstName + " " + employee.lastName);

            return employee;
        }

        private static JobPart CreateJob(string customerCode, int orderQty)
        {
            CreateJob createJob = new CreateJob();
            Job job = createJob.CreateJobForCustomer(customerCode, orderQty);

            return getJobPart( job, "01");
        }

        private static JobPart getJobPart(Job job1, string part)
        {
            JobPart jobPart = new JobPart();
            jobPart.job = job1.job;
            jobPart.jobPart = part;
            return readObjectHttpBinding.readJobPart(jobPart);
        }
    }
}
