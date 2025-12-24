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
            InvokePaceConnectHttpBinding invokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding();

            String[] keys = invokePaceConnectHttpBinding.getKeysForPaceConnectType(paceConnectType);

            Console.WriteLine(keys.Length);

            foreach (String key in keys)
            {
                Console.WriteLine(key);
            }
        }
    }
}
