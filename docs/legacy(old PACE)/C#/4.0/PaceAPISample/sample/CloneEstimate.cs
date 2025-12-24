using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    class CloneEstimate
    {
        public static void Run()
        {
            ReadObjectHttpBinding readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            CloneObjectHttpBinding cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();

            int estimateId = readInputFromTheUser();

            // Read the Estimate.
            Estimate estimate = new Estimate();
            estimate.id = estimateId;

            // Company.
            Company company = new Company();

            try
            {
                estimate = readObjectHttpBinding.readEstimate(estimate);
                Console.WriteLine("Estimate " + estimate.estimateNumber + " successfully read");
                // New Estimate for any estimate attributes to override.
                Estimate estimateAttributesToOverride = new Estimate();
                estimateAttributesToOverride.description = "I am a clone";

                // Create a new Estimate which is a clone of Estimate number #5781
                Estimate clonedEstimate = cloneObjectHttpBinding.cloneEstimate(estimate, "", company, estimateAttributesToOverride);

                Console.WriteLine("Successfully Cloned the estimate to " + clonedEstimate.id + " #est = " +clonedEstimate.estimateNumber);
            }
            catch (SoapException e)
            {
                Console.WriteLine("Estimate could not be found " + e.Message);
            }
        }

        private static int readInputFromTheUser()
        {
            // Read it from the console
            Console.WriteLine("Enter the primary key of estimate");
            try
            {
                return Convert.ToInt32(Console.ReadLine());
            }
            catch (FormatException e)
            {
                Console.WriteLine("Expected integer value " + e.Message);
            }
            return -1;
        }
    }
}
