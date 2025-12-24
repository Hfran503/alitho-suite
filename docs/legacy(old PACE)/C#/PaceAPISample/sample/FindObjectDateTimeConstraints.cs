using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class FindObjectDateTimeConstraints
    {
        public static void Run()
        {
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();


            //Date Filter Sample with @date = ''
            ArrayOfString keys3 = findObjectsHttpBinding.find("Job", "@dateSetup =''");

            Console.WriteLine(keys3.Count + " Jobs with @dateSetup = null");

            //Time Filter Sample with @time = ''
            ArrayOfString keys4 = findObjectsHttpBinding.find("Job", "@timeSetUp =''");

            Console.WriteLine(keys4.Count + " Jobs with @timeSetUp = null");

            //Time Filter Sample with @time != ''
            ArrayOfString keys5 = findObjectsHttpBinding.find("Job", "@timeSetUp = time( 13, 20, 29 )");

            Console.WriteLine(keys5.Count + " Jobs with @timeSetUp (13,20,29)");

        }
    }
}
