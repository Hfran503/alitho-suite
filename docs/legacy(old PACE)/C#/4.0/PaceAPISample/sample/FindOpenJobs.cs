using System;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for FindOpenJobs.
	/// </summary>
	public class FindOpenJobs
	{
		public static void Run()
		{
            FindObjectsHttpBinding findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            string[] keys = findObjectsHttpBinding.find("Job", "adminStatus/@openJob");
			Console.WriteLine( keys.Length + " Open Jobs" );
			Console.WriteLine( string.Join(",", keys) );
		}
	}
}
