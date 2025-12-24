using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ReadJobShipment
    {
        public static void Run()
        {
            int id = SDK.readInputFromTheUser("Please provide job shipment id to be read : ");
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            JobShipment jobShipment = new JobShipment();

            jobShipment.id = id;
            try
            {
                jobShipment = readObjectHttpBinding.readJobShipment(jobShipment);
                Console.WriteLine("Job Shipment : " + jobShipment.id + " was read successfully");
            }
            catch(Exception e)
            {
                Console.WriteLine("JobShipment: " + id + " does not exist. " + e.Message);
            }
        }
    }
}
