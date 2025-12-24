using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ListPaceConnectTypes
    {
        public static void Run()
        {
            InvokePaceConnectHttpBinding invokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding();
            String[] paceConnectTypes = invokePaceConnectHttpBinding.getPaceConnectTypes();
            foreach (String paceConnectType in paceConnectTypes)
            {
                Console.WriteLine("Type : " + paceConnectType);
            }
        }
    }
}
