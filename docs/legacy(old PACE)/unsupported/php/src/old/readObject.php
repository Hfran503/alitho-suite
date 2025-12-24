<?php
class ReadObject
{
   var $soapclient;

   function ReadObject()
   {
        $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/ReadObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword']));
   }
   
   function getJob($job)
   {
        $object = $this->soapclient->readJob( array('job' => 
        array('job' => $job,
        "ioID" =>'',
                "addPlanFromJobType" =>'',
                "epaceEstimate" =>'',
                "billPartsTogether" =>'',
                "customer" =>'',
                "chargeBackAccount" =>'',
                "description" =>'',
                "description2" =>'',
                "enteredBy" =>'',
                "jobType" =>'',
                "subJobType" =>'',
                "totalParts" =>'',
                "salesPerson" =>'',
                "csr" =>'',
                "adminStatus" =>'',
                "shipVia" =>'',
                "terms" =>'',
                "allowableOvers" =>'',
                "dateSetup" =>'',
                "timeSetUp" =>'',
                "poNum" =>'',
                "promiseDate" =>'',
                "scheduledShipDate" =>'',
                "jacketStyle" =>'',
                "stockPlannedQuantity" =>'',
                "contact" =>'',
                "priority" =>'',
                "jobProductType" =>'',
                "jobProject" =>'',
                "shoppingCart" =>'',
                "finGoodsOrder" =>'',
                "productOrder" =>'',
                "quoteId" =>'',
                "depositAmount" =>'',
                "priceList" =>'',
                "oversMethod" =>'',
                "shipInNameOf" =>'',
                "reprintType" =>'',
                "numberPositions" =>'',
                "startNumber" =>'',
                "numberPrefix" =>'',
                "numbersGuaranteed" =>'',
                "numberNote" =>'',
                "convertingToJob" =>'',
                "comboTotal" =>'',
                "currentStatus" =>'',
                "part1QuantityOrdered" =>'',
                "part1NumSigs" =>'',
                "sendOrig" =>'',
                "scanningSheets" =>'',
                "custNameTest" =>'')) );

            return $object->out;
   }

   function getEmployeeTime($employeeTime)
   {
        $object = $this->soapclient->readEmployeeTime( array('employeeTime' => array('id' => $employeeTime,"employee" =>'',
            "dcmasterid" =>'',
            "startDate" =>'',
            "startTime" =>'',
            "stopDate" =>'',
            "stopTime" =>'',
            "lunchStart" =>'',
            "lunchStop" =>'',
            "hours" =>'',
            "department" =>'',
            "pRHours" =>'',
            "ioID" =>'')) );
            return $object->out;
   }

   function getGLAccount($gLAccount)
   {
        $object =  $this->soapclient->readGLAccount( array('gLAccount' => array ("id" => $gLAccount,
            "currentPeriodBalance"=>'',
            "account"=>'',
            "name"=>'',
            "accountType"=>'',
            "reportCode"=>'',
            "reportHeadingStyle"=>'',
            "reportFontStyle"=>'',
            "reportFontSize"=>'',
            "amountColumnCode"=>'',
            "normalSign"=>'',
            "reportUnderlineStyle"=>'',
            "levelCode"=>'',
            "autoPostAmt"=>'',
            "active"=>'',
            "importID"=>'',
            "exportID",
            "ioID" =>'')) );

            return $object->out;
   }



   function getWIPCategory($wIPCategory)
   {
        $object =  $this->soapclient->readWIPCategory( array('wIPCategory' => array ("id" => $wIPCategory,
            "description" =>'',
            "cost" =>'',
            "currentBalance" =>'',
            "valueAdd" =>'',
            "taxable" =>'',
            "debitGLAccount" =>'',
            "creditGLAccount" =>'',
            "lastBalance" =>'',
            "ioID" =>'')) );

            return $object->out;
   }
}
?>