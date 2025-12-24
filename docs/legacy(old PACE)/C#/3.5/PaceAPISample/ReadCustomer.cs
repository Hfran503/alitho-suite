using System;
using System.Collections.Generic;
using System.Text;
using System.Net;

using efipaceservices;


namespace Pace_Web_Service_SDK
{
    class ReadCustomer
    {
        public static void Run()
		{
			string custID = "HOUSE";
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();

            Customer customer = new Customer();
            customer.id = custID;
            customer = readObjectHttpBinding.readCustomer(customer);
            Console.WriteLine("The Customer Name is: " + customer.custName);
		}
	}
}
