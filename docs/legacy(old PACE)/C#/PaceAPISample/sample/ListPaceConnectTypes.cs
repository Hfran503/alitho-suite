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
            InvokePaceConnectPortType invokePaceConnectHttpBinding = PaceClient.getInvokePaceConnectHttpBinding();
            ArrayOfString1 paceConnectTypes = invokePaceConnectHttpBinding.getPaceConnectTypes();
            foreach (String paceConnectType in paceConnectTypes)
            {
                Console.WriteLine("Type : " + paceConnectType);
            }
        }
    }
}
