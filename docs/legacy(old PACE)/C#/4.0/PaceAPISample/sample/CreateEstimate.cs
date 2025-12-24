using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    public class CreateEstimate
    {
        public static void Run()
        {
            InvokeActionHttpBinding invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();
            EstimateInfo estimateInfo = createEstimateInfo();
            estimateInfo.estimatePartInfo = CreateEstimatePart.createEstimatePartInfo(null);
            try
            {
                Estimate estimate = invokeActionHttpBinding.createEstimate(estimateInfo);
                Console.WriteLine( "Estimate " + estimate.estimateNumber  + " was successfully created for the customer HOUSE");
            }
            catch (SoapException e)
            {
                Console.WriteLine(e.Message);
            }
            
        }

        private static EstimateInfo createEstimateInfo()
        {
            EstimateInfo estimateInfo = new EstimateInfo();
            estimateInfo.customer = "HOUSE";
            estimateInfo.estimateDescription = "TEST Description";
            return estimateInfo;
        }
    }

}
