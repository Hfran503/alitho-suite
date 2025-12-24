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
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            ArrayOfString keys = findObjectsHttpBinding.find("Job", "adminStatus/@openJob");
			Console.WriteLine( keys.Count + " Open Jobs" );
			Console.WriteLine( string.Join(",", keys) );
		}
	}
}
