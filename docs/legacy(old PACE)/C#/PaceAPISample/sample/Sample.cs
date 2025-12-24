using System;
using System.Web.Services.Protocols;

using efipaceservices;

namespace Pace_Web_Service_SDK
{
	/// <summary>
	/// Summary description for Sample.
	/// </summary>
    public class Sample
    {
        public static void Run()
        {
            string customerCode = SDK.readStringInputFromTheUser(" Please enter Customer ID :");
            VersionPortType versionHttpBinding = PaceClient.getVersionHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            DeleteObjectPortType deleteObjectHttpBinding = PaceClient.getDeleteObjectHttpBinding();

            Console.WriteLine("epace version: " + versionHttpBinding.getVersion());

            Customer customer = new Customer();
            customer.id = customerCode;

            try
            {
                readObjectHttpBinding.readCustomer(customer);
            }
            catch (Exception e)
            {
                Console.WriteLine("Customer does not yet exist: " + e.Message);
            }

            customer.custName = customer.id;

            Console.WriteLine("New customer has no date set: " + customer.dateSetup);

            customer = createObjectHttpBinding.createCustomer(customer);
            // See how the default was populated?
            Console.WriteLine("Created customer '"
                              + customer.custName
                              + "' on "
                              + customer.dateSetup.ToString());

            customer.custName = "New_" + customer.id;
            updateObjectHttpBinding.updateCustomer(customer);
            Console.WriteLine("Sent name change request");

            customer = readObjectHttpBinding.readCustomer(customer);
            Console.WriteLine("Read shows change name: '" + customer.custName + "'");

            deleteObjectHttpBinding.deleteObject("Customer", customerCode);
            Console.WriteLine("Customer " + customerCode + " deleted");

            try
            {
                readObjectHttpBinding.readCustomer(customer);

                throw new Exception("Customer was not deleted"); // Should not be reached
            }
            catch (SoapException e)
            {
                Console.WriteLine("Attempting to read again shows customer is now gone: " + e.Message);
            }
        }
    }
}