using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class FindObjects
    {
        public static void Run()
        {
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            // create a sort for the keys
            XPathDataSort[] sort = new XPathDataSort[2];

            XPathDataSort xPathDataSort1 = new XPathDataSort();
            xPathDataSort1.descending = false;
            xPathDataSort1.xpath = "customer/@custName";

            XPathDataSort xPathDataSort2 = new XPathDataSort();
            xPathDataSort2.descending = true;
            xPathDataSort2.xpath = "@description";

            sort[0] = xPathDataSort1;
            sort[1] = xPathDataSort2;

            //Open Job Filter Sample
            ArrayOfString keys = findObjectsHttpBinding.findAndSort("Job", "adminStatus/@openJob", sort);

            //Date Filter Sample
            ArrayOfString keys2 = findObjectsHttpBinding.find("Job", "@dateSetup = date( 2012, 07, 03 )");

            Console.WriteLine(keys2.Count + " Jobs Setup As Of 2012-07-03");

            //Finds ALL Job Shipments for a particular job, part, with a not null tracking number
            ArrayOfString shipments = findObjectsHttpBinding.find("JobShipment", " ( @job ='090005' and @jobPart ='01' ) and @trackingNumber !=''");

            foreach (String shipment in shipments)
            {
                Console.WriteLine(shipment);
            }
        }
    }
}
