using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.util
{
    class Version
    {
        public static void Run()
        {
            VersionPortType versionHttpBinding = PaceClient.getVersionHttpBinding();

            Console.WriteLine(versionHttpBinding.getVersion());
        }
    }
}
