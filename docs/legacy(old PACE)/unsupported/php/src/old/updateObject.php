<?php
class UpdateObject
{
   var $soapclient;

   function UpdateObject()
   {
        $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/UpdateObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword']));
   }

   function setJob($job)
   {
        $this->soapclient->updateJob( array('job' => $job) );
   }
}
?>