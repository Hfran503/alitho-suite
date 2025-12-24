<?php
class FindObjects
{
   var $soapclient;

   function FindObjects()
   {
        $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/FindObjects?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword']));
   }

   function getObjects($object, $filter)
   {
        $ret = $this->soapclient->find(array('in0' => $object,'in1' => $filter ));
		return $ret->out->string;
   }
}
?>