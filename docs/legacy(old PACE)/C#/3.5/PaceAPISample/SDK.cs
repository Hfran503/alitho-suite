using System;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Runs the SDK examples.
	/// 
	/// Set the HOST, PORT, USERNAME, and PASSWORD fields for your server.
	/// </summary>
	public class SDK
	{
		public static string HOST = "epace-xf";
		public static int PORT = 80;
		public static string USERNAME = "Administrator";
		public static string PASSWORD = "pace";

		public static void Main(string[] args)
		{
            while (true)
            {
                int choice = Prompt();

                if (choice == 8)
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
                        FindOpenJobs.Run();
                        break;
                    case 4:
                        InvokeProcessTest.Run();
                        break;
                    case 5:
                        ReadGLAccount.Run();
                        break;
                    case 6:
                        Sample.Run();
                        break;
                    case 7:
                        ReadCustomer.Run();
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
			Console.WriteLine("\t3) FindOpenJobs");
			Console.WriteLine("\t4) InvokeProcessTest");
			Console.WriteLine("\t5) ReadGLAccount");
			Console.WriteLine("\t6) Sample");
            Console.WriteLine("\t7) ReadCustomer");
            Console.WriteLine("\t8) Exit");
			Console.Write("Which example would you like to run? ");
			
			while (true)
			{
				try
				{
					int choice = Int32.Parse(Console.ReadLine());
					if ((choice < 1) || (choice > 8))
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
