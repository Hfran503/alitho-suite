using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.IO;

namespace Pace_Web_Service_SDK.sample
{
    class InvokePaceConnect
    {
        public static void Run()
        {
            Console.WriteLine("Enter the pace connect id");
            String connectId = Console.ReadLine();

            Console.WriteLine("Enter the file name");
            String connectInput = readInputFromFile(Console.ReadLine());
            InvokePaceConnectHttpBinding invokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding();

            try
            {
                ProcessResults results = invokePaceConnectHttpBinding.invokePaceConnect(connectId, connectInput);

                SuccessProcessItem[] successes = results.successes;
                if (null != successes)
                {
                    String str = "";
                    foreach (SuccessProcessItem successProcessItem in successes)
                    {
                        str += "\n\t" + successProcessItem.reason;
                    }

                    Console.WriteLine("Successes: " + str);
                }

                FailedProcessItem[] failures = results.failures;

                if (null != failures)
                {
                    String str = "";
                    foreach (FailedProcessItem failureProcessItem in failures)
                    {
                        str += "\n\t" + failureProcessItem.reason;
                    }

                    Console.WriteLine("Failures: " + str);
                }

            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }
        public static String readInputFromFile(String fileName)
        {
            String fileInput = "";
            if (!File.Exists(fileName))
            {
                Console.WriteLine("{0} does not exist!", fileName);
                throw new FileNotFoundException("File {0} entered not found",fileName);
            }
            else
            {
                FileStream fileStream = new FileStream(fileName, FileMode.Open, FileAccess.Read, FileShare.Read);
                using (StreamReader streamReader = new StreamReader(fileStream))
                {
                    string input = "";
                    while (streamReader.Peek() > -1)
                    {
                        input = streamReader.ReadLine();
                    }
                    fileInput = input;
                }
                return fileInput;
            }
        }
    }
}
