using System;
using Pace_Web_Service_SDK.sample;
using Pace_Web_Service_SDK.util;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Runs the SDK examples.
	/// 
	/// Set the HOST, PORT, USERNAME, and PASSWORD fields for your server.
	/// </summary>
	public class SDK
	{
		public static string HOST = "yourhost";
		public static int PORT = 80;
		public static string USERNAME = "APIUserName";
		public static string PASSWORD = "APIUserPassword";
        public static string PUBLICCOMPANY = "company:public";
        public static string SAMPLECOMPANY = "company:sample";

		public static void Main(string[] args)
		{
            while (true)
            {
                int choice = Prompt();

                if (choice == 0)
                {
                    break;
                }

                switch (choice)
                {
                    case 1:
                        CloseJob.Run();
                        break;
                    case 2:
                        CreateJob.Run();
                        break;
                    case 3:
                        CloneJob.Run();
                        break;
                    case 4:
                        CloneEstimate.Run();
                        break;
                    case 5:
                        FindOpenJobs.Run();
                        break;
                    case 6:
                        InvokeProcessTest.Run();
                        break;
                    case 7:
                        ReadGLAccount.Run();
                        break;
                    case 8:
                        Sample.Run();
                        break;
                    case 9:
                        ReadCustomer.Run();
                        break;
                    case 10:
                        ChargeBackAccountSample.Run();
                        break;
                    case 11:
                        ConvertToJob.Run();
                        break;
                    case 12:
                        CreateJobTransactionUsingOverrideStatusAttribute.Run();
                        break;
                    case 13:
                        FindObjectsAggregate.Run();
                        break;
                    case 14:
                        GeoLocateContacts.Run();
                        break;
                    case 15:
                        FindMoveOnlyJoTransaction.Run();
                        break;
                    case 16:
                        InvokePaceConnect.Run();
                        break;
                    case 17:
                        ListKeysForPaceConnectType.Run();
                        break;
                    case 18:
                        FindObjects.Run();
                        break;
                    case 19:
                        ListPaceConnectTypes.Run();
                        break;
                    case 20:
                        ReadJobShipment.Run();
                        break;
                    case 21:
                        Scheduler.Run();
                        break;
                    case 22:
                        SystemInspector.Run();
                        break;
                    case 23:
                        AttachmentService.Main();
                        break;
                    case 24:
                        Pace_Web_Service_SDK.util.Version.Run();
                        break;
                    case 25:
                        DeleteObject.Run();
                        break;
                    case 26:
                        FindObjectDateTimeConstraints.Run();
                        break;
                    case 27:
                        ReceivePOLine.Run();
                        break;
                    case 28:
                        ItemTemplateSample.Run();
                        break;
                    case 29:
                        JobPlanRefreshSample.Run();
                        break;
                    case 30:
                        CreateEstimate.Run();
                        break;
                    case 31:
                        CreateEstimatePart.Run();
                        break;
                    case 32:
                        ReportServiceSample.Run();
                        break; 
                    case 33:
                        // Uncomment the below line for multi company.
                        // Note : check the documentation for configurations before running this sample.
                        //multicompanysample.CreateJob.Run();
                        break;
                }
            }

			Console.WriteLine("\nHit any key to exit.");
			Console.ReadLine();
		}

        private static int Prompt()
        {
            Console.WriteLine("Example programs:");
            Console.WriteLine("\t1) CloseJob");
            Console.WriteLine("\t2) CreateJob");
            Console.WriteLine("\t3) CloneJob");
            Console.WriteLine("\t4) CloneEstimate");
            Console.WriteLine("\t5) FindOpenJobs");
            Console.WriteLine("\t6) InvokeProcessTest");
            Console.WriteLine("\t7) ReadGLAccount");
            Console.WriteLine("\t8) CRUD Sample");
            Console.WriteLine("\t9) ReadCustomer");
            Console.WriteLine("\t10) Charge-Back-Account-Sample");
            Console.WriteLine("\t11) Convert-To-Job");
            Console.WriteLine("\t12) Create-JobTransaction-Using-override status attribute");
            Console.WriteLine("\t13) Find-objects-aggregate");
            Console.WriteLine("\t14) Geo Locate Contacts");
            Console.WriteLine("\t15) FindMoveOnlyTransaction");
            Console.WriteLine("\t16) Invoke Pace Connect");
            Console.WriteLine("\t17) ListKeys For PaceConnectType");
            Console.WriteLine("\t18) Find Objects");
            Console.WriteLine("\t19) List Pace Connect Types");
            Console.WriteLine("\t20) Read Job Shipment");
            Console.WriteLine("\t21) Invoke Scheduler");
            Console.WriteLine("\t22) System Inspector");
            Console.WriteLine("\t23) Attachment Service");
            Console.WriteLine("\t24) Get Version");
            Console.WriteLine("\t25) Delete Object");
            Console.WriteLine("\t26) FindObjectDateTimeConstraints");
            Console.WriteLine("\t27) Receive PO Line");
            Console.WriteLine("\t28) Run item template sample");
            Console.WriteLine("\t29) Refresh Job Plans");
            Console.WriteLine("\t30) Create Estimate");
            Console.WriteLine("\t31) Add Estimate part");
            Console.WriteLine("\t32) Report service sample");
                                    
            Console.WriteLine("\t0) Exit");
            Console.Write("Which example would you like to run? ");

            while (true)
            {
                try
                {
                    int choice = Int32.Parse(Console.ReadLine());
                    if ((choice < 0) || (choice > 33))
                        continue;
                    return choice;
                }
                catch
                {
                    Console.Write("Invalid choice. Please pick again: ");
                }
            }
        }
    }
}