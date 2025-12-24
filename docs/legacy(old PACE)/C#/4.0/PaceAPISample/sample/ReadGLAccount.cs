using System;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for ReadGLAccount.
	/// </summary>
	public class ReadGLAccount
	{
        public static void Run()
        {
            int accountID = 1;

            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();

            GLAccount acct = new GLAccount();
            acct.id = accountID;
            try
            {
                acct = readObjectHttpBinding.readGLAccount(acct);
                Console.WriteLine("The account balance is " + acct.currentPeriodBalance);
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }
	}
}
