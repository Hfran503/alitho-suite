using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ListKeysForPaceConnectType
    {
        public static void Run()
        {
            Console.WriteLine("Enter the pace connect type");
            String paceConnectType = Console.ReadLine();
            InvokePaceConnectPortType invokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding();

            ArrayOfString1 keys = invokePaceConnectHttpBinding.getKeysForPaceConnectType(paceConnectType);

            Console.WriteLine(keys.Count);

            foreach (String key in keys)
            {
                Console.WriteLine(key);
            }
        }
    }
}
