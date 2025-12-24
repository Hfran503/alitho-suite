using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.util
{
    class DeleteObject
    {
        public static void Run()
        {
            String objectName = "Job";
            String primaryKey = SDK.readStringInputFromTheUser("Please provide id of the Job to be deleted");
            DeleteObjectPortType deleteObjectHttpBinding = PaceClient.getDeleteObjectHttpBinding();
            try
            {
                deleteObjectHttpBinding.deleteObject(objectName, primaryKey);
                Console.WriteLine(objectName + " " + primaryKey + " deleted");
            }
            catch (Exception e)
            {
                Console.WriteLine("Delete Object failed : " + e.Message);
            }
        }
    }
}
