using System;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	public class InvokeProcessTest
	{
		public static void Run()
		{
            InvokeProcessHttpBinding invokeProcessHttpBinding = PaceClient.getInvokeProcessHttpBinding();

            /*ProcessResults results = invokeProcessHttpBinding.postInventoryTrn("true");
            Console.WriteLine("Posted " + results.successes.Length + " inventory txn");*/

            ProcessResults results = invokeProcessHttpBinding.postGLBatchTrn("@approved");
			Console.WriteLine("GL Batch Trn Post was a " + ( (bool)results.successful ? "success" : "failure"));

			if (results.successes.Length != 0)
			{

                foreach( SuccessProcessItem item in results.successes )
                {
                    Console.WriteLine("Sucesses: " + item.reason);				    
                }
			}
			
			if (results.failures.Length != 0)
			{
				Console.WriteLine("Failures: ");
				foreach (FailedProcessItem failure in results.failures)
					Console.WriteLine(failure.reason);
			}
		}
	}
}
