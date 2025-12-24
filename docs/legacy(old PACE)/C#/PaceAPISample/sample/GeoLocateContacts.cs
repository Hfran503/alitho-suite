using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class GeoLocateContacts
    {
        public static void Run()
        {
            String latitude = "40.77447";
            String longitude = "-73.96150";
            int radius = 50;
            String xpath = "@active = 'true'";

            new GeoLocateContacts().run(latitude, longitude, radius, xpath);
        }

        public void run(String latitude, String longitude, int radius, String xpathExpression)
        {
            GeoLocatePortType geoLocateHttpBinding = PaceClient.getGeoLocateHttpBinding();
            ArrayOfString3 keys = geoLocateHttpBinding.findContacts(latitude, longitude, radius, xpathExpression);

            Console.WriteLine("Following contacts in range: ");

            foreach (String contact in keys)
            {
                Console.WriteLine(contact);
            }
        }

    }
}
