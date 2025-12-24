using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    public class CreateEstimatePart
    {
        public static void Run()
        {
            InvokeActionPortType invokeActionHttpBinding = PaceClient.getInvokeActionHttpBinding();
            Console.WriteLine("Enter the estimate id for which the estimate part has to be added");
            String estimateNumber = Console.ReadLine();

            EstimatePartInfo estimatePartInfo = createEstimatePartInfo(estimateNumber);
            try
            {
                EstimatePart estimatePart = invokeActionHttpBinding.addEstimatePart(estimatePartInfo);
                Console.WriteLine("Estimate Part was successfully added to the estimate Number " + estimatePart.estimate);
            }
            catch (SoapException e)
            {
                Console.WriteLine(e.Message);
            }
        }

        public static EstimatePartInfo createEstimatePartInfo(String estimateNumber)
        {
            EstimatePartInfo estimatePartInfo = new EstimatePartInfo();
            estimatePartInfo.estimateID = estimateNumber;
            estimatePartInfo.foldPattern = "2:1";
            estimatePartInfo.finalSizeH = 12;
            estimatePartInfo.finalSizeW = 22;
            estimatePartInfo.eachOf = 22;
            estimatePartInfo.numPlies = 32;
            estimatePartInfo.grainSpecifications = 3;

            estimatePartInfo.bindingMethod = 1;
            estimatePartInfo.prepressWorkflow = 4;

            estimatePartInfo.product = "FL";

            // estimatePartInfo.setCompositeProduct(5001);
            estimatePartInfo.colorsSide1 = 4;
            estimatePartInfo.colorsSide2 = 4;
            estimatePartInfo.totalColors = 4;
            estimatePartInfo.inkCoverageFront = 3;

            estimatePartInfo.inkCoverageBack = 3;

            estimatePartInfo.quantity1 = 1000;
            estimatePartInfo.quantity2 = 2000;
            estimatePartInfo.quantity1Desc = " qty1 desc ";
            estimatePartInfo.quantity2Desc = " qty2 desc ";

            EstimatePaperInfo estimatePaperInfo = createEstimatePaperInfo();
            EstimatePressInfo estimatePressInfo = createEstimatePressInfo();

            estimatePartInfo.estimatePaperInfo = estimatePaperInfo;
            estimatePartInfo.estimatePressInfo = estimatePressInfo;

            return estimatePartInfo;
        }

        private static EstimatePaperInfo createEstimatePaperInfo()
        {
            EstimatePaperInfo estimatePaperInfo = new EstimatePaperInfo();
            estimatePaperInfo.materialType = "InventoryItem";
            estimatePaperInfo.inventoryItem = SDK.readStringInputFromTheUser("Please enter Inventory Item id for the Estimate : ");
            estimatePaperInfo.weight = 5002;
            estimatePaperInfo.uom = "EA";
            estimatePaperInfo.buySizeH = 25;
            estimatePaperInfo.buySizeW = 30;
            estimatePaperInfo.buySizeGrainDirection = 2;         

            return estimatePaperInfo;
        }

        private static EstimatePressInfo createEstimatePressInfo()
        {
            EstimatePressInfo estimatePressInfo = new EstimatePressInfo();
            estimatePressInfo.primaryPress = 1;
            estimatePressInfo.runMethod = 1;
            estimatePressInfo.runSizeH = 25;
            estimatePressInfo.runSizeW = 30;
            estimatePressInfo.runSizeGrainDirection = 2;
            return estimatePressInfo;
        }
    }
}
