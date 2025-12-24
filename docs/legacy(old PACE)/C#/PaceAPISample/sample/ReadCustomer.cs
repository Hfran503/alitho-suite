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
            Console.WriteLine("Enter the customer id");
			string custID = Console.ReadLine();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();

            Customer customer = new Customer();
            customer.id = custID;
            try
            {
                customer = readObjectHttpBinding.readCustomer(customer);
                Console.WriteLine("The Customer Name is: " + customer.custName);
            }
            catch(Exception e)
            {
                Console.WriteLine(e.Message);
            }
            
            
		}
	}
}
